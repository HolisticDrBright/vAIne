-- Replace Supabase's default full-table grants for client roles with least
-- privilege. RLS remains enabled on every table; these grants remove entire
-- capability classes (INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES) that RLS
-- policies do not all govern. service_role grants are untouched, so Edge
-- Functions keep working.

-- Service-role-only tables: no client access of any kind.
revoke all on table public.analysis_audit from public, anon, authenticated;
revoke all on table public.global_counters from public, anon, authenticated;
revoke all on table public.beta_invites from public, anon, authenticated;

-- analysis_results: owners may read and delete their rows (existing RLS
-- policies scope them); only the backend may ever insert or update.
revoke all on table public.analysis_results from public, anon, authenticated;
grant select, delete on table public.analysis_results to authenticated;

-- usage_counters: owners may read their own counters; writes are backend-only.
revoke all on table public.usage_counters from public, anon, authenticated;
grant select on table public.usage_counters to authenticated;

-- app_flags / beta_limits: read-only reference data for clients (the kill
-- switch must be readable before sign-in, matching the existing policies).
revoke all on table public.app_flags from public, anon, authenticated;
grant select on table public.app_flags to anon, authenticated;
revoke all on table public.beta_limits from public, anon, authenticated;
grant select on table public.beta_limits to anon, authenticated;

-- Covering indexes for foreign keys the advisors flagged.
create index if not exists analysis_audit_user_id_idx
  on public.analysis_audit (user_id);
create index if not exists beta_invites_redeemed_by_idx
  on public.beta_invites (redeemed_by);

comment on column public.beta_invites.email_hash is
  'Server-side keyed HMAC-SHA-256 (hex) of the NFKC-normalized, trimmed, lowercased invite email. The HMAC key (INVITE_HASH_KEY) exists only as an Edge Function secret and never reaches the app or repository. Plain or unsalted email hashes are forbidden: they are reversible by dictionary attack over known addresses.';
