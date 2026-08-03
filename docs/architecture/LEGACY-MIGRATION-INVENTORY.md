# Legacy Prototype Migration Inventory

**Owner:** Role 1 (`Dewflash`)

**Status:** Factual inventory only. D1-01 (final file mapping) and D1-03 (temporarily retained behavior) remain open, so this document does not authorize moving, deleting, or redesigning legacy files.

## Why this exists

The checked-in prototype predates the five exclusive source boundaries. It is still useful as a build-preservation and local-diagnostic baseline, but its files combine multiple future owners. The additive public entrypoints and canonical contracts are ready; this inventory makes the remaining split explicit without deciding it on behalf of Roles 2-5.

## Current files and migration seams

| Legacy file | Current responsibility | Likely seam(s), not a final assignment | Decision still required |
| --- | --- | --- | --- |
| `src/lib/domain.ts` | Prototype-only gameplay, sentiment, profile, sidequest, response, and active-overlay types/schemas | Canonical replacements are under Role 1 `src/core/`; adapters are needed while any legacy screen remains reachable | D1-01 mapping and D1-03 retention |
| `src/lib/demo-data.ts` | Synthetic battle-royale scenario and sample chat | Explicit test/diagnostic fixture; future extraction/intelligence and UI examples span Roles 2, 4, and 5 | Whether to retain any diagnostic route or convert only selected data |
| `src/lib/mock-engine.ts` | Rule-based candidate selection, boundary filtering, points, and fallback quests | Mixes Role 2 algorithmic candidates with Role 3 validation/reward/fallback authority | Joelyrk/L0pch split after their decision gates; no mechanical one-owner move is safe |
| `src/lib/mock-engine.test.ts` | Tests the combined legacy mock engine | Preserve until equivalent owner tests cover any retained behavior | Which assertions remain migration evidence under D1-03 |
| `src/lib/openai-engine.ts` | Paid OpenAI adapter, generation prompt, JSON schema, and direct candidate return | Mixes Role 2 provider adapter/context with Role 3 quest-quality instructions; paid use is not authorized | Joint Role 2/3 provider recommendation and D1-03 retention/removal |
| `src/lib/overlay-store.ts` | Browser `localStorage` plus `BroadcastChannel` active-quest transport | Role 1 local diagnostic transport; output is rendered by Role 5 | Whether this remains a documented local fallback after authoritative realtime lands |
| `src/components/control-room.tsx` | One page combines synthetic signals, streamer settings, candidate generation, viewer voting, activation, results, and overlay control | Must be split across Role 4 streamer UI, Role 5 viewer UI, and Role 1 command/view wiring | D1-03 behavior retention plus Role 2-authored Role 4/5 plans |
| `src/components/overlay-stage.tsx` | Reads local active quest, derives a client timer, and renders the overlay | Role 5 visual module consuming a Role 1 read-only authoritative view/OBS mount | Role 5 UX plan and D1-03 retention; client timer cannot remain authoritative |
| `src/app/api/sidequests/route.ts` | Validates prototype input, calls optional paid OpenAI, and falls back to the combined mock engine | Thin Role 1 route should eventually compose Role 2 candidate and Role 3 engine public ports | D1-03 route retention and Role 2/3 implementation readiness |
| `src/app/page.tsx` | Mounts the combined control room | Thin Role 1 mount for Role 4/5 public modules | Role 2-authored UI plans and D1-03 route retention |
| `src/app/overlay/page.tsx` | Mounts the legacy overlay | Thin Role 1 OBS route mounting Role 5's public overlay module | Role 5 plan, OBS route decision D1-08/D1-09, and D1-03 retention |
| `src/app/globals.css` | Styles all current prototype surfaces | Future tokens/components belong to Role 4; Role 1 retains the single app-level import | Role 4 visual-system definition and D1-03 retained legacy styling |

## Behaviors currently reachable

These are observations, not commitments to preserve them:

1. `/` exposes manually editable synthetic gameplay, sentiment, and streamer inputs.
2. `POST /api/sidequests` returns exactly three prototype sidequests through optional paid OpenAI or the combined mock engine.
3. The control room holds votes locally in one browser and lets the same operator activate and complete/fail/clear a quest.
4. `/overlay` receives active-quest changes through browser storage/channel state and derives its countdown from the client clock.
5. The current route contains no Twitch authentication, real gameplay capture, multi-viewer authority, Supabase persistence, or server revision.

None of those behaviors may be cited as live Twitch, extraction, AI-fallback, realtime, or multi-user evidence. The optional OpenAI route is not the accepted free-provider path.

## Safe migration order after the two decisions

1. Record D1-01 and D1-03 without changing another owner's component choices.
2. Add adapters from any temporarily retained route to the canonical `@/core` contracts.
3. Mount Role 4/5 public modules from thin `src/app/` files only after their plan review.
4. Replace combined generation with Role 2 candidate output followed by Role 3 decisions through the Role 1 orchestrator.
5. Replace client-owned votes/timers/state with authoritative commands, revisions, persistence, and read-only views.
6. Remove a legacy path only after its retained equivalent passes build and behavior-preservation checks.

## Enforcement

`npm run check:boundaries` prevents new role-owned code from importing another role's private files. The legacy `src/lib/` and `src/components/` trees are excluded from that ownership scan until D1-01/D1-03 are settled; new role modules cannot import them, while thin `src/app/` routes may continue mounting the existing prototype temporarily.
