# Harden live Minecraft sensing and public gameplay context

- **Type:** Fixed
- **Role:** Role 2
- **Issue/PR:** pending
- **Summary:** Reject scenery-shaped armor and air-row false positives, recognise the purple-tinted captured drowning death screen, and translate numeric gameplay intensity into safe viewer-facing activity labels.
- **Integration impact:** Role 2 extraction and Role 1 public viewer/overlay projection; the live rehearsal also exercised Role 3 lifecycle and Role 5 hosted-board/OBS consumers without changing their contracts.
- **Verification:** Post-rebase focused Vitest coverage passes 70 tests for Minecraft HUD/menu extraction and view projection. The full `npm run check` gate passes 123 test files / 1,034 tests, lint, typecheck, role boundaries, hygiene/evidence/client-secret checks, and the production build. Real local OBS Virtual Camera plus Minecraft movement/turning, current Twitch chat, exactly-three algorithmic proposals, hosted anonymous vote, active quest, success, points/hype reward, cooldown, and matching permanent OBS overlay API revisions were also exercised.
- **Reality status:** Gameplay and Twitch inputs were real and the credential-free algorithmic fallback was used. The hosted Quest Board, not a Twitch-issued Extension JWT, supplied the vote. Purple death and rain/air regression coverage is fixture-based after the observed live failure. Automatic recovery from an unchanged frozen Virtual Camera frame remains open.
