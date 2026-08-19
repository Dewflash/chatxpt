# Gate private Director Cues deterministically

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** #150 / #151
- **Summary:** Adds the pure Live Director suitability and attention-budget policy that chooses `stay-silent`, `wait`, or `offer-cue` without fabricating audience or gameplay certainty.
- **Integration impact:** Deconflicted with merged R1-023/R1-024 by consuming canonical `DeclaredStreamIntent` and `AudiencePointer`; no Core contract changed.
- **Verification:** `npm.cmd test -- src/core/contracts.test.ts src/quest-engine/intervention.test.ts tests/integration/role-entrypoints.test.ts` passed 79 tests; `npm.cmd run typecheck`, focused lint, and `git diff --check` passed; `npm.cmd run check` passed 80 files / 608 tests plus the production build and all repository gates.
- **Reality status:** Deterministic fixture-only component evidence. No real Twitch chat, OBS gameplay, provider call, persistence, UI, or end-to-end runtime was exercised.
