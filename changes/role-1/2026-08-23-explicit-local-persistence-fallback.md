# Keep the demo workflow available without Supabase

- **Type:** Fixed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Local ChatXPT can explicitly bypass configured Supabase persistence so verified Twitch, gameplay capture, quests, viewer fallbacks, and OBS can continue on the existing process-local runtime.
- **Integration impact:** Adds the server-only `CHATXPT_PERSISTENCE_MODE=memory` local override and disables Supabase realtime while it is active; hosted environments continue to fail closed instead of relying on process-local state.
- **Verification:** Focused environment, realtime-access, and Studio session tests; local deployment health and Twitch OAuth-start probes.
- **Reality status:** The memory runtime and OAuth start are running locally. Twitch callback completion and OBS capture remain owner-operated live checks; no Supabase Cloud persistence is claimed.
