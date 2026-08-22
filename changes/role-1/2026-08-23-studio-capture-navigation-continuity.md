# Keep Gameplay Capture running across Studio navigation

- **Type:** Fixed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Studio now mounts one authorised application shell and keeps the active Gameplay Capture component mounted while the streamer visits other Studio pages. Returning to Gameplay Engine reveals the same preview, analyser, delivery loop, and counters without another screen picker or OBS Virtual Camera connection.
- **Integration impact:** Internal Studio routes use Next client navigation; route files remain thin and the capture surface is visually parked off-screen outside Gameplay Engine without changing frame, snapshot, quest, Twitch, or OBS contracts.
- **Verification:** Focused shell mapping, Studio rendering, authorised-client, and capture tests plus TypeScript, lint, role-boundary, full repository, and production-build checks.
- **Reality status:** Automated tests prove the persistent composition and navigation seams. Real browser screen/window and OBS Virtual Camera continuity still require owner-operated device confirmation.
