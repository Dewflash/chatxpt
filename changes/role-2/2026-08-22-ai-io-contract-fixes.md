# Harden AI input and output contracts

- **Type:** Fixed
- **Role:** Role 2
- **Issue/PR:** pending
- **Summary:** AI candidate requests now receive the current known streamer goal and active quest for every game, while duplicate citations and provider refusals are handled correctly.
- **Integration impact:** Adds required `streamerGoal` to the shared `CandidateInput`; Role 1 and Role 3 producers and their consumer tests are migrated in the same change.
- **Verification:** Focused Role 2 and integration tests (81 tests), `npm run typecheck`, and `npm run check` (102 test files / 799 tests plus the production build) pass.
- **Reality status:** Automated fixture and integration evidence only; no OpenAI call or live OBS/Twitch run was performed.
