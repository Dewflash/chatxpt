# Twitch Setup Runbook

Role 1 owns Twitch application and Extension setup. This runbook is configuration guidance only until real Twitch developer-console and Local or Hosted Test evidence is recorded in `docs/evidence/manifest.json`.

## Registered URLs

Register the OAuth redirect URL using the deployed ChatXPT base URL:

```text
https://<chatxpt-preview-or-production-host>/api/twitch/oauth/callback
```

The callback route is reserved in the app and returns safe setup/readiness JSON. It does not exchange OAuth tokens until Role 1 configures Twitch credentials and enables the token-exchange implementation.

For initial app registration, request no OAuth scopes. D-055 keeps OAuth token exchange disabled until Role 1 implements the runtime adapter. The later EventSub/API chat path may request `user:read:chat`, `user:write:chat`, `user:bot`, and broadcaster `channel:bot` as needed; legacy IRC fallback may request `chat:read` and `chat:edit` only if Role 1 deliberately enables that fallback.

Reserve these Extension paths for Twitch setup:

```text
Selected Extension types: Panel, Mobile
Panel Viewer Path:        /twitch/viewer
Mobile Viewer Path:       /twitch/viewer
Panel Height:             496
Config Path:              /twitch/config
Live Config Path:         /twitch/live-config
```

Do not select `Video - Fullscreen` or `Video - Component` for the MVP. OBS Browser Source remains the broadcast overlay path, while the Twitch Extension owns compact panel/mobile viewer participation.

Those Extension surface paths now resolve to safe Role 1 setup shells. They show readiness and limitations only until Role 4/5 modules are mounted through the same Role 1-owned thin routes.

## Environment Variables

Public identifiers:

```text
TWITCH_CLIENT_ID=<Twitch app client ID>
TWITCH_EXTENSION_CLIENT_ID=<Twitch Extension client ID>
CHATXPT_PUBLIC_BASE_URL=<deployed ChatXPT origin>
```

Server-only secrets:

```text
TWITCH_CLIENT_SECRET=<Twitch app client secret>
TWITCH_EXTENSION_SECRET=<Twitch Extension signing secret>
```

Never prefix Twitch secrets with `NEXT_PUBLIC_`, paste them into issues, or include them in screenshots.

## Readiness Checks

Before claiming Twitch readiness:

1. Confirm `/api/twitch/oauth/callback` exists on the target deployment.
2. Confirm `/api/twitch/setup/readiness` reports the callback URL, Extension paths, missing variables, and setup limitations without returning secret values.
3. Confirm `/api/twitch/setup/registration` reports copy-safe developer-console values, no initial OAuth scopes, deferred runtime chat scope profiles, the D-055 OAuth policy, and the D-056 Extension view policy.
4. Confirm an unauthorised callback request returns safe JSON and no Twitch secrets.
5. Confirm the Twitch app has the deployed callback URL configured.
6. Confirm the Twitch Extension is set to Panel and Mobile only, with Panel and Mobile viewer paths both set to `/twitch/viewer`, Panel height set to 496, Config set to `/twitch/config`, and Live Config set to `/twitch/live-config`.
7. Confirm `/twitch/viewer`, `/twitch/config`, and `/twitch/live-config` return the setup shell before replacing them with role-owned UI modules.
8. Run the focused setup tests locally:

```bash
npm run test -- tests/integration/twitch-setup.test.ts tests/integration/twitch-extension-routes.test.tsx
```

9. Run `npm run verify:twitch-setup -- <preview-or-local-url>` to verify the setup readiness API, registration manifest, callback failure shape, and reserved Extension route shells.
10. Use only the team-controlled broadcaster test channel and allowlisted team viewer accounts until Role 1 records broader evidence.
11. Record real developer-console, Local Test, or Hosted Test evidence in `docs/evidence/manifest.json` before citing Twitch as live.

This runbook does not prove Twitch OAuth, EventSub, chat delivery, or Extension runtime behaviour. Those require separate live test-channel evidence.
