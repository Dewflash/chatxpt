# Add persistent Studio management and compact live control

- **Type:** Added
- **Role:** Role 4
- **Issue/PR:** #140 / #142
- **Summary:** Adds the full streamer management presentation, supported persistent defaults, explicit saved-versus-session provenance, conservative gameplay evidence states, mixed AI/fallback disclosure, per-layer health and recovery, manual quest controls, compact Twitch Config, and status-first Twitch Live Config.
- **Integration impact:** Role 1 can mount `StudioManagementSurface`, `TwitchConfigSurface`, and `TwitchLiveConfigSurface` through thin routes and supply canonical views, readiness, command results, and dispatch. Issue #140 records missing game/list/accessibility mutation fields and the absent session-override view/patch/clear contract.
- **Verification:** Focused Role 4 suite (8 files / 44 tests), scoped ESLint, TypeScript, desktop Studio inspection at 1440 px, narrow Studio inspection at 390 px, Live Config inspection at 430 px, focusable-control DOM review, full repository gate (57 files / 416 tests plus production build and secret scans), and `git diff --check`.
- **Reality status:** UI rendering and command construction use canonical fixture contracts. No real Twitch, OBS, gameplay, AI provider, persistence, realtime, or route-mount evidence is claimed; unsupported authoritative edits stay disabled rather than using browser storage.
