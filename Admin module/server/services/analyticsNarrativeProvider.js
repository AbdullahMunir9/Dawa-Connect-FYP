import {
  ANALYTICS_NARRATIVE_SCHEMA,
  buildNarrativeMessages,
} from './analyticsNarrativeCore.js';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class AnalyticsNarrativeProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AnalyticsNarrativeProviderError';
    this.code = code;
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function providerConfiguration(env = process.env) {
  const provider = String(env.ANALYTICS_AI_PROVIDER || 'groq').trim().toLowerCase();
  const apiKey = String(env.ANALYTICS_AI_API_KEY || env.GROQ_API_KEY || '').trim();
  const model = String(env.ANALYTICS_AI_MODEL || 'openai/gpt-oss-20b').trim();
  const timeoutMs = boundedInteger(env.ANALYTICS_AI_TIMEOUT_MS, 25_000, 5_000, 60_000);
  if (provider === 'disabled' || provider === 'none') {
    throw new AnalyticsNarrativeProviderError('not_configured', 'The analytics AI provider is disabled.');
  }
  if (provider !== 'groq') {
    throw new AnalyticsNarrativeProviderError('unsupported_provider', 'The configured analytics AI provider is not supported.');
  }
  if (!apiKey) {
    throw new AnalyticsNarrativeProviderError('not_configured', 'The analytics AI key is not configured.');
  }
  if (!model || model.length > 160) {
    throw new AnalyticsNarrativeProviderError('invalid_configuration', 'The analytics AI model is invalid.');
  }
  return { provider, apiKey, model, timeoutMs, endpoint: GROQ_CHAT_COMPLETIONS_URL };
}

function safeProviderFailure(status) {
  if (status === 401 || status === 403) return 'authentication_failed';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'provider_unavailable';
  return 'request_rejected';
}

async function requestCompletion(configuration, narrativeInput, fetcher) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);
  try {
    const response = await fetcher(configuration.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: configuration.model,
        messages: buildNarrativeMessages(narrativeInput),
        temperature: 0.2,
        max_completion_tokens: 3500,
        stream: false,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'dawaconnect_pharmacy_analytics_report',
            strict: true,
            schema: ANALYTICS_NARRATIVE_SCHEMA,
          },
        },
      }),
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) {
      throw new AnalyticsNarrativeProviderError(
        safeProviderFailure(response.status),
        'The analytics AI provider rejected the report request.',
      );
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AnalyticsNarrativeProviderError('invalid_response', 'The analytics AI provider returned no report.');
    }
    try {
      return JSON.parse(content);
    } catch {
      throw new AnalyticsNarrativeProviderError('invalid_json', 'The analytics AI provider returned invalid JSON.');
    }
  } catch (error) {
    if (error instanceof AnalyticsNarrativeProviderError) throw error;
    throw new AnalyticsNarrativeProviderError(
      controller.signal.aborted ? 'timeout' : 'provider_unavailable',
      controller.signal.aborted
        ? 'The analytics AI provider took too long to respond.'
        : 'The analytics AI provider could not be reached.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateNarrativeFromAi(narrativeInput, {
  env = process.env,
  fetcher = fetch,
} = {}) {
  const configuration = providerConfiguration(env);
  const output = await requestCompletion(configuration, narrativeInput, fetcher);
  return {
    provider: configuration.provider,
    model: configuration.model,
    output,
  };
}

