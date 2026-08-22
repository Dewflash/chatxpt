# Remove redundant visual activity proof row

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** pending
- **Summary:** Live Detector Proof no longer shows `Visual activity` inside Minecraft's `Activity` column.
- **Integration impact:** Display only. The universal `game-vision-activity` signal remains available to extraction and continues powering supported `Activity intensity` rows for Brawl Stars and Generic profiles.
- **Verification:** Focused capture definition/render coverage passed 2 files / 11 tests; scoped ESLint, TypeScript, and task diff checks passed. The production-build portion of the full gate was not rerun while the owner's active `dev:twitch` process used the same Next.js workspace.
- **Reality status:** Source and canonical fixture evidence only. No new real capture or detector-accuracy claim is made.
