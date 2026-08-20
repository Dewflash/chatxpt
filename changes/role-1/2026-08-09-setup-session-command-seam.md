## Summary

- Added the public `streamer.setup` and `streamer.session` command contracts for Studio integration controls.
- Added setup readiness schemas and fixture examples for Twitch, OBS capture, realtime, intelligence, and session readiness.
- Published setup/session commands through the diagnostic UI gateway while keeping them fixture-validation only.
- Rejected invalid service/action pairs such as `obs-capture` plus `connect-twitch`.

## Verification

- `npm run test -- src/core/contracts.test.ts src/core/application/ui-gateway.test.ts src/streamer/streamer-commands.test.ts` was covered by the 20 August repository consistency rerun; the encompassing seven-file run passed 94 tests, and full `npm run check` passed 82 Vitest files / 666 tests plus the production build.
