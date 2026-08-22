# Show effective boundaries in Live Quests

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** pending
- **Summary:** Live Quests now opens with a compact Quest Status header and the current lifecycle state, game fit, selected defaults, and saved safety boundaries; all three recommendation cards align difficulty, duration, and points on one bottom row.
- **Integration impact:** No contract change; the streamer UI projects existing authoritative `StreamerViewModel` profile, session, and quest-cycle fields.
- **Verification:** After the metadata alignment, the focused Live Quests suite passed 44 tests, `git diff --check` passed, and the production build passed. The full gate passed lint, TypeScript, boundaries, hygiene/evidence checks, and 121 test files before one unrelated concurrent viewer-copy assertion failed because it expects `Choose the sidequest` while the Twitch Extension now renders `Vote now`.
- **Reality status:** Real UI source verified with canonical fixture rendering; no authorised live Twitch quest cycle or owner browser screenshot was exercised.
