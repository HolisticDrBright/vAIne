# Sign in with Apple — setup checklist (vaine-beta)

The client code, backend project, and delete-account function are in place.
The steps below are the **manual actions only you can perform**, because they
create or handle Apple credentials. Nothing in this list is optional for the
secure beta, and no secret from it ever goes into chat, the repository, or
client code.

Backend facts referenced below:

- Supabase project: `vaine-beta`, ref `wfahmuxuldivkwzbtdcg`, region `us-west-1`
- API URL: `https://wfahmuxuldivkwzbtdcg.supabase.co`
- App bundle ID: `com.holisticdrbright.vaine`

## 1. Apple Developer portal (developer.apple.com)

1. Certificates, Identifiers & Profiles → Identifiers → select the App ID
   `com.holisticdrbright.vaine` → enable the **Sign in with Apple**
   capability → Save. (The repo already sets `ios.usesAppleSignIn`, so the
   next EAS build regenerates provisioning with the entitlement; EAS manages
   the profile automatically.)
2. Create a **Services ID** (Identifiers → new → Services ID), proposed
   identifier `com.holisticdrbright.vaine.auth`, with Sign in with Apple
   enabled and configured for the primary App ID above. Add the return URL
   `https://wfahmuxuldivkwzbtdcg.supabase.co/auth/v1/callback` under its
   Sign in with Apple configuration.
3. Create a **Sign in with Apple key** (Keys → new → enable Sign in with
   Apple → select the primary App ID). Download the `.p8` once and store it
   in your password manager. **Never** paste its contents into chat, commit
   it, or upload it anywhere except the Supabase dashboard field in step 2
   below. Note the Key ID and your Team ID.

## 2. Supabase dashboard (vaine-beta → Authentication → Providers → Apple)

1. Enable the Apple provider.
2. Enter: Services ID (`com.holisticdrbright.vaine.auth`), Team ID, Key ID,
   and the `.p8` key contents into the provider's secret field. The dashboard
   generates and rotates the client secret from it.
3. In the provider's **Authorized Client IDs**, add the native app bundle ID
   `com.holisticdrbright.vaine` — this is what lets the app's native
   identity-token flow validate.

## 3. Client configuration (publishable values only)

1. Local development: copy `.env.example` to `.env` and fill
   `EXPO_PUBLIC_SUPABASE_URL` (the API URL above) and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (dashboard → Project Settings →
   API Keys → **Publishable key**, the value starting `sb_publishable_`).
   `.env` is gitignored; never commit the real values.
2. TestFlight builds: set the same two variables as EAS environment
   variables in the beta environment used by the production build profile
   (EAS dashboard → project → Environment variables). These are publishable
   client values, not secrets; every table is guarded by RLS and grants,
   and privileged work happens only in Edge Functions.
3. The app validates the key's shape at startup and refuses anything that
   is not a modern publishable key: secret keys (`sb_secret_…`), legacy
   JWT-format keys (including service-role), and pasted private-key
   material (such as an Apple `.p8`) all cause the app to stay fully local
   rather than ship a dangerous credential. No service-role key, secret
   key, or `.p8` ever belongs in the app, `.env`, EAS variables, or this
   repository.

## 4. What happens automatically after that

- The app's `AuthProvider` detects the configuration and switches from the
  mock service to the live Sign in with Apple flow (nonce-bound identity
  token exchange). Without configuration it stays fully local.
- Account deletion calls the deployed `delete-account` Edge Function, which
  requires a sign-in fresher than ten minutes — proven by the creation time
  of the caller's server-side session (`auth.sessions.created_at`, resolved
  via the token's `session_id` claim), never by token issue timestamps,
  which refresh without a new Apple ceremony. Otherwise the app is told to
  reauthenticate. It then removes every storage object under the user's
  prefix (paginated listing, checked removals, verified-empty re-listing),
  deletes results, counters, and audit history with every step checked, and
  only then deletes the auth user; any failure preserves the account so
  deletion can be retried to convergence.

## Release gates

- **Build 7 (on TestFlight)** validates the on-device capture stack: camera,
  ML Kit face detection, facial-zone alignment, magnified crops, retake
  guidance, and the labeled fixed-guide fallback.
- **Build 8** must validate everything added after Build 7's commit: Sign in
  with Apple, session restoration across app restarts, sign-out,
  reauthentication, and account deletion end to end. It is created only
  after every manual step in sections 1–3 above is confirmed complete.
- **PR #2 merges only after both Build 7 and Build 8 testing pass**, because
  the branch now extends beyond Build 7's commit.

## Build 8 test checklist (disposable beta account only)

Rules: use a disposable Apple ID / beta account, never a personal one. When
a storage object is needed to prove cleanup, use a generated solid-color
JPEG — never a person's face; infrastructure testing does not need real
photos. `analysis_enabled` stays false throughout.

1. First Sign in with Apple completes and the account screen shows only the
   opaque account identifier (no name or email anywhere).
2. Cancelling the Apple sheet returns to signed-out with no error message.
3. Close and reopen the app: the session restores without re-prompting
   (brief "checking for an existing session" state, never a wrong flash).
4. Sign out; reopening the app shows signed-out (no session).
5. Sign in again successfully.
6. Tap Delete account: the destructive confirmation appears and Cancel
   backs out with nothing deleted.
7. With a session older than ten minutes, confirming deletion returns the
   "confirm it's you" reauthentication demand (server answered
   `reauth_required` — verify no data was deleted).
8. The reauth card reruns the full Apple ceremony; a fresh sign-in
   proceeds directly into deletion.
9. Deletion succeeds and the app lands signed-out with the deletion notice.
10. Backend verification: no Auth user remains, `analysis_results`,
    `usage_counters`, and user-linked audit rows are gone (lifecycle rows
    carry a null user), and zero objects remain under the user's storage
    prefix (verify with the solid-color JPEG placed before deletion).
11. Retry/idempotency: force one controlled failure mid-cleanup (e.g.
    temporarily revoke a service permission or use the disposable object to
    simulate), confirm the account survives, then retry deletion to full
    convergence.
12. Regression: re-run the Build 7 capture checks (camera, face detection,
    zone alignment, crops, retakes, fallback) on the same build.

## Not yet configured anywhere (later phases)

- Anthropic API key: created in your Anthropic Console when Phase 4 starts,
  stored only via Supabase Edge Function secrets
  (`Project Settings → Edge Functions → Secrets`), never in the client.
- Analysis remains disabled by the `analysis_enabled` kill switch until the
  live pipeline exists and is tested.
