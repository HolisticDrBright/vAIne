/**
 * analyze-skin Edge Function (Deno): the only place photographs are handled
 * server-side. The photos arrive in the request body, are validated, sent
 * once to the vision provider, and exist only in this isolate's memory —
 * never storage, logs, database rows, or the response.
 *
 * Deployed with verify_jwt enabled. Order of checks: method → JWT → kill
 * switch → request validation → quotas → provider → normalization → strict
 * schema validation → photo-free scan → persist photo-free result + audit.
 * Failure at any point returns a generic code and audits it; no synthetic
 * result is ever substituted.
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { findPhotoDataViolations } from '../_shared/photoFree.ts';
import {
  SKIN_ANALYSIS_PROMPT_VERSION,
  SKIN_ANALYSIS_SCHEMA_VERSION,
  normalizeProviderOutput,
  skinAnalysisSchema,
} from '../_shared/skinAnalysisContract.ts';
import { buildProviderParams, DEFAULT_MODEL, parseProviderResponse, PROVIDER_ID, PROVIDER_TIMEOUT_MS } from './provider.ts';
import { decideQuota, parseLimits, periodKeys, type UsageSnapshot } from './quota.ts';
import { validateRequest, type ValidatedRequest } from './request.ts';

const MIN_ACCEPTABLE_OVERALL_CONFIDENCE = 0.5;
const DEFAULT_RETAKE_INSTRUCTION =
  'The photos could not support a confident view. Please retake them in even, indirect light with your face inside the guide.';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Admin = ReturnType<typeof createClient>;

async function audit(admin: Admin, analysisId: string, userId: string | null, event: string, detail: Record<string, unknown>) {
  const safeDetail = findPhotoDataViolations(detail).length ? { scrubbed: true } : detail;
  try {
    await admin.from('analysis_audit').insert({ analysis_id: analysisId, user_id: userId, event, detail: safeDetail });
  } catch {
    // Auditing must never block or expose the analysis flow.
  }
}

async function readUsage(admin: Admin, userId: string, nowIso: string): Promise<UsageSnapshot | null> {
  const { day, month } = periodKeys(nowIso);
  const [userRows, globalRow, monthRows] = await Promise.all([
    admin.from('usage_counters').select('period_type, period_key, analyses_count').eq('user_id', userId).in('period_key', [day, month]),
    admin.from('global_counters').select('analyses_count').eq('period_key', day).maybeSingle(),
    admin.from('usage_counters').select('user_id').eq('period_type', 'month').eq('period_key', month),
  ]);
  if (userRows.error || globalRow.error || monthRows.error) return null;
  const rows = (userRows.data ?? []) as { period_type: string; period_key: string; analyses_count: number }[];
  const userDaily = rows.find((row) => row.period_type === 'day' && row.period_key === day)?.analyses_count ?? 0;
  const userMonthly = rows.find((row) => row.period_type === 'month' && row.period_key === month)?.analyses_count ?? 0;
  const users = new Set(((monthRows.data ?? []) as { user_id: string }[]).map((row) => row.user_id));
  return {
    userDaily,
    userMonthly,
    globalDaily: ((globalRow.data as { analyses_count: number } | null)?.analyses_count) ?? 0,
    activeBetaUsersExcludingCaller: users.has(userId) ? users.size - 1 : users.size,
    callerSeenThisMonth: users.has(userId),
  };
}

async function incrementUsage(admin: Admin, userId: string, nowIso: string, usage: UsageSnapshot): Promise<boolean> {
  const { day, month } = periodKeys(nowIso);
  const writes = await Promise.all([
    admin.from('usage_counters').upsert({ user_id: userId, period_type: 'day', period_key: day, analyses_count: usage.userDaily + 1, updated_at: nowIso }),
    admin.from('usage_counters').upsert({ user_id: userId, period_type: 'month', period_key: month, analyses_count: usage.userMonthly + 1, updated_at: nowIso }),
    admin.from('global_counters').upsert({ period_key: day, analyses_count: usage.globalDaily + 1 }),
  ]);
  return writes.every((write) => !write.error);
}

function classify(result: { imageQuality: { usable: boolean; retakeInstruction: string | null }; overallConfidence: number }) {
  if (!result.imageQuality.usable) {
    return { decision: 'retake_requested' as const, instruction: result.imageQuality.retakeInstruction ?? DEFAULT_RETAKE_INSTRUCTION };
  }
  if (result.overallConfidence < MIN_ACCEPTABLE_OVERALL_CONFIDENCE) {
    return { decision: 'retake_requested' as const, instruction: DEFAULT_RETAKE_INSTRUCTION };
  }
  return { decision: 'accepted' as const };
}

async function callProvider(apiKey: string, model: string, request: ValidatedRequest) {
  const client = new Anthropic({ apiKey, timeout: PROVIDER_TIMEOUT_MS, maxRetries: 1 });
  const params = buildProviderParams(request, model);
  // The SDK types lag the API for output_config; the shape follows the current docs.
  const response = await client.messages.create(params as unknown as Parameters<typeof client.messages.create>[0]);
  return response as unknown as { stop_reason?: string | null; content?: { type: string; text?: string }[]; model?: string };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authorization = request.headers.get('Authorization') ?? '';
  const jwt = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  if (!jwt) return json(401, { error: 'unauthorized' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) return json(401, { error: 'unauthorized' });
  const userId = userData.user.id;
  const nowIso = new Date().toISOString();

  const flag = await admin.from('app_flags').select('enabled').eq('key', 'analysis_enabled').maybeSingle();
  if (flag.error || !(flag.data as { enabled: boolean } | null)?.enabled) return json(503, { error: 'analysis_disabled' });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(503, { error: 'provider_not_configured' });
  const model = Deno.env.get('ANTHROPIC_MODEL') || DEFAULT_MODEL;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  const validation = validateRequest(body, nowIso);
  if (!validation.ok) return json(400, { error: validation.code });
  const analysis = validation.request;
  const analysisId = analysis.analysisId;

  const limitRows = await admin.from('beta_limits').select('key, value');
  if (limitRows.error) return json(500, { error: 'limits_unavailable' });
  const limits = parseLimits((limitRows.data ?? []) as { key: string; value: number }[]);
  const usage = await readUsage(admin, userId, nowIso);
  if (!usage) return json(500, { error: 'usage_unavailable' });
  const quota = decideQuota(limits, usage, analysis.captures.length);
  if (!quota.allowed) {
    await audit(admin, analysisId, userId, 'analysis_rejected', { reason: quota.code });
    return json(429, { error: quota.code });
  }
  // Count the attempt before the paid call so a failing provider cannot be
  // retried without limit.
  if (!(await incrementUsage(admin, userId, nowIso, usage))) return json(500, { error: 'usage_unavailable' });

  await audit(admin, analysisId, userId, 'analysis_started', {
    mode: 'live',
    providerId: PROVIDER_ID,
    promptVersion: SKIN_ANALYSIS_PROMPT_VERSION,
    captureCount: analysis.captures.length,
    captureAngles: analysis.captures.map((capture) => capture.angle),
  });

  let providerResponse: Awaited<ReturnType<typeof callProvider>>;
  try {
    providerResponse = await callProvider(apiKey, model, analysis);
  } catch (error) {
    const status = typeof (error as { status?: number })?.status === 'number' ? (error as { status: number }).status : null;
    await audit(admin, analysisId, userId, 'analysis_failed', { stage: 'provider', status });
    return json(502, { error: 'provider_unavailable' });
  } finally {
    // Release the photo bytes as early as possible.
    for (const capture of analysis.captures) {
      capture.bytes = new Uint8Array(0);
      capture.base64 = '';
    }
  }

  const parsed = parseProviderResponse(providerResponse);
  if (!parsed.ok) {
    await audit(admin, analysisId, userId, 'analysis_failed', { stage: 'parse', reason: parsed.code });
    return json(502, { error: parsed.code === 'refused' ? 'provider_refused' : 'invalid_result' });
  }

  const modelVersion = typeof providerResponse.model === 'string' ? providerResponse.model : model;
  const capturedAtIso = analysis.captures[0]?.capturedAtIso ?? nowIso;
  const normalized = normalizeProviderOutput(parsed.output, { capturedAtIso, modelVersion });
  const validated = skinAnalysisSchema.safeParse(normalized);
  if (!validated.success) {
    await audit(admin, analysisId, userId, 'analysis_failed', { stage: 'schema', issueCount: validated.error.issues.length });
    return json(502, { error: 'invalid_result' });
  }
  const result = validated.data;
  if (findPhotoDataViolations(result, { allowedKeyNames: ['imageQuality'] }).length) {
    await audit(admin, analysisId, userId, 'analysis_failed', { stage: 'photo_free_scan' });
    return json(502, { error: 'invalid_result' });
  }

  const completedAtIso = new Date().toISOString();
  const classification = classify(result);
  const commonAudit = {
    mode: 'live',
    providerId: PROVIDER_ID,
    modelVersion,
    promptVersion: SKIN_ANALYSIS_PROMPT_VERSION,
    schemaVersion: SKIN_ANALYSIS_SCHEMA_VERSION,
    requestedAtIso: analysis.requestedAtIso,
    completedAtIso,
    captureAngles: analysis.captures.map((capture) => capture.angle),
    qualityDecision: classification.decision,
    imageQualityIssues: result.imageQuality.issues,
    overallConfidence: result.overallConfidence,
    limitationCount: result.limitations.length,
  };

  if (classification.decision === 'retake_requested') {
    await audit(admin, analysisId, userId, 'analysis_retake_requested', commonAudit);
    return json(200, {
      kind: 'retake_required',
      analysisId,
      imageQuality: result.imageQuality,
      instruction: classification.instruction,
    });
  }

  const insert = await admin.from('analysis_results').insert({
    user_id: userId,
    analysis_id: analysisId,
    mode: 'live',
    provider_id: PROVIDER_ID,
    model_version: modelVersion,
    prompt_version: SKIN_ANALYSIS_PROMPT_VERSION,
    schema_version: SKIN_ANALYSIS_SCHEMA_VERSION,
    requested_at: analysis.requestedAtIso,
    completed_at: completedAtIso,
    quality_decision: 'accepted',
    overall_confidence: result.overallConfidence,
    result,
  });
  if (insert.error) {
    await audit(admin, analysisId, userId, 'analysis_failed', { stage: 'persist' });
    return json(500, { error: 'persist_failed' });
  }
  await audit(admin, analysisId, userId, 'analysis_completed', commonAudit);

  return json(200, {
    kind: 'completed',
    record: {
      analysisId,
      mode: 'live',
      providerId: PROVIDER_ID,
      modelVersion,
      promptVersion: SKIN_ANALYSIS_PROMPT_VERSION,
      schemaVersion: SKIN_ANALYSIS_SCHEMA_VERSION,
      requestedAtIso: analysis.requestedAtIso,
      completedAtIso,
      captures: analysis.captures.map((capture) => ({
        angle: capture.angle,
        width: capture.width,
        height: capture.height,
        capturedAtIso: capture.capturedAtIso,
      })),
      qualityDecision: 'accepted',
      result,
    },
  });
});
