# Align the Live Quests boundary cards

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** pending
- **Summary:** Live Quests presents its four authoritative boundary summaries as an equal-size compact 2x2 desktop grid, with the trailing `Chat Guided, Creative` defaults kept together.
- **Integration impact:** Presentation-only Studio change; no quest, profile, viewer, overlay, command, or runtime contract changed.
- **Verification:** Focused Live Quests render suite passed 1 file / 47 tests; scoped ESLint and `git diff --check` passed. Local browser checks measured four equal 413×43 cards at 1416px and four equal 208×43 cards at the screenshot-equivalent 708px compact desktop width; the compact grid was 93px tall with no horizontal overflow or console warnings/errors. Full `npm run check` passed 123 files / 1,030 tests plus lint, TypeScript, boundaries, hygiene/evidence/runbook checks, production build, and client-secret scans.
- **Reality status:** Real source change based on the owner's accepted UI snapshot; no external Twitch, OBS, or gameplay-input evidence is required for this presentation-only layout.
