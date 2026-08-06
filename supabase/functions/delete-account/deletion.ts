/**
 * Account-deletion orchestrator: pure, dependency-injected, and fail-safe.
 *
 * Guarantees, in order of precedence:
 *
 * 1. Reauthentication proof comes from the session record, not token claims:
 *    a Supabase session is created at sign-in (token refresh reuses it), so
 *    `auth.sessions.created_at` for the caller's `session_id` claim is the
 *    time of the last genuine Apple sign-in ceremony. Older than the window
 *    (or unknown) means reauthenticate — never proceed.
 * 2. Nothing is deleted before an `account_deletion_started` audit row is
 *    durably written.
 * 3. Any storage listing error stops deletion; listing paginates past 1,000
 *    objects and walks nested folders, so an incomplete listing can never be
 *    mistaken for a complete one.
 * 4. Every removal result is checked (including per-batch counts), and the
 *    prefix is re-listed afterwards to verify nothing remains, before any
 *    irreversible step.
 * 5. Every database operation's result is checked.
 * 6. The Auth user is deleted only after storage and database cleanup fully
 *    succeed, so a failed attempt leaves the account signed-in-able and the
 *    endpoint retryable: repeated calls converge to full deletion.
 * 7. `account_deleted` is written only after Auth deletion succeeds; failures
 *    write `account_deletion_failed`. Details carry only allow-listed enums
 *    and counts — never object names, URLs, emails, or tokens.
 */

import {
  buildDeletionAuditDetail,
  type DeletionAuditDetail,
  type DeletionAuditEvent,
  type DeletionErrorCode,
  type DeletionStage,
} from './auditDetail.ts';

export const SESSION_FRESHNESS_WINDOW_MS = 10 * 60 * 1000;
/** Tolerated clock skew when a session's created_at is slightly in the future. */
export const SESSION_CLOCK_SKEW_MS = 60 * 1000;
export const STORAGE_LIST_PAGE_SIZE = 1000;
export const STORAGE_REMOVE_CHUNK_SIZE = 100;
/** Fail-safe ceilings: exceeding any of these aborts instead of guessing. */
export const MAX_STORAGE_OBJECTS = 100_000;
export const MAX_STORAGE_FOLDERS = 10_000;
export const MAX_STORAGE_DEPTH = 8;

/** Tables holding per-user rows that deletion removes wholesale. */
export const USER_ROW_TABLES = ['analysis_results', 'usage_counters'] as const;
export type UserRowTable = (typeof USER_ROW_TABLES)[number];

export interface StorageEntry {
  name: string;
  isFolder: boolean;
}

export interface DeletionDeps {
  /**
   * Resolves the creation time of the caller's session (auth.sessions row).
   * `createdAtIso: null` means the session does not exist for this user.
   */
  sessionCreatedAt(
    userId: string,
    sessionId: string,
  ): Promise<{ ok: true; createdAtIso: string | null } | { ok: false }>;
  /** One page of a storage folder listing, offset-paginated, stable order. */
  listFolderPage(
    prefix: string,
    offset: number,
    limit: number,
  ): Promise<{ ok: true; entries: StorageEntry[] } | { ok: false }>;
  /** Removes objects by full path; reports how many were actually removed. */
  removeObjects(paths: string[]): Promise<{ ok: true; removedCount: number } | { ok: false }>;
  /** Deletes all of a user's rows in one table; ok reflects the operation, not the row count. */
  deleteUserRows(table: UserRowTable, userId: string): Promise<{ ok: boolean }>;
  /**
   * Deletes the user's historical audit rows while preserving
   * deletion-lifecycle rows, so started/failed/completed semantics survive.
   */
  deleteUserAuditHistory(userId: string): Promise<{ ok: boolean }>;
  insertAudit(
    event: DeletionAuditEvent,
    userId: string,
    detail: DeletionAuditDetail,
  ): Promise<{ ok: boolean }>;
  deleteAuthUser(userId: string): Promise<{ ok: boolean }>;
  nowMs(): number;
}

export type DeletionRunResult =
  | { status: 'completed'; objectsRemoved: number }
  | { status: 'reauth_required' }
  | { status: 'failed'; code: DeletionErrorCode };

type ListingResult = { ok: true; files: string[] } | { ok: false };

/**
 * Breadth-first, fully paginated listing of every object under `prefix`.
 * Any listing error, malformed entry, or exceeded ceiling returns not-ok —
 * deletion never proceeds on a listing it cannot trust.
 */
async function listAllObjects(deps: DeletionDeps, prefix: string): Promise<ListingResult> {
  const files: string[] = [];
  const folders: string[] = [prefix];
  let foldersSeen = 1;

  while (folders.length > 0) {
    const folder = folders.shift() as string;
    const depth = folder.split('/').length;
    if (depth > MAX_STORAGE_DEPTH) return { ok: false };

    let offset = 0;
    for (;;) {
      const page = await deps.listFolderPage(folder, offset, STORAGE_LIST_PAGE_SIZE);
      if (!page.ok) return { ok: false };
      for (const entry of page.entries) {
        if (entry.name.length === 0 || entry.name.includes('/')) return { ok: false };
        const fullPath = `${folder}/${entry.name}`;
        if (entry.isFolder) {
          foldersSeen += 1;
          if (foldersSeen > MAX_STORAGE_FOLDERS) return { ok: false };
          folders.push(fullPath);
        } else {
          files.push(fullPath);
          if (files.length > MAX_STORAGE_OBJECTS) return { ok: false };
        }
      }
      if (page.entries.length < STORAGE_LIST_PAGE_SIZE) break;
      offset += STORAGE_LIST_PAGE_SIZE;
    }
  }
  return { ok: true, files };
}

function isSessionFresh(createdAtIso: string, nowMs: number): boolean | null {
  const createdMs = Date.parse(createdAtIso);
  if (Number.isNaN(createdMs)) return null;
  const age = nowMs - createdMs;
  return age >= -SESSION_CLOCK_SKEW_MS && age <= SESSION_FRESHNESS_WINDOW_MS;
}

export async function runAccountDeletion(
  userId: string,
  sessionId: string,
  deps: DeletionDeps,
): Promise<DeletionRunResult> {
  if (userId.length === 0 || sessionId.length === 0) {
    return { status: 'reauth_required' };
  }

  // 1. Recent-sign-in proof from the session record. Fail closed on lookup
  //    errors: an unverifiable freshness claim is not a fresh sign-in.
  const session = await deps.sessionCreatedAt(userId, sessionId);
  if (!session.ok) return { status: 'failed', code: 'freshness_check_failed' };
  if (session.createdAtIso === null) return { status: 'reauth_required' };
  const fresh = isSessionFresh(session.createdAtIso, deps.nowMs());
  if (fresh === null) return { status: 'failed', code: 'freshness_check_failed' };
  if (!fresh) return { status: 'reauth_required' };

  const failWithAudit = async (
    code: DeletionErrorCode,
    stage: DeletionStage,
    counts: { objectsRemoved?: number; objectsRemaining?: number } = {},
  ): Promise<DeletionRunResult> => {
    // Best-effort: the failure audit must never mask the underlying failure.
    await deps
      .insertAudit(
        'account_deletion_failed',
        userId,
        buildDeletionAuditDetail({ stage, errorCode: code, ...counts }),
      )
      .catch(() => ({ ok: false }));
    return { status: 'failed', code };
  };

  // 2. Durable record that deletion began — without it, nothing is deleted.
  const started = await deps
    .insertAudit('account_deletion_started', userId, buildDeletionAuditDetail({ stage: 'started' }))
    .catch(() => ({ ok: false }));
  if (!started.ok) return { status: 'failed', code: 'audit_write_failed' };

  // 3. Complete, paginated storage listing.
  const listing = await listAllObjects(deps, userId);
  if (!listing.ok) return failWithAudit('storage_list_failed', 'storage_cleanup');

  // 4. Checked removal in bounded batches.
  let objectsRemoved = 0;
  for (let start = 0; start < listing.files.length; start += STORAGE_REMOVE_CHUNK_SIZE) {
    const chunk = listing.files.slice(start, start + STORAGE_REMOVE_CHUNK_SIZE);
    const removal = await deps.removeObjects(chunk).catch(() => ({ ok: false as const }));
    if (!removal.ok || removal.removedCount !== chunk.length) {
      return failWithAudit('storage_remove_failed', 'storage_cleanup', { objectsRemoved });
    }
    objectsRemoved += removal.removedCount;
  }

  // 5. Independent verification that the prefix is actually empty.
  const verification = await listAllObjects(deps, userId);
  if (!verification.ok) {
    return failWithAudit('storage_verify_failed', 'storage_cleanup', { objectsRemoved });
  }
  if (verification.files.length > 0) {
    return failWithAudit('storage_verify_failed', 'storage_cleanup', {
      objectsRemoved,
      objectsRemaining: verification.files.length,
    });
  }

  // 6. Checked database cleanup; audit history last, lifecycle rows preserved.
  for (const table of USER_ROW_TABLES) {
    const outcome = await deps.deleteUserRows(table, userId).catch(() => ({ ok: false }));
    if (!outcome.ok) {
      return failWithAudit('database_delete_failed', 'database_cleanup', { objectsRemoved });
    }
  }
  const auditHistory = await deps.deleteUserAuditHistory(userId).catch(() => ({ ok: false }));
  if (!auditHistory.ok) {
    return failWithAudit('database_delete_failed', 'database_cleanup', { objectsRemoved });
  }

  // 7. Only now is the irreversible step allowed.
  const authDeletion = await deps.deleteAuthUser(userId).catch(() => ({ ok: false }));
  if (!authDeletion.ok) {
    return failWithAudit('auth_delete_failed', 'auth_deletion', { objectsRemoved });
  }

  // 8. Completion record strictly after Auth deletion succeeded; best-effort
  //    because the deletion itself is already done and must be reported.
  await deps
    .insertAudit(
      'account_deleted',
      userId,
      buildDeletionAuditDetail({ stage: 'completed', objectsRemoved }),
    )
    .catch(() => ({ ok: false }));

  return { status: 'completed', objectsRemoved };
}
