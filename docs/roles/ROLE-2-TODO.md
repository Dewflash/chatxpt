# Role 2 To-Do: AI Intelligence and Data Extraction

**Owner:** `joelyrk`

Update only this role's statuses and evidence. Raise shared-contract needs through a `cross-role` GitHub Issue before implementation.

Execute these outcomes through `docs/build-plans/ROLE-2-BUILD-PLAN.md`; its decision gates belong to Joelyrk unless explicitly marked joint or escalated.

**Next pass:** answer the Phase 1 gate once and deliver R2-P01/R2-P02 plus R2-P02A (separate but synchronised Role 4/5 plans and dependency matrix). Then begin R2-P03 ports/real owned fixtures and R2-P03A risk spikes without waiting for full Twitch, OBS, or Role 3 implementation.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R2-001 | P0 | IN PROGRESS | Inspect the prototype and implement Role 2's public port/fixture boundary against provisional contracts. | Role 1 provisional contracts | Public entry points and producer/consumer tests name inputs, outputs, provenance, capabilities, fixtures, and no cross-role internal imports. |
| R2-009 | P0 | IN PROGRESS | Decide and deliver separate but synchronised current-MVP build plans for Roles 4 and 5 under D-016. | Current prototype; D-016; integration contract | Plans share deadlines/dependency matrix and define view models, commands, fixture states, route mounts, public entries, P0/P1/exclusions, acceptance evidence, and early design-system handoff; each owner provides one feasibility review and Role 1 is notified. |
| R2-002 | P0 | BLOCKED | Implement tiered real-frame extraction from Role 1's OBS Virtual Camera interface. | Shared extraction contract and real frame source | Universal activity signals work across multiple owned action-game examples; calibrated adapters emit specific HUD facts only when supported; confidence/capabilities/unknown and resource measurements are evidenced. |
| R2-003 | P0 | BLOCKED | Implement audience/gameplay snapshot and behavioural intelligence. | R2-002; audience contract | Timestamped/confidence-scored output for energy, sentiment, intent, humour, risk, boredom, hype, and repeated requests. |
| R2-004 | P0 | READY | Define provider evaluation criteria with Role 3. | Accepted D-014 | Joint comparison covers OpenRouter and alternatives, latency, cost, privacy, reliability, structured output, quest quality, and fallback. |
| R2-005 | P0 | BLOCKED | Implement chosen provider adapter and model-ready context. | Joint recommendation accepted by Role 1 | Server-only provider path returns validated structured output; no vendor payload leaks into core. |
| R2-006 | P0 | BLOCKED | Produce exactly three candidate quests plus metadata for Role 3. | R2-003 and R2-005 | Candidate output conforms to contract and includes confidence, reason, provider/fallback, and traceable inputs. |
| R2-007 | P0 | READY | Build credential-free and malformed/provider-failure behaviour. | Current mock engine | Tests demonstrate deterministic fallback and clear provider status. |
| R2-008 | P1 | READY | Create representative AI/extraction evaluation cases and evidence. | Ongoing | Multiple game genres, audience moods, unsafe/noisy cases, latency results, and documented limitations. |

## Decisions Role 2 may make without Role 1

- Extraction implementation details behind the accepted interface
- Signal aggregation and confidence approach
- Audience-analysis methods and prompts
- Provider adapter design and evaluation method

Provider/model adoption is a joint Role 2/Role 3 recommendation and requires Role 1 awareness because it affects cost and external services.

## Current R2-001 evidence

- D2-04 through D2-06 were answered as one batch on 4 August 2026 and recorded in the Role 2 build plan.
- `src/extraction/` defines the Role 1 source-adapter boundary plus private observation fusion and snapshot construction; `src/ai/` exports validating canonical intelligence and candidate provider factories.
- Role 2 producer tests cover known, partial/unsupported, low-confidence, conflicting, stale, unavailable, permission-denied, abort, malformed candidate-count, and duplicate-title behaviour.
- Fixture-only UI-X09 proposals cover intelligence and generation disclosure states without being exported to product consumers or labelled live.
- Outstanding before `DONE`: Role 1 review/promotion of canonical UI-X09 fixtures, two team-owned or authorised gameplay samples plus separate annotations, sanitised/real chat fixtures, and one real browser-delivered `FrameSource` execution.

## Current R2-009 evidence

- D2-01 through D2-03A were answered as one batch on 3 August 2026.
- Drafts exist at `docs/build-plans/ROLE-4-BUILD-PLAN.md`, `docs/build-plans/ROLE-5-BUILD-PLAN.md`, and `docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md`.
- Outstanding before `DONE`: Role 4 feasibility review in [issue #15](https://github.com/Dewflash/chatxpt/issues/15), Role 5 feasibility review in [issue #16](https://github.com/Dewflash/chatxpt/issues/16), one Role 2 revision/comparison, and Role 1 notification. UI-X dependencies are tracked in issues #17-#26.
