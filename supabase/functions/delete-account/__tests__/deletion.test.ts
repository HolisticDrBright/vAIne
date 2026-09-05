import { describe, expect, test } from 'vitest';
import {
  runAccountDeletion,
  SESSION_FRESHNESS_WINDOW_MS,
  STORAGE_LIST_PAGE_SIZE,
  STORAGE_REMOVE_CHUNK_SIZE,
  USER_ROW_TABLES,
  type DeletionDeps,
} from '../deletion.ts';
import { validateDeletionAuditDetail, type DeletionAuditDetail } from '../auditDetail.ts';
import { findPhotoDataViolations } from '../../_shared/photoFree.ts';

const USER = '11111111-2222-3333-4444-555555555555';
const SESSION = '99999999-8888-7777-6666-555555555555';
const NOW = Date.parse('2026-08-06T12:00:00Z');
const FRESH_SIGN_IN = new Date(NOW - 60_000).toISOString();

interface HarnessOptions {
  objects?: string[];
  sessionCreatedAtIso?: string | null;
  sessionLookupFails?: boolean;
  failListOnCall?: number;
  failRemoveOnCall?: number;
  undercountRemoval?: boolean;
  /** Report successful removal without actually removing (verify must catch). */
  removalLies?: boolean;
  failTable?: (typeof USER_ROW_TABLES)[number];
  failAuditHistory?: boolean;
  failAuditOnEvent?: string;
  auditThrowsOnEvent?: string;
  failAuthDelete?: boolean;
  malformedListing?: boolean;
}

interface Harness {
  deps: DeletionDeps;
  state: { objects: Set<string> };
  calls: string[];
  audits: Array<{ event: string; userId: string; detail: DeletionAuditDetail }>;
  removedPaths: string[];
  listCalls: number;
  removeCalls: number;
}

function createHarness(options: HarnessOptions = {}): Harness {
  const state = { objects: new Set(options.objects ?? []) };
  const harness: Harness = {
    deps: undefined as unknown as DeletionDeps,
    state,
    calls: [],
    audits: [],
    removedPaths: [],
    listCalls: 0,
    removeCalls: 0,
  };

  harness.deps = {
    async sessionCreatedAt(userId, sessionId) {
      harness.calls.push(`session:${userId === USER && sessionId === SESSION}`);
      if (options.sessionLookupFails) return { ok: false };
      const iso =
        options.sessionCreatedAtIso === undefined ? FRESH_SIGN_IN : options.sessionCreatedAtIso;
      return { ok: true, createdAtIso: iso };
    },
    async listFolderPage(prefix, offset, limit) {
      harness.listCalls += 1;
      harness.calls.push(`list:${prefix}@${offset}`);
      if (options.failListOnCall === harness.listCalls) return { ok: false };
      if (options.malformedListing) {
        return { ok: true, entries: [{ name: 'bad/name.jpg', isFolder: false }] };
      }
      const children = new Map<string, boolean>();
      for (const path of state.objects) {
        if (!path.startsWith(`${prefix}/`)) continue;
        const rest = path.slice(prefix.length + 1);
        const slash = rest.indexOf('/');
        if (slash === -1) children.set(rest, false);
        else children.set(rest.slice(0, slash), true);
      }
      const sorted = [...children.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
      const entries = sorted
        .slice(offset, offset + limit)
        .map(([name, isFolder]) => ({ name, isFolder }));
      return { ok: true, entries };
    },
    async removeObjects(paths) {
      harness.removeCalls += 1;
      harness.calls.push(`remove:${paths.length}`);
      if (options.failRemoveOnCall === harness.removeCalls) return { ok: false };
      let removed = 0;
      for (const path of paths) {
        if (!state.objects.has(path)) continue;
        removed += 1;
        if (!options.removalLies) state.objects.delete(path);
        harness.removedPaths.push(path);
      }
      if (options.removalLies) return { ok: true, removedCount: paths.length };
      if (options.undercountRemoval) return { ok: true, removedCount: removed - 1 };
      return { ok: true, removedCount: removed };
    },
    async deleteUserRows(table, userId) {
      harness.calls.push(`table:${table}:${userId === USER}`);
      return { ok: options.failTable !== table };
    },
    async deleteUserAuditHistory(userId) {
      harness.calls.push(`auditHistory:${userId === USER}`);
      return { ok: !options.failAuditHistory };
    },
    async insertAudit(event, userId, detail) {
      harness.calls.push(`audit:${event}`);
      if (options.auditThrowsOnEvent === event) throw new Error('audit insert exploded');
      if (options.failAuditOnEvent === event) return { ok: false };
      harness.audits.push({ event, userId, detail });
      return { ok: true };
    },
    async deleteAuthUser(userId) {
      harness.calls.push(`authDelete:${userId === USER}`);
      return { ok: !options.failAuthDelete };
    },
    nowMs: () => NOW,
  };
  return harness;
}

/** Every recorded audit detail must be allow-list valid, photo-free, and path-free. */
function expectAuditsSafe(harness: Harness, initialObjects: string[]): void {
  for (const { event, detail } of harness.audits) {
    const validated = validateDeletionAuditDetail(detail);
    expect(validated.ok, `audit ${event} detail failed allow-list`).toBe(true);
    expect(findPhotoDataViolations(detail)).toEqual([]);
    const serialized = JSON.stringify(detail);
    for (const path of initialObjects) {
      expect(serialized).not.toContain(path);
      const leaf = path.split('/').pop() as string;
      expect(serialized).not.toContain(leaf);
    }
    expect(serialized).not.toContain(USER);
  }
}

function authDeleted(harness: Harness): boolean {
  return harness.calls.includes('authDelete:true');
}

const NESTED_OBJECTS = [
  `${USER}/a1/r1/front.jpg`,
  `${USER}/a1/r1/left.jpg`,
  `${USER}/a2/r2/front.jpg`,
];

describe('session freshness gate (documented session-based proof)', () => {
  test('a sign-in older than the window demands reauthentication before anything runs', async () => {
    const stale = new Date(NOW - SESSION_FRESHNESS_WINDOW_MS - 1000).toISOString();
    const harness = createHarness({ objects: NESTED_OBJECTS, sessionCreatedAtIso: stale });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'reauth_required' });
    expect(harness.listCalls).toBe(0);
    expect(harness.audits).toEqual([]);
    expect(authDeleted(harness)).toBe(false);
    expect(harness.state.objects.size).toBe(NESTED_OBJECTS.length);
  });

  test('an unknown session id demands reauthentication', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, sessionCreatedAtIso: null });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'reauth_required' });
    expect(harness.state.objects.size).toBe(NESTED_OBJECTS.length);
  });

  test('a session lookup error fails closed instead of assuming freshness', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, sessionLookupFails: true });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'freshness_check_failed' });
    expect(harness.listCalls).toBe(0);
    expect(authDeleted(harness)).toBe(false);
  });

  test('a session dated implausibly in the future is not treated as fresh', async () => {
    const future = new Date(NOW + 10 * 60 * 1000).toISOString();
    const harness = createHarness({ objects: NESTED_OBJECTS, sessionCreatedAtIso: future });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'reauth_required' });
  });

  test('an unparseable created_at fails closed', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, sessionCreatedAtIso: 'not-a-date' });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'freshness_check_failed' });
  });

  test('missing identifiers demand reauthentication', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS });
    expect(await runAccountDeletion('', SESSION, harness.deps)).toEqual({
      status: 'reauth_required',
    });
    expect(await runAccountDeletion(USER, '', harness.deps)).toEqual({
      status: 'reauth_required',
    });
    expect(harness.listCalls).toBe(0);
  });
});

describe('successful deletion', () => {
  test('walks nested folders, paginates past one page, removes everything, then deletes the user', async () => {
    const bigFolder = Array.from(
      { length: STORAGE_LIST_PAGE_SIZE + 50 },
      (_, index) => `${USER}/a1/r1/f${String(index).padStart(4, '0')}.jpg`,
    );
    const objects = [...bigFolder, ...NESTED_OBJECTS];
    const harness = createHarness({ objects });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);

    expect(result).toEqual({ status: 'completed', objectsRemoved: objects.length });
    expect(harness.state.objects.size).toBe(0);
    expect(new Set(harness.removedPaths)).toEqual(new Set(objects));
    // Pagination actually happened: the large folder needed a second page.
    expect(harness.calls).toContain(`list:${USER}/a1/r1@${STORAGE_LIST_PAGE_SIZE}`);
    // Batches stay bounded.
    for (const call of harness.calls.filter((entry) => entry.startsWith('remove:'))) {
      expect(Number(call.split(':')[1])).toBeLessThanOrEqual(STORAGE_REMOVE_CHUNK_SIZE);
    }

    const sequence = harness.calls;
    const startedIndex = sequence.indexOf('audit:account_deletion_started');
    const firstRemoveIndex = sequence.findIndex((entry) => entry.startsWith('remove:'));
    const authIndex = sequence.indexOf('authDelete:true');
    const completedIndex = sequence.indexOf('audit:account_deleted');
    expect(startedIndex).toBeGreaterThanOrEqual(0);
    expect(firstRemoveIndex).toBeGreaterThan(startedIndex);
    expect(authIndex).toBeGreaterThan(firstRemoveIndex);
    expect(completedIndex).toBeGreaterThan(authIndex);
    // Database cleanup ran for every table plus audit history, before auth deletion.
    for (const table of USER_ROW_TABLES) {
      expect(sequence.indexOf(`table:${table}:true`)).toBeLessThan(authIndex);
    }
    expect(sequence.indexOf('auditHistory:true')).toBeLessThan(authIndex);

    expect(harness.audits.map((audit) => audit.event)).toEqual([
      'account_deletion_started',
      'account_deleted',
    ]);
    expect(harness.audits[1].detail.objects_removed).toBe(objects.length);
    expectAuditsSafe(harness, objects);
  });

  test('an already-clean account converges: empty storage, empty tables, user deleted', async () => {
    const harness = createHarness({ objects: [] });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'completed', objectsRemoved: 0 });
    expect(harness.removeCalls).toBe(0);
    expect(authDeleted(harness)).toBe(true);
    expectAuditsSafe(harness, []);
  });

  test('a failed completion audit does not turn a finished deletion into a reported failure', async () => {
    const harness = createHarness({
      objects: NESTED_OBJECTS,
      failAuditOnEvent: 'account_deleted',
    });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'completed', objectsRemoved: NESTED_OBJECTS.length });
    expect(authDeleted(harness)).toBe(true);
  });
});

describe('audit gating', () => {
  test('a failed started-audit write stops deletion before anything is touched', async () => {
    const harness = createHarness({
      objects: NESTED_OBJECTS,
      failAuditOnEvent: 'account_deletion_started',
    });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'audit_write_failed' });
    expect(harness.listCalls).toBe(0);
    expect(harness.removeCalls).toBe(0);
    expect(authDeleted(harness)).toBe(false);
    expect(harness.state.objects.size).toBe(NESTED_OBJECTS.length);
  });

  test('a throwing started-audit write is treated identically', async () => {
    const harness = createHarness({
      objects: NESTED_OBJECTS,
      auditThrowsOnEvent: 'account_deletion_started',
    });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'audit_write_failed' });
    expect(authDeleted(harness)).toBe(false);
  });

  test('account_deleted is never written when auth deletion fails', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, failAuthDelete: true });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'auth_delete_failed' });
    const events = harness.audits.map((audit) => audit.event);
    expect(events).toContain('account_deletion_failed');
    expect(events).not.toContain('account_deleted');
    expectAuditsSafe(harness, NESTED_OBJECTS);
  });
});

describe('storage failure modes', () => {
  test('a listing error partway through the walk stops deletion with zero removals', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, failListOnCall: 2 });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'storage_list_failed' });
    expect(harness.removeCalls).toBe(0);
    expect(authDeleted(harness)).toBe(false);
    expect(harness.state.objects.size).toBe(NESTED_OBJECTS.length);
    expect(harness.audits.map((audit) => audit.event)).toEqual([
      'account_deletion_started',
      'account_deletion_failed',
    ]);
    expectAuditsSafe(harness, NESTED_OBJECTS);
  });

  test('a malformed listing entry is refused rather than guessed at', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, malformedListing: true });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'storage_list_failed' });
    expect(authDeleted(harness)).toBe(false);
  });

  test('a storage removal error preserves the auth user and reports honestly', async () => {
    const objects = Array.from(
      { length: STORAGE_REMOVE_CHUNK_SIZE + 10 },
      (_, index) => `${USER}/a1/r1/f${String(index).padStart(3, '0')}.jpg`,
    );
    const harness = createHarness({ objects, failRemoveOnCall: 2 });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'storage_remove_failed' });
    expect(authDeleted(harness)).toBe(false);
    expect(harness.calls.some((call) => call.startsWith('table:'))).toBe(false);
    const failure = harness.audits.find((audit) => audit.event === 'account_deletion_failed');
    expect(failure?.detail.objects_removed).toBe(STORAGE_REMOVE_CHUNK_SIZE);
    expectAuditsSafe(harness, objects);
  });

  test('a removal undercount is a failure, not a shrug', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, undercountRemoval: true });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'storage_remove_failed' });
    expect(authDeleted(harness)).toBe(false);
  });

  test('objects still present after removal are caught by re-verification', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, removalLies: true });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'storage_verify_failed' });
    expect(authDeleted(harness)).toBe(false);
    const failure = harness.audits.find((audit) => audit.event === 'account_deletion_failed');
    expect(failure?.detail.objects_remaining).toBe(NESTED_OBJECTS.length);
    expectAuditsSafe(harness, NESTED_OBJECTS);
  });
});

describe('database and auth failure modes', () => {
  test.each(USER_ROW_TABLES)('a %s delete failure preserves the auth user', async (table) => {
    const harness = createHarness({ objects: NESTED_OBJECTS, failTable: table });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'database_delete_failed' });
    expect(authDeleted(harness)).toBe(false);
    expectAuditsSafe(harness, NESTED_OBJECTS);
  });

  test('an audit-history delete failure preserves the auth user', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, failAuditHistory: true });
    const result = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(result).toEqual({ status: 'failed', code: 'database_delete_failed' });
    expect(authDeleted(harness)).toBe(false);
  });

  test('an auth deletion failure after full cleanup is retryable to completion', async () => {
    const harness = createHarness({ objects: NESTED_OBJECTS, failAuthDelete: true });
    const first = await runAccountDeletion(USER, SESSION, harness.deps);
    expect(first).toEqual({ status: 'failed', code: 'auth_delete_failed' });
    expect(harness.state.objects.size).toBe(0);

    const retry = createHarness({ objects: [...harness.state.objects] });
    const second = await runAccountDeletion(USER, SESSION, retry.deps);
    expect(second).toEqual({ status: 'completed', objectsRemoved: 0 });
    expect(authDeleted(retry)).toBe(true);
  });
});

describe('retry after partial cleanup converges', () => {
  test('a second call finishes what a failed first call started', async () => {
    const objects = Array.from(
      { length: STORAGE_REMOVE_CHUNK_SIZE * 2 + 5 },
      (_, index) => `${USER}/a1/r1/f${String(index).padStart(3, '0')}.jpg`,
    );
    const first = createHarness({ objects, failRemoveOnCall: 2 });
    const firstResult = await runAccountDeletion(USER, SESSION, first.deps);
    expect(firstResult).toEqual({ status: 'failed', code: 'storage_remove_failed' });
    expect(authDeleted(first)).toBe(false);
    const survivors = [...first.state.objects];
    expect(survivors.length).toBe(objects.length - STORAGE_REMOVE_CHUNK_SIZE);

    const second = createHarness({ objects: survivors });
    const secondResult = await runAccountDeletion(USER, SESSION, second.deps);
    expect(secondResult).toEqual({ status: 'completed', objectsRemoved: survivors.length });
    expect(second.state.objects.size).toBe(0);
    expect(authDeleted(second)).toBe(true);
    expect(new Set([...first.removedPaths, ...second.removedPaths])).toEqual(new Set(objects));
    expectAuditsSafe(first, objects);
    expectAuditsSafe(second, objects);
  });
});
