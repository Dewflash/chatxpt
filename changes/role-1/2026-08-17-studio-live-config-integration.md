---
title: Mount authenticated Studio and Twitch live controls
type: changed
area: integration
author: role-1
---

- Mounted the reviewed Role 4 Studio, Twitch Config, and Twitch Live Config modules on their canonical routes.
- Added a secure manual broadcaster-session bootstrap that exchanges a server-only setup key for an HttpOnly, expiring grant and maps signed Twitch broadcaster JWTs to the same authoritative channel session.
- Routed saved settings and sidequest controls through the sole application orchestrator while keeping unimplemented provider setup actions explicitly diagnostic-only.
- Standardised finals UI wording around Gameplay Capture, Capture Health, Gameplay Activity, Signal Confidence, Detected Game Facts, Game Profile, and sidequests.
