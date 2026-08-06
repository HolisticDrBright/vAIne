import { describe, expect, test } from 'vitest';
import {
  buildDeletionAuditDetail,
  DELETION_AUDIT_DETAIL_VERSION,
  validateDeletionAuditDetail,
} from '../auditDetail.ts';

function rejectionReason(value: unknown): string | null {
  const outcome = validateDeletionAuditDetail(value);
  return outcome.ok ? null : outcome.reason;
}

describe('deletion audit detail allow-list', () => {
  test('accepts the minimal and the fully populated allowed shapes', () => {
    expect(validateDeletionAuditDetail({ v: 1, stage: 'started' }).ok).toBe(true);
    expect(
      validateDeletionAuditDetail({
        v: 1,
        stage: 'storage_cleanup',
        error_code: 'storage_list_failed',
        objects_removed: 5,
        objects_remaining: 2,
      }).ok,
    ).toBe(true);
  });

  test('rejects non-objects and non-plain objects', () => {
    expect(rejectionReason(null)).toBe('not_an_object');
    expect(rejectionReason([])).toBe('not_an_object');
    expect(rejectionReason('started')).toBe('not_an_object');
    expect(rejectionReason(new Date(0))).toBe('not_a_plain_object');
  });

  test('rejects unknown keys — nothing outside the allow-list can ride along', () => {
    expect(rejectionReason({ v: 1, stage: 'started', note: 'free text' })).toBe('unknown_key');
    expect(rejectionReason({ v: 1, stage: 'started', object_names: [] })).toBe('unknown_key');
    expect(rejectionReason({ v: 1, stage: 'started', user_email: 'x' })).toBe('unknown_key');
  });

  test('rejects wrong versions, stages, and error codes', () => {
    expect(rejectionReason({ v: 2, stage: 'started' })).toBe('unsupported_version');
    expect(rejectionReason({ v: '1', stage: 'started' })).toBe('unsupported_version');
    expect(rejectionReason({ v: 1, stage: 'begun' })).toBe('invalid_stage');
    expect(rejectionReason({ v: 1, stage: 'started', error_code: 'listing file://x failed' })).toBe(
      'invalid_error_code',
    );
  });

  test('rejects out-of-bounds counts', () => {
    expect(rejectionReason({ v: 1, stage: 'completed', objects_removed: -1 })).toBe(
      'invalid_count',
    );
    expect(rejectionReason({ v: 1, stage: 'completed', objects_removed: 1.5 })).toBe(
      'invalid_count',
    );
    expect(rejectionReason({ v: 1, stage: 'completed', objects_removed: 2_000_000_000 })).toBe(
      'invalid_count',
    );
    expect(rejectionReason({ v: 1, stage: 'completed', objects_remaining: Number.NaN })).toBe(
      'invalid_count',
    );
  });

  test('builder composes only the allowed shape and matches the validator', () => {
    expect(buildDeletionAuditDetail({ stage: 'started' })).toEqual({
      v: DELETION_AUDIT_DETAIL_VERSION,
      stage: 'started',
    });
    expect(
      buildDeletionAuditDetail({
        stage: 'auth_deletion',
        errorCode: 'auth_delete_failed',
        objectsRemoved: 7,
      }),
    ).toEqual({
      v: DELETION_AUDIT_DETAIL_VERSION,
      stage: 'auth_deletion',
      error_code: 'auth_delete_failed',
      objects_removed: 7,
    });
  });
});
