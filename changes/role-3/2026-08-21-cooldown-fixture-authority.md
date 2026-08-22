# Authoritative cooldown fixture

- **Type:** Fixed
- **Role:** Role 3
- **Issue/PR:** #22 / pending
- **Summary:** The shared cooldown example now carries the terminal result and exact authoritative timing required by the quest lifecycle.
- **Integration impact:** Corrects the Core UI-X06 producer fixture and adds a Role 3 consumer assertion that the published state traverses the authoritative tick deadline into idle.
- **Verification:** Focused Core producer, quest-engine consumer, and viewer-surface coverage passed (3 files, 118 tests). `npm.cmd run check` passed (90 files, 727 tests), including the production build and client-secret scan.
- **Reality status:** Fixture-labelled contract evidence only. No real Twitch, OBS, provider, Supabase, or golden-workflow run is claimed.
