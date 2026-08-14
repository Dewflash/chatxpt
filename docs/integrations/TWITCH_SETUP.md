# Twitch Setup

Role 1 owns Twitch registration, server-side Twitch credentials, and the thin route targets that Twitch points at. This file is a setup runbook, not live Twitch evidence.

## Current Paths

Use these paths when configuring the Twitch application and Extension:

```text
OAuth callback:   /api/twitch/oauth/callback
Setup readiness:  /api/twitch/setup/readiness
Panel Viewer:     /viewer.html
Configuration:    /config.html
Live Config:      /live-config.html
```

The `.html` paths intentionally match Twitch Extension asset-hosting style paths. The local Next `/viewer.html` route mounts Role 5's canonical viewer surface and accepts only a Twitch `onAuthorized` JWT verified by the Role 1 EBS. `/config.html` and `/live-config.html` remain diagnostic setup shells until the streamer-control pass. The checked-in Twitch Asset Hosting package is the upload artefact; source and signed-fixture tests do not by themselves prove a real Twitch panel run.

## Environment

Set these only in local `.env.local`, Vercel, or the relevant deployment secret store:

```text
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TWITCH_EXTENSION_CLIENT_ID
TWITCH_EXTENSION_SECRET  # base64 Extension signing secret
```

Never prefix Twitch secrets with `NEXT_PUBLIC_`, paste them into issues, or include them in Twitch Extension client bundles.

## Verification

Before claiming Twitch readiness:

1. Confirm `/api/twitch/setup/readiness` reports the callback URL, Extension paths, missing variables, and setup limitations without returning secret values.
2. Confirm an unauthorised OAuth callback request returns safe JSON and no Twitch secrets.
3. Confirm the Twitch app has the deployed callback URL configured.
4. Run `npm run dev:twitch`, configure `https://localhost:3000/` as the Testing Base URI, and confirm the local certificate is trusted in each test browser.
5. Generate exactly three quests in Studio, open the installed panel, and confirm vote acknowledgement, hidden-before-ack/live-after-ack tallies, countdown, winner, active progress/result, token refresh, and reconnect recovery.
6. Confirm the Twitch Extension has `viewer.html`, `config.html`, and optional `live-config.html` configured. For Asset Hosting, set the exact trusted EBS origin in `twitch-extension/assets/environment.js` and add it to Twitch's URL-fetching allowlist.
7. Run the focused setup tests:

```bash
npm run test -- tests/integration/twitch-setup.test.ts
```

Record real developer-console, Local Test, Hosted Test, allowlisted-account, chat, or Extension runtime evidence in `docs/evidence/manifest.json` before describing Twitch as live. Signed fixture JWTs prove server behaviour but not Twitch issuance, Asset Hosting configuration, chat delivery, or real in-Twitch viewer voting.
