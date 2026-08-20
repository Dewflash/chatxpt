# Role 2 To-Do: AI Intelligence and Data Extraction

**Owner:** `joelyrk`

Keep this role's statuses and evidence current. Any contributor may update affected rows. Shared-contract work may be implemented immediately with Role 1 notification, producer/consumer tests, and pre-merge deconfliction by the contributor landing the work; Role 1 assists but is not an approval gate. Use a `cross-role` issue only for durable unresolved coordination.

Execute these outcomes through `docs/build-plans/ROLE-2-BUILD-PLAN.md`; its decision gates belong to Joelyrk unless explicitly marked joint or escalated.

**Next pass:** execute `docs/build-plans/MINECRAFT-AWARE-IMPLEMENTATION-PLAN.md` before recording final real-input evidence. Keep Vanilla Minecraft Java Survival with default HUD as the primary demo target, but support best-effort Minecraft-like modded HUD recognition when hearts, hunger, hotbar, menu/sleep, damage, and activity cues remain visually detectable. Send AI only typed known/unknown facts, source ids, confidence, freshness, streamer goal, active ChatXPT quest state, restrictions, and supported/unsupported facts; never raw frames or raw chat. Then run `role-2/real-input-evidence` against Role 1's merged browser `FrameSource` and evaluate the D-072-approved OpenAI `gpt-5.6-terra` path with bounded normalised context.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R2-001 | P0 | IN PROGRESS | Inspect the prototype and implement Role 2's public port/fixture boundary against provisional contracts. | Role 1 provisional contracts | Public entry points and producer/consumer tests name inputs, outputs, provenance, capabilities, fixtures, and no cross-role internal imports. |
| R2-009 | P0 | DONE | Decide and deliver separate but synchronised current-MVP build plans for Roles 4 and 5 under D-016. | Current prototype; D-016; integration contract | Plans share deadlines/dependency matrix and define view models, commands, fixture states, route mounts, public entries, P0/P1/exclusions, acceptance evidence, and early design-system handoff; each owner provided one feasibility review, Role 2 accepted both without a scope revision, and Role 1 was notified through issues #15/#16. |
| R2-002 | P0 | IN PROGRESS | Implement tiered real-frame extraction from Role 1's OBS Virtual Camera interface. | Shared extraction contract and real frame source | Universal activity signals work across multiple owned action-game examples; calibrated adapters emit specific HUD facts only when supported; confidence/capabilities/unknown and resource measurements are evidenced. |
| R2-003 | P0 | IN PROGRESS | Implement audience/gameplay snapshot and behavioural intelligence. | R2-002; audience contract | Timestamped/confidence-scored output for energy, sentiment, intent, humour, risk, boredom, hype, and repeated requests. |
| R2-004 | P0 | IN PROGRESS | Apply the shared provider-quality criteria to the D-072-approved OpenAI path with Role 3. | D-072; existing Role 2/3 rubrics | Evaluation covers latency, existing-credit availability, privacy/retention, reliability, structured output, quest quality, and fallback without reopening adoption. |
| R2-005 | P0 | IN PROGRESS | Evaluate and refine the approved server-only OpenAI `gpt-5.6-terra` adapter and bounded model-ready context. | D-072; team-owned credited credential when available | Strict exactly-three structured output, 8-second timeout, privacy-safe observations, source/freshness validation, and algorithmic fallback are exercised without vendor payload leakage or a live claim absent recorded evidence. |
| R2-006 | P0 | IN PROGRESS | Produce exactly three candidate quests plus metadata through the approved provider-with-fallback boundary and the permanent credential-free algorithmic path. | R2-003; D-072 | Candidate output conforms to contract and includes confidence, reason, provider/algorithmic/fallback status, and traceable inputs. Missing credentials/credit never block the algorithmic path. The credential-free algorithmic path now prefers safe Minecraft-aware templates when Minecraft is selected or evidenced, while preserving game-neutral prompts for other games; final tests/evaluation remain open. |
| R2-007 | P0 | IN PROGRESS | Build credential-free and malformed/provider-failure behaviour. | Current mock engine | Tests demonstrate deterministic fallback and clear provider status. |
| R2-008 | P1 | IN PROGRESS | Create representative AI/extraction evaluation cases and evidence. | Ongoing | Multiple game genres, audience moods, unsafe/noisy cases, latency results, and documented limitations. |
| R2-010 | P0 | IN PROGRESS | Upgrade the Minecraft-aware game-state schema, pixel-aware HUD/activity detection, and AI context contract under D-086 and `docs/build-plans/MINECRAFT-AWARE-IMPLEMENTATION-PLAN.md`. | D-086; R2-002/R2-003; Role 1 gameplay ingress | Fixture implementation now covers schema, dynamic/search-based Minecraft-like HUD observation, health/hunger/armor/hotbar fact projection, conservative selected-hotbar-category detection, visual menu/sleep detection, recent health-drop detection, low-health danger, conservative sleep/inventory/recovery/exploration activity, selected-item mining/building hints, broad hostile-like scene hints, broad biome/environment hints, damage-cause gating only after health drops, reusable generic `gameState` schema/mapping for cross-game facts, Minecraft-specific `gameFacts` layered on top when selected, active ChatXPT quest transport into typed provider context, and Role 3 unsupported-fact validation. Real vanilla/modded Minecraft evidence, selected item category accuracy beyond coarse visual classes, menu/sleep OCR or exact crafting distinction, exact mining/building/combat classification, exact damage cause, exact hostile mob type, and exact biome/environment claims remain evidence-gated follow-up before live accuracy claims. |

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
- `codex/role-2-audience-snapshot-pipeline` adds a credential-free rolling audience pipeline that turns normalised audience events into privacy-safe energy, intent, repeated-request, chat-vote, and negative-pressure signals without retaining raw chat text.
- `codex/role-2-algorithmic-candidate-strategy` adds the D2-18 credential-free algorithmic candidate strategy for exactly-three output without selecting or calling a provider.
- `role-2/real-fixture-spike` consumes the canonical ephemeral `FrameSource` through capped pixel sampling and frame-difference measurements, releases frames before yielding, and provides selective-region OCR plumbing without settling the open Phase 3 classification/confidence thresholds.
- Ten focused visual/OCR tests use explicitly synthetic pixels and a fake OCR adapter; they prove fixture-only component behaviour, not real extraction or OCR accuracy.
- `codex/role-2-extraction-evidence` adds a Role 2-owned gameplay/chat evidence catalogue so team-owned recordings, sanitised chat, live OBS frames, and synthetic fixtures are labelled before use. It prevents synthetic fixtures from supporting live-demo claims and requires separated annotations for gameplay evaluation.
- Fixture-only UI-X09 proposals cover intelligence and generation disclosure states without being exported to product consumers or labelled live.
- Outstanding before `DONE`: Role 1 review/promotion of canonical UI-X09 fixtures, two team-owned or authorised gameplay samples plus separate annotations, sanitised/real chat fixtures, and one real browser-delivered `FrameSource` execution.

## Current R2-009 evidence

- D2-01 through D2-03A were answered as one batch on 3 August 2026.
- The accepted baseline is recorded in `docs/build-plans/ROLE-4-BUILD-PLAN.md`, `docs/build-plans/ROLE-5-BUILD-PLAN.md`, and `docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md`.
- Role 4's review in [issue #15](https://github.com/Dewflash/chatxpt/issues/15) and PR #30 required no scope revision. Role 5's F5-01 through F5-04 review and settled D5-01 through D5-04 baseline were [accepted in issue #16](https://github.com/Dewflash/chatxpt/issues/16#issuecomment-5189664413) without a scope revision.
- Every missing upstream seam remains assigned through issues #17-#26 with an accepted fixture, disabled, or unavailable interim path; neither UI role may invent backend, lifecycle, vote, timer, reward, permission, or persistence authority.

## Current R2-004/R2-007 evidence

- `role-2/provider-fallback-evaluation` defines the Role 2 operational trial matrix aligned to Role 3's provider-quality rubric without selecting a provider or model.
- The provider-neutral strategy enforces a configurable timeout and canonical exactly-three/provider-label validation, preserves caller cancellation, and invokes an injected credential-free algorithmic strategy after classified provider failures.
- Privacy-safe observations and summaries cover success, malformed output, timeout, refusal, rate limiting, unavailability, error, fallback outcome, and p50/p95 latency without retaining raw provider payloads.
- Fixture tests cover valid, partial, overfull, invalid, duplicate, incorrectly labelled, timeout, refusal, rate-limited, unavailable, generic-error, cancellation, invalid-fallback, and metrics cases. D-072 settles the provider/model and timeout; a real credited provider run, Role 3 scoring, privacy review, and evidence-manifest entry remain open.

## Current R2-003 evidence

- D2-12 through D2-15 were approved as one batch on 8 August 2026 and recorded in the Role 2 build plan.
- `codex/role-2-audience-snapshot-pipeline` adds a 30-second rolling window with explicit sample size, freshness, expiry, confidence, in-memory raw-chat processing, per-viewer spam controls, repeated requests across multiple qualifying events, conservative unknown handling, unsafe-intent suppression, and strict evidence-class partitioning.
- Required regressions cover sparse, spammy, repeated-request, sarcastic/conflicting, unsafe, and multilingual or unrecognised inputs. No real Twitch-chat execution is claimed yet.

## Current real-input evidence pass

- `role-2/real-input-evidence` adds a Role 2 report boundary that accepts canonical OBS measurements, keeps human annotations separate, aggregates quiet/action/transition and p50/p95 processing metrics, records sanitised OCR and honest unknown observations, and never persists raw frames.
- The bundle assessment requires two distinct authorised samples, all three labels, one selective-OCR observation, latency coverage, an unknown case, and a privacy-reviewed sanitised audience fixture. Diagnostic inputs are explicitly refused as real evidence.
- D2-07 through D2-11 were approved together on 6 August 2026. Diagnostic code now derives non-overlapping quiet/action/transition thresholds, requires confidence 0.75, returns conflict/stale/low-confidence states honestly, rate-limits three-frame OCR bursts, preprocesses named crops locally, and confirms OCR only after two matching high-confidence readings out of three.
- Focused tests currently use diagnostic-shaped fixture data only. Two user-authorised Brawl Stars clips are now source-inspected with separate relative-time annotations and local-only hashes; raw clips, sampled frames, and visible player handles remain outside Git. A browser-delivered live `FrameSource`, the clean Tesseract dependency replacement in [PR #126](https://github.com/Dewflash/chatxpt/pull/126), sanitised real Twitch chat, resource observations, privacy review, artifact, and evidence-manifest entry remain required.

## Current multi-game extraction pass

- `codex/multigame-extraction` adds a Role 2-private generic/Brawl Stars/Minecraft profile registry, trusted game-identity gate, bounded spatial motion and global-translation measurement, conservative temporal interpretation, adaptive analysis cadence, and Minecraft vanilla-HUD capability fingerprint.
- Universal labels remain observable and game-neutral. The implementation separates rapid coherent global motion, erratic reversal, mixed local activity, stability, and scene settling; it never claims a camera rotation, panic, intent, or combat from pixel movement alone.
- Calibrated adapters cannot activate from visual guessing, profile switches clear temporal history, arbitrary high-detail pixels cannot advertise a Minecraft layout, and modded/hidden HUDs retain universal signals while calibrated values remain unknown.
- The canonical `FrameSource` bridge releases every input frame before yield, skips unscheduled baseline frames before pixel sampling, caps retained downsample state at 16,384 pixels, and projects assessments into the existing `GameplaySnapshot` without adding a shared contract.
- Current acceptance is fixture/component evidence only. Real vanilla and modded Minecraft OBS runs, real thresholds, HUD/parser calibration, resource observations, and evidence-manifest entries remain required before any live accuracy claim.
- The owner-authorised Brawl clips now pass through the production analyzer via the reusable recording-replay boundary at 160×90/10 fps. The active/action sample confirmed calibrated HUD capability on 317/340 decoded frames; the quiet/loading sample remained universal for 178/220 frames and became calibrated only after the match HUD appeared. Analyzer-only p50/p95 was 7.50/8.05 ms and 6.61/7.59 ms respectively on this machine. These are local diagnostic results, not OBS evidence.
- The canonical controlled LLM strategy now accepts normalized gameplay/audience/profile context, excludes identity/raw chat, requires exactly three strict drafts, rejects invented signal citations, and preserves algorithmic fallback on disabled/missing credentials, refusal, timeout, rate limit, outage, or malformed output. D-072 approves its OpenAI `gpt-5.6-terra` use under the recorded credit/privacy limits. No key was configured and no provider call was made by the existing evidence.
- Role 1's `/diagnostics/gameplay-extraction` now composes the real browser `FrameSource` with this analyzer at a burst-capable 100 ms input cadence. OBS Virtual Camera started successfully, but macOS denied the selected browser camera permission before a frame crossed the seam; no live accuracy claim or evidence-manifest entry is made.

## Current D-086 Minecraft-aware upgrade target

- The owner approved Vanilla Minecraft Java Survival with default HUD as the primary demo target, plus a best-effort modded-HUD stance: Minecraft-like hearts, hunger, hotbar, menu/sleep, damage, and activity cues should be detected when visual patterns remain recognisable; hidden or heavily modified HUDs must degrade to `unknown`.
- The next implementation should move beyond fixed-region layout confidence toward pixel-aware search, UI-scale tolerance, and relative-layout confidence boosts. It must not claim exact health, hunger, damage cause, mob type, biome, or objective completion without confidence-scored supporting evidence.
- The schema should separate `gameFacts`, `streamerIntent`, and `activeChatXptQuest`. It should expose typed known and unknown facts with source ids, confidence, freshness, supported/unsupported status, and evidence source so both weak and strong AI models receive the same constrained context.
- Raw frames or screenshots remain excluded from provider input unless the owner separately approves a vision-model privacy/cost expansion.
- Current fixture implementation adds `src/extraction/game-state-context.ts`, `src/extraction/minecraft-state.ts`, dynamic lower-HUD search plus armor and selected-hotbar category support in `minecraft-hud.ts`, conservative visual menu/sleep detection in `minecraft-menu.ts`, conservative runtime facts in `minecraft-runtime.ts`, Minecraft fact projection into `GameplaySnapshot`, active ChatXPT quest context on the candidate-provider seam, a typed cross-game `gameState` model-context block, a typed `minecraft` model-context block for selected Minecraft sessions, and Role 3 fact dependencies for unsupported Minecraft-specific claims. Focused fixture tests pass; real OBS/video evidence is still required before demo accuracy claims.
- `codex/minecraft-schema-decisions` adds Minecraft-aware credential-free algorithmic templates that avoid unsupported health, hunger, hotbar, sleep, hostile, damage-cause, and biome claims unless future evidence-backed candidates cite matching known signal IDs. The corresponding updated tests are source-edited but not run under the current owner testing instruction.
