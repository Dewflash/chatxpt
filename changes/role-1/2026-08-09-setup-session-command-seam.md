## Summary

- Added the public `streamer.setup` and `streamer.session` command contracts for Studio integration controls.
- Added setup readiness schemas and fixture examples for Twitch, OBS capture, realtime, intelligence, and session readiness.
- Published setup/session commands through the diagnostic UI gateway while keeping them fixture-validation only.
- Rejected invalid service/action pairs such as `obs-capture` plus `connect-twitch`.

## Verification

- Pending in this pass: focused contract/UI gateway tests and `npm run check`.
