## Summary

- Added `/studio/gameplay/capture` as a Studio product route for OBS Virtual Camera gameplay capture.
- Reused the existing browser frame source, multi-game analyzer, and `/api/gameplay/ingress/grant` plus `/api/gameplay/ingress/snapshot` boundaries instead of creating a parallel capture authority.
- Updated Gameplay Engine links so streamers open the product capture setup route instead of the diagnostics route.

## Evidence

- Source-only update at owner request; Codex did not run tests or real OBS/browser permission checks.
- Real OBS Virtual Camera proof, browser permission allow/deny/revoke recovery, and recorded evidence remain open.
