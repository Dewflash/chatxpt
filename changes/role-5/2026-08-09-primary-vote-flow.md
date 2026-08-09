# Primary viewer vote states

- **Type:** Changed
- **Role:** Role 5
- **Issue/PR:** R5-003 / pending
- **Summary:** The compact Twitch viewer now keeps Vote controls reachable, locks choices during pending and accepted states, reveals server tallies only after private acknowledgement, prioritises the active winner and result, and distinguishes community hype from private session points.
- **Integration impact:** Role 1 mounts remain responsible for local selection state, pending command state, optional typed `DomainError`, authorised vote/reaction dispatch, private recovery, and newer canonical view props. No Core contract changed.
- **Verification:** `npm test -- src/viewer/presentation.test.ts src/viewer/surfaces.test.ts tests/integration/role-entrypoints.test.ts` (3 files / 27 tests), `npm run lint`, `npm run typecheck`, `npm run check:boundaries`, compact 318x496 and mobile 390x720 Chrome screenshots, and final `npm run check` before handoff.
- **Reality status:** Component tests and screenshots use canonical fixtures only. `E-20260809-R5-002` remains unverified pending Role 1 review. Real Twitch identity/voting, authorised command dispatch, private Supabase recovery, same-revision multi-viewer behaviour, and OBS Browser Source were not exercised; the attempted automated keyboard browser runner was inconclusive and is not claimed as evidence.
