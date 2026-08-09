## Summary

- Added the canonical `streamer.profile-settings` command for broadcaster-only profile preference updates.
- Added bounded voting and reward preferences to `StreamerProfile` without allowing vote-duration, duplicate-vote, monetary-reward, or persistent-economy changes.
- Routed profile settings through Role 1 authoritative state stamping and broadcast without invoking Role 3 lifecycle authority.

## Verification

- Pending in this pass: focused contract/orchestrator tests and `npm run check`.
