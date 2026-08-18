# Gate private Director Cues deterministically

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** #150 / pending
- **Summary:** Adds the pure Live Director suitability and attention-budget policy that chooses `stay-silent`, `wait`, or `offer-cue` without fabricating audience or gameplay certainty.
- **Integration impact:** Role 1's forthcoming R1-023 canonical intent/audience context seam must replace the explicitly temporary Role 3 adapter before integration; no Core contract changed.
- **Verification:** `npm.cmd test -- src/quest-engine/intervention.test.ts` passed 38 tests; `npm.cmd run typecheck` passed; `npm.cmd run lint -- src/quest-engine/intervention.ts src/quest-engine/intervention.test.ts src/quest-engine/index.ts` passed; `npm.cmd run check` passed 79 files / 578 tests plus the production build and repository checks.
- **Reality status:** Deterministic fixture-only component evidence. No real Twitch chat, OBS gameplay, provider call, persistence, UI, or end-to-end runtime was exercised.
