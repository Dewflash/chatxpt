# Add the local golden workflow harness

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Adds a local fixture-only diagnostic golden workflow runner and API route that exercises the memory runtime from session start through intervention, candidate generation, streamer approval, two hosted-board votes, vote-close scheduling, progress, terminal success, and shared streamer/viewer/overlay snapshots.
- **Integration impact:** Gives Roles 1, 4, and 5 one repeatable local spine for checking the same authoritative revision across surfaces while live Twitch/OBS/Supabase evidence remains separate.
- **Verification:** Focused harness tests cover the runner and diagnostic route. Full `npm run check` is required before merge.
- **Reality status:** Fixture/local diagnostics only. It does not claim live Twitch, OBS capture, Supabase cloud, browser, provider, or Vercel evidence. Vote-close activation uses a diagnostic adapter until PR #57 is merged into this branch.
