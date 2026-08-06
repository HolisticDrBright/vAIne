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
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (dashboard → Project Settings → API →
   anon/publishable key). `.env` is gitignored.
2. TestFlight builds: set the same two variables as EAS environment
   variables for the production profile (EAS dashboard or `eas.json` env).
   These are publishable client values, not secrets; every table is guarded
   by RLS and privileged work happens only in Edge Functions.

## 4. What happens automatically after that

- The app's `AuthProvider` detects the configuration and switches from the
  mock service to the live Sign in with Apple flow (nonce-bound identity
  token exchange). Without configuration it stays fully local.
- Account deletion calls the deployed `delete-account` Edge Function, which
  requires a sign-in fresher than ten minutes (otherwise the app is told to
  reauthenticate), deletes storage objects, results, and counters, then
  deletes the auth user.

## Not yet configured anywhere (later phases)

- Anthropic API key: created in your Anthropic Console when Phase 4 starts,
  stored only via Supabase Edge Function secrets
  (`Project Settings → Edge Functions → Secrets`), never in the client.
- Analysis remains disabled by the `analysis_enabled` kill switch until the
  live pipeline exists and is tested.
