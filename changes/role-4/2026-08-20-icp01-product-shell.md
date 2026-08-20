## Summary

- Started ICP-01 by mounting `/studio` as the product Home shell and adding dedicated authenticated Studio routes for Gameplay Engine, Live Analytics, Live Quests, Profile & Defaults, Stream Settings, and Test Lab.
- Added a shared product navigation shell with streamer-facing unavailable states instead of tester-facing status copy.
- Added a shared Studio availability helper so product-page unavailable controls render as inert reason/next-step labels, not dispatchable actions.
- Scrubbed streamer-visible Studio, compact Twitch, setup/status, and private stream-context copy so it no longer exposes revision, role, contract, diagnostic-route, or live-evidence wording outside diagnostic surfaces.
- Kept incomplete capabilities disabled or explanatory; this is component progress only and does not claim owner snapshot acceptance, real-input verification, or final product acceptance.

## Evidence

- Prior shell pass: `npm run test -- src/streamer/studio-product-pages.test.tsx src/streamer/streamer-public-entry.test.ts src/app/server/studio-session.test.ts`
- This copy/availability cleanup: not run by Codex at owner request; owner will perform final testing.
