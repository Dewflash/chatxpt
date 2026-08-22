# Make every candidate fallback game-aware

- **Type:** Changed
- **Role:** Roles 2 and 3
- **Issue/PR:** pending
- **Summary:** Replace game-neutral algorithmic, model-prompt, and deterministic fallback behaviour with selected-game-aware objectives. Add calibrated Minecraft wording, reject generic supplied/model candidates, and return typed invalid context when no game is selected instead of emitting filler.
- **Integration impact:** No shared contract change. Role 2 candidate generation and Role 3 candidate assembly now require a selected game profile; accepted official batches remain exactly three and continue through the existing deterministic safety, evidence, diversity, history, and streamer-boundary checks.
- **Verification:** `npm run check` passed, including lint, TypeScript, boundaries, repository/evidence/demo/client-secret checks, 677 Vitest tests, and the Next.js production build. Focused game-aware candidate verification passed 69 tests across the algorithmic, provider, assembler, evaluation, and Live Director conversion paths.
- **Reality status:** Source behaviour and deterministic fixture paths are verified. No paid model call, real gameplay session, live Twitch activity, or owner acceptance is claimed by this change.
