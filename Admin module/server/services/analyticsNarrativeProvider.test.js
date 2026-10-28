import test from 'node:test';
import assert from 'node:assert/strict';
import { generateNarrativeFromAi } from './analyticsNarrativeProvider.js';

const input = {
  reportMonth: '2026-10',
  facts: [{ key: 'summary.deliveredOrders', label: 'Delivered orders', value: 2, display: '2', format: 'integer', category: 'sales' }],
};

const output = {
  executiveSummary: { headline: 'Measured activity is available', overview: 'Review the verified evidence before taking action.', factKeys: ['summary.deliveredOrders'] },
  salesInsights: [{ title: 'Review delivered activity', explanation: 'Use the verified source fact as the sales baseline.', priority: 'medium', factKeys: ['summary.deliveredOrders'] }],
  inventoryActions: [{ title: 'Review inventory', explanation: 'Continue regular owner review of current stock.', priority: 'low', factKeys: ['summary.deliveredOrders'] }],
  deliveryOpportunities: [{ title: 'Review delivery evidence', explanation: 'Do not assume unmeasured demand will become an order.', priority: 'low', factKeys: ['summary.deliveredOrders'] }],
  risksAndLimitations: [{ title: 'Respect data limits', explanation: 'Treat recommendations as planning support.', priority: 'high', factKeys: ['summary.deliveredOrders'] }],
  nextMonthActionPlan: [{ title: 'Review the next cycle', explanation: 'Compare the next measured period with this baseline.', priority: 'medium', factKeys: ['summary.deliveredOrders'] }],
};

test('provider keeps the key in authorization, uses the fixed Groq endpoint and requests strict schema output', async () => {
  let request;
  const result = await generateNarrativeFromAi(input, {
    env: { ANALYTICS_AI_PROVIDER: 'groq', ANALYTICS_AI_API_KEY: 'server-secret', ANALYTICS_AI_MODEL: 'openai/gpt-oss-20b' },
    fetcher: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(output) } }] }),
      };
    },
  });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer server-secret');
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.stream, false);
  assert.deepEqual(result.output, output);
});

test('missing configuration and provider errors return safe codes without exposing secrets', async () => {
  await assert.rejects(generateNarrativeFromAi(input, {
    env: { ANALYTICS_AI_PROVIDER: 'groq' },
    fetcher: () => assert.fail('must not fetch'),
  }), { code: 'not_configured' });

  await assert.rejects(generateNarrativeFromAi(input, {
    env: { ANALYTICS_AI_PROVIDER: 'groq', ANALYTICS_AI_API_KEY: 'do-not-leak' },
    fetcher: async () => ({ ok: false, status: 401, json: async () => ({ message: 'do-not-leak' }) }),
  }), (error) => {
    assert.equal(error.code, 'authentication_failed');
    assert.equal(String(error).includes('do-not-leak'), false);
    return true;
  });
});

test('malformed provider content is rejected before it reaches report validation or storage', async () => {
  await assert.rejects(generateNarrativeFromAi(input, {
    env: { ANALYTICS_AI_PROVIDER: 'groq', ANALYTICS_AI_API_KEY: 'server-secret' },
    fetcher: async () => ({
      ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'not-json' } }] }),
    }),
  }), { code: 'invalid_json' });
});

