/**
 * Versioned allow-list schema for the `detail` column of deletion-lifecycle
 * audit rows. This is the primary photo-free control for account deletion:
 * a detail is composed only from the exact keys below, with closed enums and
 * bounded integers — free text, identifiers, names, and paths cannot be
 * expressed at all. The deep scanner (photoFree.ts) then re-screens the
 * composed value as a backstop, and a normalized CHECK constraint in the
 * database sits beneath both.
 */

import { findPhotoDataViolations } from '../_shared/photoFree.ts';

export const DELETION_AUDIT_DETAIL_VERSION = 1;

export const DELETION_AUDIT_EVENTS = [
  'account_deletion_started',
  'account_deletion_failed',
  'account_deleted',
] as const;
export type DeletionAuditEvent = (typeof DELETION_AUDIT_EVENTS)[number];

export const DELETION_STAGES = [
  'started',
  'storage_cleanup',
  'database_cleanup',
  'auth_deletion',
  'completed',
] as const;
export type DeletionStage = (typeof DELETION_STAGES)[number];

export const DELETION_ERROR_CODES = [
  'freshness_check_failed',
  'audit_write_failed',
  'storage_list_failed',
  'storage_remove_failed',
  'storage_verify_failed',
  'database_delete_failed',
  'auth_delete_failed',
] as const;
export type DeletionErrorCode = (typeof DELETION_ERROR_CODES)[number];

export interface DeletionAuditDetail {
  v: typeof DELETION_AUDIT_DETAIL_VERSION;
  stage: DeletionStage;
  error_code?: DeletionErrorCode;
  objects_removed?: number;
  objects_remaining?: number;
}

const ALLOWED_DETAIL_KEYS = [
  'v',
  'stage',
  'error_code',
  'objects_removed',
  'objects_remaining',
] as const;

const MAX_COUNT = 1_000_000_000;

export type AuditDetailValidation =
  | { ok: true; detail: DeletionAuditDetail }
  | { ok: false; reason: string };

function isBoundedCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;
}

/**
 * Strict validation: plain object, exactly the allowed keys, closed enums,
 * bounded non-negative integer counts, and a clean deep photo-free scan.
 * Anything else — extra keys, wrong types, free text — is rejected.
 */
export function validateDeletionAuditDetail(value: unknown): AuditDetailValidation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, reason: 'not_an_object' };
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return { ok: false, reason: 'not_a_plain_object' };
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(ALLOWED_DETAIL_KEYS as readonly string[]).includes(key)) {
      return { ok: false, reason: 'unknown_key' };
    }
  }
  if (record.v !== DELETION_AUDIT_DETAIL_VERSION) {
    return { ok: false, reason: 'unsupported_version' };
  }
  if (!(DELETION_STAGES as readonly unknown[]).includes(record.stage)) {
    return { ok: false, reason: 'invalid_stage' };
  }
  if (
    record.error_code !== undefined &&
    !(DELETION_ERROR_CODES as readonly unknown[]).includes(record.error_code)
  ) {
    return { ok: false, reason: 'invalid_error_code' };
  }
  if (record.objects_removed !== undefined && !isBoundedCount(record.objects_removed)) {
    return { ok: false, reason: 'invalid_count' };
  }
  if (record.objects_remaining !== undefined && !isBoundedCount(record.objects_remaining)) {
    return { ok: false, reason: 'invalid_count' };
  }
  if (findPhotoDataViolations(record).length > 0) {
    return { ok: false, reason: 'photo_free_scan_failed' };
  }
  return { ok: true, detail: record as unknown as DeletionAuditDetail };
}

/**
 * The only constructor deletion code uses. It can express nothing but the
 * allow-listed shape, and it still validates the result so an internal bug
 * can never emit an out-of-policy detail.
 */
export function buildDeletionAuditDetail(input: {
  stage: DeletionStage;
  errorCode?: DeletionErrorCode;
  objectsRemoved?: number;
  objectsRemaining?: number;
}): DeletionAuditDetail {
  const detail: DeletionAuditDetail = { v: DELETION_AUDIT_DETAIL_VERSION, stage: input.stage };
  if (input.errorCode !== undefined) detail.error_code = input.errorCode;
  if (input.objectsRemoved !== undefined) detail.objects_removed = input.objectsRemoved;
  if (input.objectsRemaining !== undefined) detail.objects_remaining = input.objectsRemaining;
  const validated = validateDeletionAuditDetail(detail);
  if (!validated.ok) {
    throw new Error(`internal: composed audit detail rejected (${validated.reason})`);
  }
  return validated.detail;
}
