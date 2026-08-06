-- vAIne beta core schema. Photo-free by construction: no table may hold
-- image bytes, URIs, signed URLs, or facial geometry, and CHECK constraints
-- reject payloads that smuggle them in.

-- Feature flags (kill switch). Readable by clients so the app can show an
-- honest "analysis unavailable" state; writable only via service role.
create table public.app_flags (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
create policy "flags readable by clients" on public.app_flags
  for select to authenticated, anon using (true);
-- Analysis ships disabled until the provider is approved, funded, and tested.
insert into public.app_flags (key, enabled) values ('analysis_enabled', false);

-- Beta limits as data so caps can tighten without an app release.
create table public.beta_limits (
  key text primary key,
  value integer not null check (value >= 0)
);
alter table public.beta_limits enable row level security;
create policy "limits readable by clients" on public.beta_limits
  for select to authenticated, anon using (true);
insert into public.beta_limits (key, value) values
  ('per_user_daily', 3),
  ('per_user_monthly', 20),
  ('global_daily', 100),
  ('max_images_per_analysis', 6),
  ('max_beta_users', 50);

-- Photo-free validated analysis results owned by the user.
create table public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_id text not null unique,
  mode text not null check (mode = 'live'),
  provider_id text not null,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  requested_at timestamptz not null,
  completed_at timestamptz not null,
  quality_decision text not null check (quality_decision in ('accepted','retake_requested')),
  overall_confidence numeric not null check (overall_confidence >= 0 and overall_confidence <= 1),
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint result_photo_free check (
    position('file://' in result::text) = 0
    and position('"uri"' in result::text) = 0
    and position('base64' in result::text) = 0
    and position('https://' in result::text) = 0
    and position('http://' in result::text) = 0
  )
);
create index analysis_results_user_created
  on public.analysis_results (user_id, created_at desc);
alter table public.analysis_results enable row level security;
create policy "own results readable" on public.analysis_results
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own results deletable" on public.analysis_results
  for delete to authenticated using ((select auth.uid()) = user_id);
-- No insert/update policies: only Edge Functions (service role) write results.

-- Photo-free audit trail. Service-role only: RLS enabled with no policies.
create table public.analysis_audit (
  id uuid primary key default gen_random_uuid(),
  analysis_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_photo_free check (
    position('file://' in detail::text) = 0
    and position('"uri"' in detail::text) = 0
    and position('base64' in detail::text) = 0
    and position('https://' in detail::text) = 0
    and position('http://' in detail::text) = 0
  )
);
create index analysis_audit_analysis on public.analysis_audit (analysis_id, created_at);
alter table public.analysis_audit enable row level security;

-- Quota counters. Server-maintained; owners may read their own remaining
-- allowance, nobody client-side may write.
create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_type text not null check (period_type in ('day','month')),
  period_key text not null,
  analyses_count integer not null default 0 check (analyses_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_type, period_key)
);
alter table public.usage_counters enable row level security;
create policy "own usage readable" on public.usage_counters
  for select to authenticated using ((select auth.uid()) = user_id);

-- Org-wide daily counter for the beta cap. Service-role only.
create table public.global_counters (
  period_key text primary key,
  analyses_count integer not null default 0 check (analyses_count >= 0)
);
alter table public.global_counters enable row level security;

-- Invited-tester allowlist. Stores salted SHA-256 hashes of lowercased
-- invite emails, never raw addresses. Service-role only.
create table public.beta_invites (
  email_hash text primary key,
  invited_at timestamptz not null default now(),
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz
);
alter table public.beta_invites enable row level security;
