# Make the local deterministic quest contingency explicit

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** pending
- **Summary:** Live Quests now offers an explicit three-quest local fallback that states it works without gameplay tracking, Twitch chat, or an AI provider and explains how the validated batch reaches viewer voting or direct Manual activation.
- **Integration impact:** Role 4 renders the control; the existing Role 1 command path, Role 3 deterministic validator, and Role 5 viewer/OBS projections remain authoritative and unchanged.
- **Verification:** Focused Studio, command, session, and OBS server tests pass 4 files / 84 tests. A server integration regression generates without gameplay or audience evidence, approves the batch into voting, and reads the same revision/options from the permanent public OBS overlay. The full `npm run check` gate passes 123 test files / 1,034 tests, lint, typecheck, role boundaries, hygiene/evidence/client-secret checks, and the production build.
- **Reality status:** The UI and server publication checks are component/in-memory integration evidence. The fallback candidates are deliberately evidence-free and labelled deterministic; they are not presented as extracted gameplay or AI output. A fresh owner-operated Twitch/OBS browser run remains unverified.
