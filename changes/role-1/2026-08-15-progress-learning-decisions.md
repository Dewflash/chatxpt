# Bound automatic completion and streamer learning

- **Type:** Changed
- **Role:** Role 1
- **Issue/PR:** #50 and #140
- **Summary:** Automatic success now requires a matching predicate-bearing rule stored on the active quest, while cross-session learning may adapt only visible, resettable soft streamer preferences.
- **Integration impact:** Role 3 must keep automatic success disabled until the completion-rule contract is strengthened; Roles 2 and 4 may learn soft preferences but cannot silently modify hard streamer-owned settings.
- **Verification:** `npm run check` and `git diff --check`.
- **Reality status:** These are accepted product and safety decisions; implementation and real integration evidence remain separate follow-up work.
