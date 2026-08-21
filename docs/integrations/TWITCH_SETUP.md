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
TWITCH_EXTENSION_ASSET_ORIGIN  # exact cross-origin Local Test asset origin when separate from the EBS
TWITCH_EXTENSION_SECRET  # base64 Extension signing secret
TWITCH_EVENTSUB_SECRET   # hosted webhook HMAC secret; generated locally
CHATXPT_PUBLIC_BASE_URL  # deployed HTTPS origin; leave unset on localhost
```

Never prefix Twitch or Studio secrets with `NEXT_PUBLIC_`, paste them into issues, or include them in Twitch Extension client bundles.

`npm run dev` automatically prepares the local-only signing values, forces the
credential-free algorithmic AI path, and selects EventSub WebSockets. It does
not overwrite existing configuration. `TWITCH_CLIENT_ID` and
`TWITCH_CLIENT_SECRET` identify the ChatXPT-owned Twitch developer application;
they are configured once by the product owner, not supplied by each streamer.
Dedicated Studio, gameplay-ingress, and OBS setup keys exist only for manual
server diagnostics and are not part of the normal streamer flow.

## Broadcaster connection

Studio owns the OAuth authorization-code flow and the `channel.chat.message`,
`stream.online`, and `stream.offline` EventSub subscriptions. The normal
streamer does not handle channel IDs, game IDs, or server keys.

1. Open `/studio` over HTTPS (or localhost during development).
2. Choose **Connect Twitch**. Studio sends a random state-bound request for
   `user:read:chat`, `user:bot`, and `channel:bot`.
3. The callback exchanges and validates the code server-side, verifies the app
   and broadcaster identity, imports the current channel game, and requests the
   version `1` live-status and chat subscriptions. Localhost uses Twitch
   EventSub WebSockets; hosted HTTPS uses signed webhooks.
4. Studio creates or reopens one `preparing` session and places only a signed,
   expiring Studio grant plus a longer-lived signed broadcaster-connection
   grant in HttpOnly cookies. Twitch tokens and secrets are never returned to
   the client or committed to product state. On localhost only, the server
   encrypts the user access/refresh authorization under gitignored owner-only
   `.private/` storage so EventSub reconnects after an app restart. A later
   Studio visit automatically reopens the mapped session while that browser
   connection remains valid.
5. Open the persistent Gameplay Capture tab and allow OBS Virtual Camera. Studio
   issues its capture and overlay grants through the cookie; the streamer never
   enters the gameplay or overlay setup keys.
6. When Twitch sends `stream.online`, ChatXPT starts the authoritative mapped
   session automatically; signed chat events then feed voting and privacy-safe
   engagement analysis. `stream.offline` ends that session. No second manual
   session-start form is required.

On localhost, ChatXPT automatically uses Twitch's user-authorized EventSub
WebSocket transport, so a public tunnel is not required for live-status or chat
delivery. Hosted deployments continue to use the signed HTTPS webhook. The
server-only diagnostic bootstrap endpoint is not part of the streamer UI or the
production connection flow.

## Verification

Before claiming Twitch readiness:

1. Confirm `/api/twitch/setup/readiness` reports the callback URL, Extension paths, missing variables, and setup limitations without returning secret values.
2. Confirm an unauthorised OAuth callback safely redirects to Studio with no Twitch secrets.
3. For localhost, register the exact Studio callback URL used by the app, run `npm run dev`, and use EventSub WebSockets; no public tunnel or webhook challenge is needed.
4. When testing the Twitch Extension itself, run `npm run dev:twitch`, configure `https://localhost:3000/` as the Testing Base URI, and confirm the local certificate is trusted in each test browser.
5. Connect Twitch in `/studio`, go live on Twitch, confirm Studio changes from preparing to live without another form, connect OBS Virtual Camera, generate exactly three sidequests through the canonical runtime, open the installed panel, and confirm select-then-confirm vote acknowledgement, hidden-before-ack/live-after-ack tallies, countdown, winner, active progress/result, token refresh, and reconnect recovery.
6. Confirm the Twitch Extension has `viewer.html`, `config.html`, and optional `live-config.html` configured. For Asset Hosting, set the exact trusted EBS origin in `twitch-extension/assets/environment.js` and add it to Twitch's URL-fetching allowlist. Hosted broadcaster endpoints allow only `https://<TWITCH_EXTENSION_CLIENT_ID>.ext-twitch.tv`; if Local Test assets use a separate base origin, set that exact origin in `TWITCH_EXTENSION_ASSET_ORIGIN` so Config and Live Config preflights succeed.
7. During an open vote, send exact `1`, `2`, and `3` messages from separate authorised chatters. Confirm repeated delivery is idempotent, one viewer cannot change their first vote, ordinary chat changes only privacy-safe aggregate analytics, and the OBS overlay shows the authoritative result without per-vote chat spam.
8. Run the focused setup tests:

```bash
npm run test -- tests/integration/twitch-setup.test.ts
```

For a hosted release, separately register the deployed HTTPS callback and
EventSub webhook URL, configure the hosted webhook secret, and complete
Twitch's signed callback challenge.

Record real developer-console, Local Test, Hosted Test, allowlisted-account, chat, or Extension runtime evidence in `docs/evidence/manifest.json` before describing Twitch as live. Signed fixture JWTs prove server behaviour but not Twitch issuance, Asset Hosting configuration, chat delivery, or real in-Twitch viewer voting.
