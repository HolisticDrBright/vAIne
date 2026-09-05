import type { SkinCaptureAngle } from './observationTaxonomy';
import {
  SKIN_ANALYSIS_PROMPT_VERSION,
  SKIN_ANALYSIS_SCHEMA_VERSION,
  type SkinAnalysis,
} from './skinAnalysisSchema';

/**
 * Provider-independent analysis boundary.
 *
 * Implementations receive local photo references, but everything they return
 * or record is photo-free. The record types deliberately define no field for a
 * URI, image payload, or credential — which guards against accidental
 * inclusion, not against every possible bypass. Enforcement is layered on top:
 * results and audit details are validated against strict versioned allow-list
 * schemas before persistence, the backend deep-scans payloads for URI, path,
 * base64, and data-URL patterns (any case or encoding), and normalized CHECK
 * constraints in the database reject such content even from privileged code.
 * A failed live analysis must surface as `failed` or `retake_required` —
 * never as substituted synthetic content.
 */

export interface AnalysisCaptureInput {
  angle: SkinCaptureAngle;
  /** Device-local file reference. Stays inside the service implementation. */
  uri: string;
  width: number;
  height: number;
  capturedAtIso: string;
}

export interface AnalysisRequest {
  analysisId: string;
  requestedAtIso: string;
  captures: readonly AnalysisCaptureInput[];
}

/** Photo-free capture descriptor kept on records and audit entries. */
export interface AnalysisCaptureMeta {
  angle: SkinCaptureAngle;
  width: number;
  height: number;
  capturedAtIso: string;
}

export type AnalysisMode = 'synthetic_demo' | 'live';

export type AnalysisQualityDecision = 'accepted' | 'retake_requested';

export interface AnalysisRecord {
  analysisId: string;
  mode: AnalysisMode;
  providerId: string;
  modelVersion: string;
  promptVersion: string;
  schemaVersion: string;
  requestedAtIso: string;
  completedAtIso: string;
  captures: readonly AnalysisCaptureMeta[];
  qualityDecision: AnalysisQualityDecision;
  /** Validated against skinAnalysisSchema before the record is constructed. */
  result: SkinAnalysis;
}

export type AnalysisFailureKind =
  | 'service_unavailable'
  | 'invalid_result'
  | 'unexpected_error'
  | 'sign_in_required'
  | 'analysis_unavailable'
  | 'quota_exceeded'
  | 'photos_rejected'
  | 'provider_refused';

export type AnalysisOutcome =
  | { kind: 'completed'; record: AnalysisRecord }
  | {
      kind: 'retake_required';
      analysisId: string;
      imageQuality: SkinAnalysis['imageQuality'];
      /** Safe, actionable copy. Never contains image data. */
      instruction: string;
    }
  | {
      kind: 'failed';
      analysisId: string;
      failure: AnalysisFailureKind;
      /** Safe user-facing copy. Never contains image data or provider payloads. */
      message: string;
    };

export interface AnalysisServiceDescriptor {
  id: string;
  mode: AnalysisMode;
}

export interface SkinAnalysisService {
  descriptor: AnalysisServiceDescriptor;
  analyze(request: AnalysisRequest): Promise<AnalysisOutcome>;
}

/**
 * Correlation ID for one analysis run. Random and time-based only — carries no
 * device, account, or biometric information.
 */
export function createAnalysisId(): string {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `analysis-${Date.now().toString(36)}-${entropy}`;
}

export function buildAnalysisRequest(
  captures: readonly AnalysisCaptureInput[],
  nowIso: string = new Date().toISOString(),
): AnalysisRequest {
  return { analysisId: createAnalysisId(), requestedAtIso: nowIso, captures };
}

export function toCaptureMeta(capture: AnalysisCaptureInput): AnalysisCaptureMeta {
  return {
    angle: capture.angle,
    width: capture.width,
    height: capture.height,
    capturedAtIso: capture.capturedAtIso,
  };
}

/**
 * A validated result may still be unusable for presentation. Below this
 * overall confidence the app asks for a retake instead of showing weakly
 * supported observations. Provisional pre-validation threshold.
 */
export const MIN_ACCEPTABLE_OVERALL_CONFIDENCE = 0.5;

export const DEFAULT_RETAKE_INSTRUCTION =
  'The photos could not support a confident view. Please retake them in even, indirect light with your face inside the guide.';

export type ValidatedResultDecision =
  | { decision: 'accepted' }
  | { decision: 'retake_requested'; instruction: string };

export function classifyValidatedResult(result: SkinAnalysis): ValidatedResultDecision {
  if (!result.imageQuality.usable) {
    return {
      decision: 'retake_requested',
      instruction: result.imageQuality.retakeInstruction ?? DEFAULT_RETAKE_INSTRUCTION,
    };
  }
  if (result.overallConfidence < MIN_ACCEPTABLE_OVERALL_CONFIDENCE) {
    return { decision: 'retake_requested', instruction: DEFAULT_RETAKE_INSTRUCTION };
  }
  return { decision: 'accepted' };
}

export function buildAnalysisRecord(input: {
  request: AnalysisRequest;
  result: SkinAnalysis;
  descriptor: AnalysisServiceDescriptor;
  completedAtIso: string;
  qualityDecision: AnalysisQualityDecision;
}): AnalysisRecord {
  return {
    analysisId: input.request.analysisId,
    mode: input.descriptor.mode,
    providerId: input.descriptor.id,
    modelVersion: input.result.modelVersion,
    promptVersion: input.result.promptVersion,
    schemaVersion: SKIN_ANALYSIS_SCHEMA_VERSION,
    requestedAtIso: input.request.requestedAtIso,
    completedAtIso: input.completedAtIso,
    captures: input.request.captures.map(toCaptureMeta),
    qualityDecision: input.qualityDecision,
    result: input.result,
  };
}

/**
 * The only shape analysis logging is allowed to persist. Built exclusively
 * from photo-free record fields; contains no observation text either, so a
 * log line can never reproduce user-specific content.
 */
export interface AnalysisAuditEntry {
  analysisId: string;
  mode: AnalysisMode;
  providerId: string;
  modelVersion: string;
  promptVersion: string;
  schemaVersion: string;
  requestedAtIso: string;
  completedAtIso: string;
  captureTimestamps: readonly string[];
  captureAngles: readonly SkinCaptureAngle[];
  qualityDecision: AnalysisQualityDecision;
  imageQualityIssues: readonly string[];
  overallConfidence: number;
  limitationCount: number;
}

export function buildAnalysisAuditEntry(record: AnalysisRecord): AnalysisAuditEntry {
  return {
    analysisId: record.analysisId,
    mode: record.mode,
    providerId: record.providerId,
    modelVersion: record.modelVersion,
    promptVersion: record.promptVersion,
    schemaVersion: record.schemaVersion,
    requestedAtIso: record.requestedAtIso,
    completedAtIso: record.completedAtIso,
    captureTimestamps: record.captures.map((capture) => capture.capturedAtIso),
    captureAngles: record.captures.map((capture) => capture.angle),
    qualityDecision: record.qualityDecision,
    imageQualityIssues: record.result.imageQuality.issues,
    overallConfidence: record.result.overallConfidence,
    limitationCount: record.result.limitations.length,
  };
}

const FAILURE_MESSAGES: Record<AnalysisFailureKind, string> = {
  service_unavailable:
    'The analysis service could not be reached. Your photos stay on this device; please try again.',
  invalid_result:
    'The analysis response did not pass validation and was discarded. No substitute result was shown.',
  unexpected_error:
    'The analysis could not be completed. Your photos stay on this device; please try again.',
  sign_in_required:
    'Sign in to run a live analysis. Your photos stay on this device until then.',
  analysis_unavailable:
    'Live analysis is switched off right now. Your photos stay on this device; please try again later.',
  quota_exceeded:
    'You have reached the beta limit for analyses for now. Your photos stay on this device; please try again later.',
  photos_rejected:
    'These photos could not be accepted for analysis. Please retake them and try again.',
  provider_refused:
    'The analysis service declined to describe these photos. No result was produced; please try again with clear, well-lit photos of your face.',
};

export function describeAnalysisFailure(kind: AnalysisFailureKind): string {
  return FAILURE_MESSAGES[kind];
}

export const ANALYSIS_CONTRACT_VERSIONS = {
  promptVersion: SKIN_ANALYSIS_PROMPT_VERSION,
  schemaVersion: SKIN_ANALYSIS_SCHEMA_VERSION,
} as const;
