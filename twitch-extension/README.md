# ChatXPT Twitch Extension Upload Package

This directory contains the root-level static files Twitch Asset Hosting expects during Local or Hosted Test:

```text
viewer.html
config.html
live-config.html
assets/extension.css
assets/environment.js
assets/viewer.js
assets/broadcaster.js
```

Each HTML file loads the Twitch Extension Helper before local assets:

```text
https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js
```

Zip the contents of this directory, not the directory itself, when uploading a Twitch Extension version. The viewer uses Twitch `onAuthorized`, sends the signed JWT to ChatXPT's server-only EBS endpoints, and renders the canonical select-then-confirm vote, acknowledgement, countdown, winner, active-progress, result, and reconnect states. Config and Live Config require Twitch's signed broadcaster role and consume the same authoritative session used by Studio and viewers.

The EBS destination is build-owned in `assets/environment.js` and defaults to the exact Local Test origin:

```text
https://localhost:3000
```

Before a Hosted Test upload, replace that exact origin with the deployed HTTPS ChatXPT origin and add the same domain to Twitch's URL-fetching allowlist. Do not source the origin from a Viewer Path query, local storage, or viewer input; the bearer token must never be redirectable to an untrusted host.

```text
ebsOrigin: "https://your-chatxpt-host.example"
```

The backend must hold `TWITCH_EXTENSION_SECRET`, validate the JWT signature and expiry, and resolve the token's channel to an active ChatXPT session. No voter key, actor, channel, or session authority comes from browser input. The uploaded package and automated signed-token tests do not by themselves prove a real Twitch Local Test, Hosted Test, Extension review, or production Supabase run; capture those separately.

Role 1 owns the package shape, EBS boundary, and Twitch registration. The Next.js `/viewer.html` route mounts Role 5's canonical viewer surface, while `/config.html` and `/live-config.html` mount Role 4's compact surfaces. This dependency-free static build preserves their core authority and interaction boundaries for Twitch Asset Hosting; the Next modules remain the canonical UI implementations.
