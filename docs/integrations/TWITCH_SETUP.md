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
TWITCH_EVENTSUB_SECRET   # independent webhook HMAC secret, 32-100 printable ASCII characters
CHATXPT_PUBLIC_BASE_URL  # deployed HTTPS origin, or a trusted tunnel origin for testing
CHATXPT_STUDIO_SETUP_KEY # private value of at least 32 characters
CHATXPT_HOSTED_BOARD_SECRET
CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY
CHATXPT_OBS_OVERLAY_SETUP_KEY
```

Never prefix Twitch or Studio secrets with `NEXT_PUBLIC_`, paste them into issues, or include them in Twitch Extension client bundles.

## Broadcaster connection

Studio now owns the OAuth authorization-code flow and `channel.chat.message`
EventSub subscription. The normal streamer does not handle a server key.

1. Open `/studio` over HTTPS (or localhost during development).
2. Choose **Connect Twitch**. Studio sends a random state-bound request for
   `user:read:chat`, `user:bot`, and `channel:bot`.
3. The callback exchanges and validates the code server-side, verifies the app
   and broadcaster identity, imports the current channel game, and requests the
   version `1` signed chat webhook subscription.
4. Studio creates or reopens one `preparing` session and places only a signed,
   expiring Studio grant in an HttpOnly cookie. Twitch tokens and secrets are
   never returned to the client or committed to product state.
5. Open the persistent Gameplay Capture tab and allow OBS Virtual Camera. Studio
   issues its capture and overlay grants through the cookie; the streamer never
   enters the gameplay or overlay setup keys.
6. Correct the imported game in **Profile & Defaults** if necessary. **Start
   ChatXPT** stays blocked until Twitch configuration and a current Gameplay
   Capture snapshot are available.

On localhost, Twitch cannot verify an HTTP EventSub webhook. Use a trusted HTTPS
tunnel and set `CHATXPT_PUBLIC_BASE_URL` for a real chat test. The diagnostic
manual session form remains collapsed on the Studio connection screen for
credential recovery only.

## Verification

Before claiming Twitch readiness:

1. Confirm `/api/twitch/setup/readiness` reports the callback URL, Extension paths, missing variables, and setup limitations without returning secret values.
2. Confirm an unauthorised OAuth callback safely redirects to Studio with no Twitch secrets.
3. Confirm the Twitch app has the deployed callback URL and HTTPS EventSub webhook configured; complete Twitch's signed callback challenge.
4. Run `npm run dev:twitch`, configure `https://localhost:3000/` as the Testing Base URI, and confirm the local certificate is trusted in each test browser.
5. Connect Twitch in `/studio`, connect OBS Virtual Camera, start ChatXPT, generate exactly three sidequests through the canonical runtime, open the installed panel, and confirm select-then-confirm vote acknowledgement, hidden-before-ack/live-after-ack tallies, countdown, winner, active progress/result, token refresh, and reconnect recovery.
6. Confirm the Twitch Extension has `viewer.html`, `config.html`, and optional `live-config.html` configured. For Asset Hosting, set the exact trusted EBS origin in `twitch-extension/assets/environment.js` and add it to Twitch's URL-fetching allowlist. Hosted broadcaster endpoints allow only `https://<TWITCH_EXTENSION_CLIENT_ID>.ext-twitch.tv`; if Local Test assets use a separate base origin, set that exact origin in `TWITCH_EXTENSION_ASSET_ORIGIN` so Config and Live Config preflights succeed.
7. During an open vote, send exact `1`, `2`, and `3` messages from separate authorised chatters. Confirm repeated delivery is idempotent, one viewer cannot change their first vote, ordinary chat changes only privacy-safe aggregate analytics, and the OBS overlay shows the authoritative result without per-vote chat spam.
8. Run the focused setup tests:

```bash
npm run test -- tests/integration/twitch-setup.test.ts
```

Record real developer-console, Local Test, Hosted Test, allowlisted-account, chat, or Extension runtime evidence in `docs/evidence/manifest.json` before describing Twitch as live. Signed fixture JWTs prove server behaviour but not Twitch issuance, Asset Hosting configuration, chat delivery, or real in-Twitch viewer voting.
