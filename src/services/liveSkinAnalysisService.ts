import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  buildAnalysisRecord,
  classifyValidatedResult,
  describeAnalysisFailure,
  type AnalysisCaptureInput,
  type AnalysisFailureKind,
  type AnalysisOutcome,
  type AnalysisRequest,
  type AnalysisServiceDescriptor,
  type SkinAnalysisService,
} from '../domain/analysis/analysisService';
import { skinAnalysisSchema } from '../domain/analysis/skinAnalysisSchema';
import { prepareCaptureForUpload, type PreparedCapture } from './imagePreparation';
import { getSupabaseClient } from './supabaseClient';

/**
 * Live implementation of the analysis boundary. Photos are re-encoded on the
 * phone, sent once to the analyze-skin Edge Function, and handled there in
 * memory only; what comes back is re-validated against the strict schema
 * before it can be shown. There is no synthetic fallback: every failure is a
 * typed failure with honest copy.
 */

export const LIVE_ANALYSIS_DESCRIPTOR: AnalysisServiceDescriptor = { id: 'anthropic-vision-v1', mode: 'live' };

export interface LiveAnalysisInvokeResult {
  data: unknown;
  /** Generic error code from the function, or a transport failure. */
  error: { code: string; status: number | null } | null;
}

export interface LiveAnalysisDeps {
  /** Resolves to null when there is no signed-in session. */
  hasSession: () => Promise<boolean>;
  prepareCapture: (capture: AnalysisCaptureInput) => Promise<PreparedCapture>;
  invoke: (body: Record<string, unknown>) => Promise<LiveAnalysisInvokeResult>;
  descriptor?: AnalysisServiceDescriptor;
}

const ERROR_TO_FAILURE: Record<string, AnalysisFailureKind> = {
  unauthorized: 'sign_in_required',
  analysis_disabled: 'analysis_unavailable',
  provider_not_configured: 'analysis_unavailable',
  quota_daily: 'quota_exceeded',
  quota_monthly: 'quota_exceeded',
  quota_global: 'quota_exceeded',
  beta_full: 'quota_exceeded',
  too_many_images: 'photos_rejected',
  invalid_body: 'photos_rejected',
  invalid_analysis_id: 'unexpected_error',
  no_captures: 'photos_rejected',
  too_many_captures: 'photos_rejected',
  duplicate_angle: 'photos_rejected',
  invalid_angle: 'photos_rejected',
  invalid_dimensions: 'photos_rejected',
  invalid_timestamp: 'photos_rejected',
  not_jpeg: 'photos_rejected',
  image_too_large: 'photos_rejected',
  invalid_preferences: 'unexpected_error',
  provider_unavailable: 'service_unavailable',
  provider_refused: 'provider_refused',
  invalid_result: 'invalid_result',
  persist_failed: 'service_unavailable',
};

export function mapFunctionError(code: string | null | undefined): AnalysisFailureKind {
  if (!code) return 'service_unavailable';
  return ERROR_TO_FAILURE[code] ?? 'service_unavailable';
}

function failure(analysisId: string, kind: AnalysisFailureKind): AnalysisOutcome {
  return { kind: 'failed', analysisId, failure: kind, message: describeAnalysisFailure(kind) };
}

export function createLiveSkinAnalysisService(deps: LiveAnalysisDeps): SkinAnalysisService {
  const descriptor = deps.descriptor ?? LIVE_ANALYSIS_DESCRIPTOR;
  return {
    descriptor,
    async analyze(request: AnalysisRequest): Promise<AnalysisOutcome> {
      if (!(await deps.hasSession())) return failure(request.analysisId, 'sign_in_required');
      if (request.captures.length === 0) return failure(request.analysisId, 'photos_rejected');

      let prepared: PreparedCapture[];
      try {
        prepared = await Promise.all(request.captures.map((capture) => deps.prepareCapture(capture)));
      } catch {
        return failure(request.analysisId, 'photos_rejected');
      }

      const { data, error } = await deps.invoke({
        analysisId: request.analysisId,
        captures: prepared,
        goals: [],
        sensitivityPreference: 'standard',
      });
      // Drop the encoded bytes as soon as the request is over.
      for (const capture of prepared) capture.jpegBase64 = '';

      if (error) return failure(request.analysisId, mapFunctionError(error.code));
      if (typeof data !== 'object' || data === null) return failure(request.analysisId, 'invalid_result');
      const payload = data as { kind?: string; instruction?: string; imageQuality?: unknown; record?: { result?: unknown; completedAtIso?: string; modelVersion?: string } };

      if (payload.kind === 'retake_required') {
        const quality = skinAnalysisSchema.shape.imageQuality.safeParse(payload.imageQuality);
        return {
          kind: 'retake_required',
          analysisId: request.analysisId,
          imageQuality: quality.success ? quality.data : { usable: false, issues: [], retakeInstruction: null },
          instruction: typeof payload.instruction === 'string' && payload.instruction.trim()
            ? payload.instruction
            : 'The photos could not support a confident view. Please retake them.',
        };
      }
      if (payload.kind !== 'completed' || !payload.record) return failure(request.analysisId, 'invalid_result');

      // Never trust the wire: re-validate against the same strict schema.
      const validated = skinAnalysisSchema.safeParse(payload.record.result);
      if (!validated.success) return failure(request.analysisId, 'invalid_result');
      const result = validated.data;
      const classification = classifyValidatedResult(result);
      if (classification.decision === 'retake_requested') {
        return { kind: 'retake_required', analysisId: request.analysisId, imageQuality: result.imageQuality, instruction: classification.instruction };
      }
      return {
        kind: 'completed',
        record: buildAnalysisRecord({
          request,
          result,
          descriptor: { id: descriptor.id, mode: 'live' },
          completedAtIso: typeof payload.record.completedAtIso === 'string' ? payload.record.completedAtIso : new Date().toISOString(),
          qualityDecision: 'accepted',
        }),
      };
    },
  };
}

/** The production wiring: Supabase session + Edge Function + on-device re-encode. */
export const liveSkinAnalysisService: SkinAnalysisService = createLiveSkinAnalysisService({
  async hasSession() {
    const client = getSupabaseClient();
    if (!client) return false;
    const { data } = await client.auth.getSession();
    return Boolean(data.session);
  },
  prepareCapture: prepareCaptureForUpload,
  async invoke(body) {
    const client = getSupabaseClient();
    if (!client) return { data: null, error: { code: 'analysis_disabled', status: null } };
    try {
      const { data, error } = await client.functions.invoke('analyze-skin', { method: 'POST', body });
      if (!error) return { data, error: null };
      if (error instanceof FunctionsHttpError) {
        const parsed = await error.context.json().catch(() => null) as { error?: string } | null;
        return { data: null, error: { code: parsed?.error ?? 'service_unavailable', status: error.context.status } };
      }
      return { data: null, error: { code: 'service_unavailable', status: null } };
    } catch {
      return { data: null, error: { code: 'service_unavailable', status: null } };
    }
  },
});
