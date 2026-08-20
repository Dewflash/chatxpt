## Summary

- Added the canonical `streamer.profile-settings` command for broadcaster-only profile preference updates.
- Added bounded voting and reward preferences to `StreamerProfile` without allowing vote-duration, duplicate-vote, monetary-reward, or persistent-economy changes.
- Routed profile settings through Role 1 authoritative state stamping and broadcast without invoking Role 3 lifecycle authority.

## Verification

- `npm run test -- src/core/contracts.test.ts src/streamer/streamer-commands.test.ts tests/integration/orchestrator.test.ts` was covered by the 20 August repository consistency rerun; the encompassing seven-file run passed 94 tests, and full `npm run check` passed 82 Vitest files / 666 tests plus the production build.
