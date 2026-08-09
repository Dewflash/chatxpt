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

The `.html` paths intentionally match Twitch Extension asset-hosting style paths. The local Next `/viewer.html` route currently renders a local Extension-style demo voter connected to the demo participation bridge, while `/config.html` and `/live-config.html` remain safe diagnostic setup shells until the reviewed Role 4 UI modules are mounted. The checked-in Twitch Asset Hosting package is still the artefact that must prove final uploaded-path compliance; the local demo voter does not by itself prove a real uploaded Twitch Extension panel.

## Environment

Set these only in local `.env.local`, Vercel, or the relevant deployment secret store:

```text
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TWITCH_EXTENSION_CLIENT_ID
TWITCH_EXTENSION_SECRET
```

Never prefix Twitch secrets with `NEXT_PUBLIC_`, paste them into issues, or include them in Twitch Extension client bundles.

## Verification

Before claiming Twitch readiness:

1. Confirm `/api/twitch/setup/readiness` reports the callback URL, Extension paths, missing variables, and setup limitations without returning secret values.
2. Confirm an unauthorised OAuth callback request returns safe JSON and no Twitch secrets.
3. Confirm the Twitch app has the deployed callback URL configured.
4. Confirm the local viewer route includes the Twitch Extension Helper script URL before its own shell markup.
5. Confirm the Twitch Extension has `viewer.html`, `config.html`, and optional `live-config.html` configured from the checked static upload package before claiming real Twitch Extension Asset Hosting evidence.
6. Run the focused setup tests:

```bash
npm run test -- tests/integration/twitch-setup.test.ts
```

Record real developer-console, Local Test, Hosted Test, allowlisted-account, chat, or Extension runtime evidence in `docs/evidence/manifest.json` before describing Twitch as live. The local viewer bridge alone does not prove OAuth, EventSub, Extension JWT validation, Asset Hosting package compliance, chat delivery, or real in-Twitch viewer voting.
