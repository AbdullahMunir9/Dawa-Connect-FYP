import { createHash, randomUUID } from 'node:crypto';
import { normalizeReportMonth } from './analyticsCore.js';
import { measuredPharmacyAnalytics } from './analyticsService.js';
import { pharmacyDatabase } from './pharmacyService.js';
import {
  ANALYTICS_NARRATIVE_PROMPT_VERSION,
  buildNarrativeInput,
  buildTemplateNarrative,
  validateNarrativeOutput,
} from './analyticsNarrativeCore.js';
import { generateNarrativeFromAi } from './analyticsNarrativeProvider.js';

const REPORTS_COLLECTION = 'analyticsNarrativeReports';

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function inputDigest(input) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function publicReport(document, generationWarning = '') {
  if (!document) return null;
  return {
    id: document.reportId,
    month: document.month,
    monthLabel: document.monthLabel,
    title: document.title,
    calculationVersion: document.calculationVersion,
    promptVersion: document.promptVersion,
    provider: document.provider,
    model: document.model,
    generationMethod: document.generationMethod,
    generatedAt: document.generatedAt,
    report: document.report,
    evidence: document.evidence,
    disclaimer: document.disclaimer,
    fallbackReason: document.fallbackReason || '',
    generationWarning,
  };
}

function reportContextFromAnalytics(analytics) {
  if (!analytics?.meta?.month || !analytics?.meta?.calculationVersion) {
    throw Object.assign(new Error('The analytics snapshot is incomplete.'), { status: 409 });
  }
  const input = buildNarrativeInput(analytics);
  return {
    month: analytics.meta.month,
    monthLabel: analytics.meta.monthLabel,
    calculationVersion: analytics.meta.calculationVersion,
    input,
    digest: inputDigest(input),
  };
}

async function reportContext(ownerId, requestedMonth) {
  const month = normalizeReportMonth(requestedMonth);
  const analytics = await measuredPharmacyAnalytics(ownerId, month);
  return reportContextFromAnalytics(analytics);
}

async function findCurrentReport(db, ownerId, context) {
  return db.collection(REPORTS_COLLECTION).findOne({
    ownerId,
    month: context.month,
    calculationVersion: context.calculationVersion,
    promptVersion: ANALYTICS_NARRATIVE_PROMPT_VERSION,
    inputDigest: context.digest,
  });
}

export async function getAnalyticsNarrative(ownerId, requestedMonth) {
  const [db, context] = await Promise.all([
    pharmacyDatabase(),
    reportContext(ownerId, requestedMonth),
  ]);
  const document = await findCurrentReport(db, ownerId, context);
  return {
    available: Boolean(document),
    month: context.month,
    monthLabel: context.monthLabel,
    report: publicReport(document),
  };
}

async function generateNarrativeForContext(db, ownerId, context, { force = false } = {}) {
  const existing = await findCurrentReport(db, ownerId, context);
  if (existing && !force) {
    return {
      available: true,
      month: context.month,
      monthLabel: context.monthLabel,
      cached: true,
      report: publicReport(existing),
    };
  }

  const cooldownSeconds = boundedInteger(
    process.env.ANALYTICS_AI_REGENERATION_COOLDOWN_SECONDS,
    300,
    30,
    3600,
  );
  if (force && existing?.generatedAt &&
    Date.now() - new Date(existing.generatedAt).getTime() < cooldownSeconds * 1000) {
    throw Object.assign(
      new Error(`Wait ${cooldownSeconds} seconds before regenerating this report.`),
      { status: 429 },
    );
  }

  let report;
  let provider = 'dawaconnect';
  let model = 'deterministic-template-v1';
  let generationMethod = 'template';
  let fallbackReason = '';
  try {
    const generated = await generateNarrativeFromAi(context.input);
    report = validateNarrativeOutput(generated.output, context.input);
    provider = generated.provider;
    model = generated.model;
    generationMethod = 'ai';
  } catch (error) {
    fallbackReason = String(error?.code || 'provider_failure').slice(0, 80);
    if (existing) {
      return {
        available: true,
        month: context.month,
        monthLabel: context.monthLabel,
        cached: true,
        report: publicReport(
          existing,
          'A fresh AI narrative could not be generated, so the previously saved report is still being shown.',
        ),
      };
    }
    report = buildTemplateNarrative(context.input);
  }

  const now = new Date();
  const title = `${context.monthLabel} Pharmacy Performance and Recommendation Report`;
  const disclaimer = 'Planning support only. Measured figures come from DawaConnect records; forecasts and city opportunities are not guaranteed outcomes and all actions require pharmacy-owner review.';
  const identity = {
    ownerId,
    month: context.month,
    calculationVersion: context.calculationVersion,
    promptVersion: ANALYTICS_NARRATIVE_PROMPT_VERSION,
    inputDigest: context.digest,
  };
  let document;
  try {
    document = await db.collection(REPORTS_COLLECTION).findOneAndUpdate(
      identity,
      {
        $set: {
          monthLabel: context.monthLabel,
          title,
          provider,
          model,
          generationMethod,
          report,
          evidence: context.input.facts,
          disclaimer,
          fallbackReason,
          generatedAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          reportId: randomUUID(),
          ownerId,
          month: context.month,
          calculationVersion: context.calculationVersion,
          promptVersion: ANALYTICS_NARRATIVE_PROMPT_VERSION,
          inputDigest: context.digest,
          createdAt: now,
        },
        $inc: { generationAttempts: 1 },
      },
      { upsert: true, returnDocument: 'after' },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    document = await db.collection(REPORTS_COLLECTION).findOne(identity);
  }
  if (!document) throw Object.assign(new Error('The recommendation report could not be stored.'), { status: 503 });

  return {
    available: true,
    month: context.month,
    monthLabel: context.monthLabel,
    cached: false,
    report: publicReport(document),
  };
}

export async function generateAnalyticsNarrative(ownerId, requestedMonth, { force = false } = {}) {
  const db = await pharmacyDatabase();
  const context = await reportContext(ownerId, requestedMonth);
  return generateNarrativeForContext(db, ownerId, context, { force });
}

export async function generateAnalyticsNarrativeForAnalytics(ownerId, analytics) {
  const db = await pharmacyDatabase();
  const context = reportContextFromAnalytics(analytics);
  return generateNarrativeForContext(db, ownerId, context, { force: false });
}

