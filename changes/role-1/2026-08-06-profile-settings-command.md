# Add streamer profile settings command seam

- **Summary:** Added explicit profile voting/reward preference fields and a broadcaster-only `streamer.profile-settings` command for safe quick experience changes such as intensity.
- **Integration impact:** Role 4 can render accepted vote/reward preference state and emit a browser-safe quick-intensity command through Role 1. The command updates profile state, revisions, and role views without invoking Role 3 or changing vote duration, vote-change policy, winner logic, reward math, or persistent economy scope.
- **Verification:** Added contract, permission, orchestrator, public-entrypoint, diagnostic gateway, and jsdom harness coverage.
- **Reality status:** Fixture/local diagnostic evidence only. No deployed persistence, Twitch identity, or live streamer settings proof is claimed.
