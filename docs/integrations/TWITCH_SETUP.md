# Twitch Setup Runbook

Role 1 owns Twitch application and Extension setup. This runbook is configuration guidance only until real Twitch developer-console and Local or Hosted Test evidence is recorded in `docs/evidence/manifest.json`.

## Registered URLs

Register the OAuth redirect URL using the deployed ChatXPT base URL:

```text
https://<chatxpt-preview-or-production-host>/api/twitch/oauth/callback
```

The callback route is reserved in the app and returns safe setup/readiness JSON. It does not exchange OAuth tokens until Role 1 configures Twitch credentials and enables the token-exchange implementation.

Reserve these Extension paths for Twitch setup:

```text
Viewer:      /twitch/viewer
Config:      /twitch/config
Live Config: /twitch/live-config
```

Those Extension surface paths are registration targets only until Role 4/5 modules are mounted through Role 1-owned thin routes.

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
2. Confirm an unauthorised callback request returns safe JSON and no Twitch secrets.
3. Confirm the Twitch app has the deployed callback URL configured.
4. Confirm the Twitch Extension has the viewer, config, and live-config URLs configured.
5. Run the focused setup tests locally:

```bash
npm run test -- tests/integration/twitch-setup.test.ts
```

6. Record real developer-console, Local Test, or Hosted Test evidence in `docs/evidence/manifest.json` before citing Twitch as live.

This runbook does not prove Twitch OAuth, EventSub, chat delivery, or Extension runtime behaviour. Those require separate live test-channel evidence.
