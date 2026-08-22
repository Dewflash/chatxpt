# Vercel Preview Runbook

Role 1 owns the Vercel project, deployment variables, and promotion decision.
This runbook is configuration guidance only until a real Vercel preview URL and
`/api/health/deployment` response are recorded in `docs/evidence/manifest.json`.

## Project Setup

1. Connect the private GitHub repository to a Role 1-controlled Vercel project.
2. Select the Next.js framework preset.
3. Keep the committed commands from `vercel.json`:
   - Install command: `npm ci`
   - Build command: `npm run build`
4. Do not configure Vercel environment values in `vercel.json` or commit them to
   the repository.

## Preview Environment

Set these values in the Vercel dashboard for Preview. Empty local values remain
allowed in `.env.example`, but Preview must fail closed when required shared
services are partially configured.

Public client-safe values:

```text
NEXT_PUBLIC_APP_ENV=preview
NEXT_PUBLIC_CHATXPT_PREVIEW_ACCOUNT_ENABLED=true
NEXT_PUBLIC_SUPABASE_URL=<Supabase project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
TWITCH_CLIENT_ID=<Twitch app client ID>
TWITCH_EXTENSION_CLIENT_ID=<Twitch Extension client ID>
```

Server-only values:

```text
SUPABASE_SECRET_KEY=<Supabase secret key>
TWITCH_CLIENT_SECRET=<Twitch app client secret>
TWITCH_EXTENSION_SECRET=<Twitch Extension signing secret>
CHATXPT_OBS_OVERLAY_SETUP_KEY=<Role 1 generated setup key>
CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY=<Role 1 generated gameplay ingress key>
CHATXPT_STUDIO_SETUP_KEY=<Role 1 generated Studio bootstrap key, at least 32 characters>
```

Legacy Supabase projects may use `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` instead of the current publishable/secret pair during
migration. Configure only one Supabase key pair per environment.

## Production Environment

Use separate Production values when Role 1 promotes the demo environment.
Production must not reuse preview secrets unless Role 1 records that choice as a
deliberate deployment decision.

Set:

```text
NEXT_PUBLIC_APP_ENV=production
```

Keep every server-only value out of client-prefixed names. Never prefix Supabase
secret keys, Twitch secrets, the OBS overlay key, gameplay ingress key, or Studio
bootstrap key with `NEXT_PUBLIC_`.

`NEXT_PUBLIC_CHATXPT_PREVIEW_ACCOUNT_ENABLED=true` enables only the clearly
labelled browser-local demo-account gate. It is not production authentication
and grants no server authority; Twitch OAuth and every Studio command retain
their existing server-side authorization boundaries.

The committed `.vercelignore` excludes `.env*`, `.private/`, local encrypted
Twitch authorizations, build output, and installed dependencies from deployment
uploads. Hosted secrets must be configured in Vercel's environment store.

## Post-Deploy Checks

After each preview deployment:

1. Open `/api/health/deployment`.
2. Confirm the response reports `deployment: "preview"`.
3. Confirm `persistence.mode` is `supabase` when Supabase is configured.
4. Confirm server-only values do not appear in the health response.
5. Confirm `gameplayIngress.configured` reflects whether the server-only setup key is ready without exposing it.
6. Confirm incomplete Supabase setup returns an unhealthy report instead of
   silently selecting local memory mode.
7. Verify response headers include the CSP, Twitch frame ancestors, Supabase
   HTTPS/WSS connection policy, first-party worker policy, and camera permission
   policy.
8. Record the deployment URL, command, source revision, reviewer, and
   limitations in `docs/evidence/manifest.json` before citing it as deployment
   evidence.

This runbook does not prove live Twitch, OBS Virtual Camera, OCR, or two-browser
Supabase realtime execution. Those require separate evidence entries from real
inputs.
