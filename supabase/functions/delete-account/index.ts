/**
 * delete-account Edge Function entrypoint (Deno). All decision logic lives in
 * deletion.ts, which is pure and covered by the repository's vitest suite;
 * this file only adapts HTTP + Supabase clients to that orchestrator.
 *
 * Deployed with verify_jwt enabled: the platform has already verified the
 * caller's JWT signature before this code runs. The function additionally
 * confirms the token with the Auth server (catches revoked sessions) and
 * derives recent-sign-in proof from auth.sessions.created_at — never from
 * token claims like iat, which refresh without any new Apple ceremony.
 *
 * Responses carry only generic codes. No object names, paths, URLs, emails,
 * or tokens are logged or returned.
 */

import { createClient } from '@supabase/supabase-js';
import { runAccountDeletion, type DeletionDeps, type UserRowTable } from './deletion.ts';
import type { DeletionAuditDetail, DeletionAuditEvent } from './auditDetail.ts';

const BUCKET = 'analysis-uploads';
/** Non-PII marker stored in analysis_audit.analysis_id for lifecycle rows. */
const LIFECYCLE_ANALYSIS_ID = 'account_deletion';
const LIFECYCLE_EVENTS = [
  'account_deletion_started',
  'account_deletion_failed',
  'account_deleted',
] as const;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Payload of a JWT whose signature the platform has already verified. */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (typeof payload !== 'object' || payload === null) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildDeps(admin: ReturnType<typeof createClient>): DeletionDeps {
  return {
    async sessionCreatedAt(userId, sessionId) {
      try {
        const { data, error } = await admin.rpc('session_created_at', {
          p_user_id: userId,
          p_session_id: sessionId,
        });
        if (error) return { ok: false };
        return { ok: true, createdAtIso: (data as string | null) ?? null };
      } catch {
        return { ok: false };
      }
    },
    async listFolderPage(prefix, offset, limit) {
      try {
        const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
          limit,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        });
        if (error || !Array.isArray(data)) return { ok: false };
        return {
          ok: true,
          entries: data.map((entry) => ({
            name: typeof entry.name === 'string' ? entry.name : '',
            isFolder: entry.id === null,
          })),
        };
      } catch {
        return { ok: false };
      }
    },
    async removeObjects(paths) {
      try {
        const { data, error } = await admin.storage.from(BUCKET).remove(paths);
        if (error || !Array.isArray(data)) return { ok: false };
        return { ok: true, removedCount: data.length };
      } catch {
        return { ok: false };
      }
    },
    async deleteUserRows(table: UserRowTable, userId) {
      try {
        const { error } = await admin.from(table).delete().eq('user_id', userId);
        return { ok: !error };
      } catch {
        return { ok: false };
      }
    },
    async deleteUserAuditHistory(userId) {
      try {
        const { error } = await admin
          .from('analysis_audit')
          .delete()
          .eq('user_id', userId)
          .not('event', 'in', `(${LIFECYCLE_EVENTS.join(',')})`);
        return { ok: !error };
      } catch {
        return { ok: false };
      }
    },
    async insertAudit(event: DeletionAuditEvent, userId, detail: DeletionAuditDetail) {
      try {
        // account_deleted is written after the auth user row is gone; its FK
        // (ON DELETE SET NULL) forbids a dangling user reference, so the
        // tombstone carries no user id. Earlier lifecycle rows are anonymized
        // by the same FK the moment auth deletion succeeds.
        const userIdColumn = event === 'account_deleted' ? null : userId;
        const { error } = await admin.from('analysis_audit').insert({
          analysis_id: LIFECYCLE_ANALYSIS_ID,
          user_id: userIdColumn,
          event,
          detail,
        });
        return { ok: !error };
      } catch {
        return { ok: false };
      }
    },
    async deleteAuthUser(userId) {
      try {
        const { error } = await admin.auth.admin.deleteUser(userId);
        return { ok: !error };
      } catch {
        return { ok: false };
      }
    },
    nowMs: () => Date.now(),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const jwt = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  if (jwt.length === 0) return json(401, { error: 'unauthorized' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'misconfigured' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Confirm the (platform-verified) token with the Auth server so revoked
  // sessions cannot delete accounts, then read the session claim.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) return json(401, { error: 'unauthorized' });
  const payload = decodeJwtPayload(jwt);
  const sessionId = typeof payload?.session_id === 'string' ? payload.session_id : '';
  const subject = typeof payload?.sub === 'string' ? payload.sub : '';
  if (subject !== userData.user.id) return json(401, { error: 'unauthorized' });

  const result = await runAccountDeletion(userData.user.id, sessionId, buildDeps(admin));

  if (result.status === 'completed') {
    return json(200, { status: 'completed' });
  }
  if (result.status === 'reauth_required') {
    return json(401, { error: 'reauth_required' });
  }
  return json(500, { error: result.code });
});
