# Twitch Setup

Role 1 owns Twitch registration, server-side Twitch credentials, and the thin route targets that Twitch points at. This file is a setup runbook, not live Twitch evidence.

## Current Paths

Use these paths when configuring the Twitch application and Extension:

```text
OAuth callback:   /api/twitch/oauth/callback
Setup readiness:  /api/twitch/setup/readiness
EventSub webhook: /api/twitch/eventsub
Panel Viewer:     /viewer.html
Configuration:    /config.html
Live Config:      /live-config.html
```

The `.html` paths intentionally match Twitch Extension asset-hosting style paths. The local Next `/viewer.html` route mounts Role 5's canonical viewer surface and accepts only a Twitch `onAuthorized` JWT verified by the Role 1 EBS. `/config.html` and `/live-config.html` mount the compact Role 4 surfaces and require a signed Twitch broadcaster role. The checked-in Twitch Asset Hosting package is the upload artefact; source and signed-fixture tests do not by themselves prove a real Twitch panel run.

## Environment

Set these only in local `.env.local`, Vercel, or the relevant deployment secret store:

```text
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TWITCH_EXTENSION_CLIENT_ID
TWITCH_EXTENSION_SECRET  # base64 Extension signing secret
TWITCH_EVENTSUB_SECRET   # independent webhook HMAC secret, 32+ characters
CHATXPT_STUDIO_SETUP_KEY # private value of at least 32 characters
CHATXPT_HOSTED_BOARD_SECRET
CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY
CHATXPT_OBS_OVERLAY_SETUP_KEY
```

Never prefix Twitch or Studio secrets with `NEXT_PUBLIC_`, paste them into issues, or include them in Twitch Extension client bundles.

## Manual broadcaster session start

Full Twitch OAuth and EventSub subscription automation remains an explicit later integration. The deployed build already verifies signed EventSub webhook challenges/notifications and routes exact `1`/`2`/`3` messages through the authoritative vote ledger. For the current bounded setup path:

1. Open `/studio` over HTTPS (or localhost during development).
2. Enter the real numeric Twitch channel ID, display name, optional Game Profile pair, and `CHATXPT_STUDIO_SETUP_KEY`.
3. The server creates one authoritative live session for that channel, maps Twitch JWT `channel_id` to it, and exchanges the setup key for an HttpOnly grant that expires after 12 hours.
4. The browser does not store either secret or grant in local/session storage. Config and Live Config use Twitch's broadcaster JWT instead of the Studio cookie.
5. Start Gameplay Capture and request its separate session-scoped ingress grant. A session start alone is not proof that Twitch or Gameplay Capture ran.
6. Create the `channel.chat.message` EventSub subscription against `/api/twitch/eventsub` using the same `TWITCH_EVENTSUB_SECRET`. This external subscription step is required before real chat votes can arrive.

## Verification

Before claiming Twitch readiness:

1. Confirm `/api/twitch/setup/readiness` reports the callback URL, Extension paths, missing variables, and setup limitations without returning secret values.
2. Confirm an unauthorised OAuth callback request returns safe JSON and no Twitch secrets.
3. Confirm the Twitch app has the deployed callback URL and HTTPS EventSub webhook configured; complete Twitch's signed callback challenge.
4. Run `npm run dev:twitch`, configure `https://localhost:3000/` as the Testing Base URI, and confirm the local certificate is trusted in each test browser.
5. Start the broadcaster session in `/studio`, generate exactly three sidequests through the canonical runtime, open the installed panel, and confirm select-then-confirm vote acknowledgement, hidden-before-ack/live-after-ack tallies, countdown, winner, active progress/result, token refresh, and reconnect recovery.
6. Confirm the Twitch Extension has `viewer.html`, `config.html`, and optional `live-config.html` configured. For Asset Hosting, set the exact trusted EBS origin in `twitch-extension/assets/environment.js` and add it to Twitch's URL-fetching allowlist.
7. During an open vote, send exact `1`, `2`, and `3` messages from separate authorised chatters. Confirm repeated delivery is idempotent, one viewer cannot change their first vote, ordinary chat is ignored, and the OBS overlay shows the authoritative result without per-vote chat spam.
8. Run the focused setup tests:

```bash
npm run test -- tests/integration/twitch-setup.test.ts
```

Record real developer-console, Local Test, Hosted Test, allowlisted-account, chat, or Extension runtime evidence in `docs/evidence/manifest.json` before describing Twitch as live. Signed fixture JWTs prove server behaviour but not Twitch issuance, Asset Hosting configuration, chat delivery, or real in-Twitch viewer voting.
