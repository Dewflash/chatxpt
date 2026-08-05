# Quest-engine failure and portability evaluation

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** R3-008
- **Summary:** Adds deterministic fixture evaluation for provider absence and malformed output, reconnect-relevant reconstructed state, cancellation semantics, and game-neutral fallbacks across varied genre profiles.
- **Integration impact:** No shared contract changes. Role 1 still owns persistence, deduplication, reconnect transport, authoritative revisions, and vote close; issue #42 remains the activation blocker.
- **Verification:** `npm.cmd exec vitest run src/quest-engine` passes 50 focused tests. `npm.cmd run check` passes lint, typecheck, role boundaries, all 123 tests, and the production build.
- **Reality status:** Evaluation inputs are explicitly fixture-only. No real provider, OBS capture, Twitch activity, persistence, network reconnect, or end-to-end workflow is claimed.
