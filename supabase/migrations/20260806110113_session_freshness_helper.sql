-- Recent-sign-in proof for account deletion. Supabase creates an
-- auth.sessions row only at sign-in (token refresh reuses the session and its
-- created_at), so the session's creation time is the moment of the last real
-- Sign in with Apple ceremony. The delete-account Edge Function resolves the
-- caller's session_id claim through this helper and requires the sign-in to
-- be recent; access-token iat is never used, because refresh mints fresh iat
-- values without any new Apple authentication.
create or replace function public.session_created_at(p_user_id uuid, p_session_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select s.created_at
  from auth.sessions s
  where s.id = p_session_id
    and s.user_id = p_user_id;
$$;

comment on function public.session_created_at(uuid, uuid) is
  'Creation time of a user''s auth session (sign-in time; refresh does not create sessions). Service-role only: used by delete-account for recent-reauthentication proof.';

-- Locked down: only the service role (Edge Functions) may call it.
revoke all on function public.session_created_at(uuid, uuid) from public;
revoke all on function public.session_created_at(uuid, uuid) from anon;
revoke all on function public.session_created_at(uuid, uuid) from authenticated;
grant execute on function public.session_created_at(uuid, uuid) to service_role;
