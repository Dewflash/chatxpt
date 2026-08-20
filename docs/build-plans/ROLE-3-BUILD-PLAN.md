# Role 3 Build Plan: Deterministic Quest Engine

**Owner:** `L0pch`

**Plan authority:** Role 1 defines phases/outcomes; L0pch owns named component decisions

**Primary directory:** `src/quest-engine/`

## Mission

Turn Role 2 intelligence and candidates into safe, feasible, varied, well-timed quest cycles with deterministic state for every streamer, viewer, participation, and OBS surface.

Role 3 is the final quest authority. AI suggests; Role 3 decides what can be shown, voted on, activated, completed, rewarded, or rejected.

## Definition of done

Role 3 is complete when:

- It runs independently against Role 2-style fixtures before live AI is ready.
- Intervention rules decide when a quest cycle should begin.
- Every candidate passes deterministic safety, feasibility, timing, diversity, repetition, and streamer-boundary validation.
- Rejected or unavailable candidates are replaced so viewers receive exactly three valid options.
- Voting, tie, veto, activation, progress, success, failure, cancellation, skip, expiry, cooldown, rewards, and history are deterministic and tested.
- Provider/AI failure cannot break the quest cycle.
- UI consumers receive stable state/events and never implement engine rules themselves.
- All lifecycle paths and the real-input golden integration have evidence.

## Architecture and evidence boundaries

- Extraction, audience analysis, provider-adapter code, Twitch/OBS integration, persistence, and UI code remain outside `src/quest-engine/`. A Role 3 contributor may implement them in their corresponding modules under the repository-wide open-contribution rule.
- Canonical contracts remain in `src/core/`. Any contributor may edit them; notify Role 1, add affected producer/consumer tests, and deconflict the change before merge. Role 1 approval is not a gate.
- Do not trust AI output without deterministic validation.
- Do not infer missing real gameplay facts. Consume Role 2 confidence/unknown values and degrade safely.
- Return deterministic state/events/allowed actions through the public `QuestEngine` port; do not persist, broadcast, authenticate, or call integration services.
- Accept canonical command IDs, expected revisions, and authoritative absolute time from Role 1; do not use a UI clock as lifecycle authority.
- Rewards remain session-scoped, non-monetary, and non-wagering.
- Simulated/crafted candidates are allowed for engine tests only; judged integration uses real Role 2 intelligence.

## Phase 1: Establish engine boundaries without waiting

### L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-01 | Internal engine architecture: reducer/state machine, services, and pure-rule boundaries | Accepted | Use a stateless `DefaultQuestEngine` over a pure state-machine reducer with small validation and policy functions. Runtime lifecycle state remains authoritative in Role 1. |
| D3-02 | Candidate, command, state, event, and error representation inside Role 3 | Accepted | Consume and return canonical Core types at the public boundary. Private transition helpers may narrow those types, but Role 3 will not create a parallel domain model. |
| D3-03 | Determinism strategy for time, randomness, and fallback selection | Accepted | Use authoritative `QuestEngineInput.now` and an injectable deterministic selector. Do not call ambient clocks or random APIs; identical input and selector configuration must produce identical output. |

### R3-P01 — Owned ports and candidate fixtures

**Outcome:** Role 3 works before Role 1/2 implementation is complete.

**Work:**

- Define Role 3-owned ports adapting canonical contracts.
- Export one documented public engine entry point and add consumer contract tests against Role 1/2 canonical examples.
- Create valid, unsafe, impossible, duplicated, stale, low-confidence, unknown-heavy, provider-failed, and malformed candidate fixtures.
- Propose missing canonical fields to Role 1.

**Acceptance:** Engine tests run without provider/Twitch/Supabase; fixtures are explicitly test-only; no Role 2 implementation import exists.

### R3-P02 — State-machine skeleton

**Required conceptual states:**

- Idle/evaluating.
- Proposed or pending streamer behaviour selected by L0pch.
- Voting.
- Active.
- Succeeded, failed, cancelled, skipped, or expired.
- Cooldown/return to idle.

**Acceptance:** Legal transitions work; illegal, duplicate, and stale-revision commands return typed decisions/errors; time and randomness are injectable; events carry correlation/revision data expected by the Role 1 orchestrator.

**Implementation record (2026-08-16):** The merged `system.quest-tick` seam now deterministically expires active quests at their recorded absolute deadline, moves terminal outcomes into the accepted 120-second cooldown, and resets elapsed cooldown state to idle. A delayed active tick traverses every elapsed boundary in one decision while preserving terminal/history, cooldown-started, and cooldown-ended events. Early ticks emit no state change or event; incomplete or internally inconsistent active/terminal/cooldown state fails closed. Role 1 retains scheduling, deduplication, revisions, persistence, and broadcast.

## Phase 2: Intervention and streamer control

### L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-04 | Intervention scoring/rules and required confidence/freshness | Accepted | Apply hard lifecycle/safety gates before a deterministic suitability score. Fact-specific decisions require fresh evidence with adequate confidence; stale, conflicting, unavailable, and unknown-heavy intelligence waits instead of fabricating suitability. |
| D3-05 | Timing, cooldown, repetition window, and interruption defaults | Accepted | Default to a 120-second cooldown and block substantially similar objectives from the previous five cycles or 30 minutes. Minor gameplay changes do not interrupt an active quest; safety, impossibility, session end, or explicit streamer control can. |
| D3-06 | Proposed/approval/veto/automatic activation behaviour | Accepted | Manual streamer approval is the MVP default: exactly three proposed options become viewer voting only after approval. Reject cancels the whole batch. Automatic activation stays disabled until safety validation and integration evidence pass. |
| D3-07 | Emergency pause, cancellation, and changing-gameplay behaviour | Accepted | Cancel and skip remain distinct terminal outcomes. Emergency pause cancels the current cycle and blocks new proposals until explicitly cleared. Ordinary resumable pause remains unavailable until Core represents paused/resume state. |

### R3-P03 — Intervention policy

**Outcome:** Quest cycles begin at suitable moments using real intelligence and streamer preferences.

**Inputs:** Activity intensity, downtime, audience energy/boredom/hype/risk, streamer profile, current lifecycle state, recent quests/outcomes, game-support tier/capabilities, confidence, freshness, and unknown fields.

**Acceptance:** Tests cover quiet, active, unsafe, repetitive, uncertain, stale, and unknown-heavy moments; low confidence cannot masquerade as a known event.

### R3-P04 — Streamer control policy

**Outcome:** Role 4 receives deterministic available actions for every state.

**Work:**

- Implement L0pch's approval/veto/automatic/manual policy.
- Define permitted approve, reject, start, pause, cancel, skip, succeed, and fail commands.
- Define emergency and changed-gameplay behaviour.

**Acceptance:** Available actions derive from engine state; UI does not invent permissions; every action has a tested transition/result.

**Implementation record (2026-08-16):** Intervention timing now derives deterministic busy-gameplay and suitability thresholds from the saved `experience.intensity` profile value. Intensity zero waits for quieter, stronger opportunities; intensity one tolerates more activity and a lower suitability score; missing intensity retains the neutral 0.5 policy. Lifecycle, emergency, safety, freshness, confidence, and unknown-evidence gates still run first and cannot be weakened by profile intensity.

## Phase 3: Validation and exactly-three assembly

### L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-08 | Validation order and hard-reject versus warning rules | Accepted | Validate safety, streamer/accessibility boundaries, evidence and feasibility, confidence/duration/clarity, diversity/repetition, then lifecycle timing. Safety, boundary, unsupported/unknown evidence, low confidence, bad duration/clarity, duplication, repetition, and timing conflicts hard-reject; only acceptable-but-low preferred quality warns. |
| D3-09 | Candidate repair versus replacement policy | Accepted | Do not semantically repair candidate objectives. Every rejection is non-repairable and is replaced by a separately validated deterministic fallback; never weaken a rule or silently rewrite unsafe output. |
| D3-10 | Difficulty, duration, clarity, diversity, and repetition thresholds | Accepted | Require confidence at least 0.5, overall duration 15-180 seconds with easy 15-90, medium 30-150, and hard 45-180 second bands, at most 36 meaningful instruction words, pairwise token similarity below 0.55, and the accepted five-cycle/30-minute repetition window. Preserve canonical easy/medium/hard values and schema bounds; warn between 0.5 and the preferred 0.65 confidence. |
| D3-11 | Fallback taxonomy, selection, seeding, and history sensitivity | Accepted | Use a curated game-neutral library spanning low-risk strategy, commentary, teaching, reflection, and focus patterns. Order it by stable hash of Role 1-supplied session/cycle seed, validate against the same profile/evidence/history rules, use no ambient randomness, and return typed exhaustion instead of relaxing safety or repetition. |

### R3-P05 — Deterministic validation pipeline

**Required checks:**

- Legal/non-harmful/non-wagering safety.
- Streamer restrictions and accessibility.
- Feasibility for known real state; unknown fields cannot justify a specific factual challenge.
- Capability fit: universal quests may use universal signals, while calibrated HUD facts require the matching advertised capability.
- Clarity under stream pressure.
- Duration/difficulty fit.
- Duplication and diversity.
- Recent-history repetition.
- Timing/current lifecycle conflict.

**Acceptance:** Each rejection has structured code, reason, evidence, and repairability; validation is deterministic and independently tested.

### R3-P06 — Curated fallback library

**Outcome:** Valid quests remain available without a provider and without fabricated gameplay facts.

**Library dimensions:**

- Low/medium/high intensity.
- Short/medium duration.
- Aggressive/supportive/comedic/beginner/competitive streamer styles.
- Solo/team/unknown context.
- Active/downtime/transition/unknown gameplay.
- Audience mood/confidence.
- Safety/accessibility restrictions.

**Acceptance:** Fallbacks use the same schema; unknown-safe options do not claim false health, kill, team, or phase facts; repetition is controlled.

### R3-P07 — Exactly-three option assembly

**Outcome:** Viewers receive exactly three valid, distinct options.

**Work:**

- Validate Role 2 candidates in order determined by L0pch.
- Repair only when permitted.
- Replace rejected/missing options from the fallback library.
- Re-run diversity and final safety checks across the assembled set.

**Acceptance:** Zero, one, two, or three usable Role 2 candidates all result in exactly three valid options with full acceptance/rejection/replacement evidence.

## Phase 4: Voting and activation

### L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-12 | Voting duration, minimum participation, and vote-change policy | Accepted | Use a 30-second authoritative voting window and require at least one accepted vote. The first accepted vote per viewer is final for the MVP; vote changes are disabled because the canonical state has no per-viewer replacement ledger. Role 1 owns identity, acceptance, storage and deduplication. |
| D3-13 | Tie-breaking and zero-vote behaviour | Accepted | Resolve the highest authoritative tally. Break a top-count tie deterministically from session ID, cycle ID and the sorted tied candidate IDs. Zero accepted votes produces a typed no-activation result rather than selecting a default winner. |
| D3-14 | Streamer veto window and winning-option replacement/cancellation | Accepted | The streamer may cancel throughout the 30-second voting window. Once the authoritative close command arrives, the winning candidate cannot be substituted; an invalid or cancelled winner produces no activation. Automatic close-to-activation remains disabled until the shared close-vote contract and integration evidence pass. |
| D3-15 | Activation behaviour when gameplay changes during voting | Accepted | Minor gameplay changes do not interrupt voting. Safety risk, quest impossibility, session end, or emergency pause cancels the vote and prevents activation; Role 3 revalidates the winner at authoritative close. |

### R3-P08 — Vote resolution rules

**Outcome:** Role 1 participation data resolves to one deterministic winner or a typed no-activation result.

**Acceptance:** Tests cover normal majority, ties, zero votes, late votes, vote changes, duplicate rejection assumptions, disconnect, cancellation, and expiry.

Role 1 owns vote authentication, acceptance, storage, and deduplication. Role 3 consumes the accepted vote/tally or close-vote command and deterministically resolves the outcome.

### R3-P09 — Winner activation and interruption

**Outcome:** One winner becomes an active quest only when Role 3 permits it.

**Acceptance:** Streamer policy, changed gameplay, emergency controls, cancellation, skip, and invalid activation are deterministic and exposed through stable events/actions.

## Phase 5: Progress, outcomes, rewards, and history

### L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-16 | Manual versus automatic progress and completion policy | Accepted | Manual progress/completion is the MVP default and must be monotonic. Automatic partial progress is accepted only when a deterministic quest rule names the allowed gameplay signal kind and every cited signal is known, supported, no older than 15 seconds, and at least 0.75 confidence. Conflicting, cross-game, menu, cutscene, transition, inactive-match, missing, audience-only, unknown, unsupported, disallowed, stale, or weak evidence cannot advance progress. Broad universal visual observations cannot independently prove completion. Per D-060, allowed signal kinds alone cannot prove completion: automatic value 1 is rejected and manual completion remains authoritative until the persisted active rule carries an explicit target/comparison predicate matched exactly by validation context. Automatic failure is never inferred, so insufficient evidence preserves manual controls. Issue #50 tracks that predicate-bearing Core contract. |
| D3-17 | Success, failure, cancellation, skip, and expiry semantics | Accepted | Success requires an active candidate and, until D-060's predicate-bearing rule exists, an explicit manual succeed action; it sets progress to 1 through the manual method and awards that candidate's points. Failure preserves observed progress. Cancellation, skip, and expiry remain distinct zero-point terminal results with authoritative time and reason; cancellation includes safety/emergency invalidation, skip is an intentional streamer choice, and expiry is deadline-driven through the accepted future tick seam. |
| D3-18 | Session-point and hype formulas | Accepted | Award the candidate's configured session points only on success. Emit deterministic session-scoped hype deltas of +10 for success, +2 for a completed failed attempt, and 0 for cancellation, skip, or expiry. Rewards are non-monetary, non-wagering, and never create persistent viewer balances; Role 1 stamps/persists/broadcasts canonical reward events. |
| D3-19 | Cooldown/history effects on future intervention and candidates | Accepted | Every terminal outcome calculates the existing 120-second cooldown. Record the active candidate in recent history for any post-activation outcome so it cannot be immediately repeated; a batch cancelled or skipped before activation records no fabricated active quest. The accepted five-cycle/30-minute repetition window remains unchanged. |

### R3-P10 — Progress and terminal outcomes

**Outcome:** Every active quest reaches a clear terminal state or remains explicitly active.

**Acceptance:** Progress is bounded and timestamped with authoritative absolute time; automatic evidence requires adequate real-signal confidence; manual controls follow permissions; duplicate/stale terminal commands do not apply twice; all terminal paths are tested.

### R3-P11 — Session rewards and history

**Outcome:** Results update non-monetary session points, hype, cooldown, and recent history.

**Acceptance:** Formulas are deterministic; anonymous viewers remain supported; no wagering/persistent economy; history prevents repetition without retaining unnecessary personal data.

## Phase 6: Quest-domain AI quality and integration

### Joint L0pch/Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D23-01 | Provider/model selection and evaluation baseline | Resolved by D-072 | OpenAI Responses API with exact model `gpt-5.6-terra` is approved. Role 3 evaluates quest quality and engine fit without treating that evaluation as an adoption gate. |
| D23-02 | Structured candidate schema details and quest-quality rubric | Accepted | Use the canonical exactly-three candidate schema, D3-20/D3-21 objectives, and Role 3's deterministic hard gates, weighted quality threshold, and replacement authority. D-072 adds source freshness/confidence validation without granting provider output a trust exception. |
| D23-03 | Provider timeout/malformed response threshold before algorithmic fallback | Resolved by D-072 | One attempt and an 8-second timeout. Refusal, malformed/non-exactly-three output, invalid citations, rate limiting, outage, missing credential/credit, or timeout uses the algorithmic path; caller cancellation propagates without candidates or fallback. All surviving candidates still pass Role 3 validation/replacement. |

### L0pch-only decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-20 | Quest objectives/instructions Role 2's model context must optimise for | Accepted | Request exactly three meaningfully distinct, game-neutral quests that are understandable at a glance, feasible in the current evidenced moment, measurable within the current match, and calibrated to the streamer's profile, audience state, duration, difficulty, and reward settings. Each candidate must include a concise title, one unambiguous instruction, a duration or completion condition, difficulty, session points, and a producer-only rationale grounded only in known supported signals. Never optimise spectacle over safety, consent, accessibility, teammate welfare, or streamer restrictions, and never invent unknown gameplay facts. |
| D3-21 | How provider/algorithmic source affects validation without bypassing rules | Accepted | Treat source and provider status as provenance, never as trust or a quality waiver. Provider-generated, algorithmic, and deterministic-fallback candidates all pass the same Role 3 safety, boundary, evidence, feasibility, clarity, timing, diversity, repetition, and lifecycle validation in the same order. A provider refusal, timeout, malformed batch, missing candidate, or rejected candidate yields separately validated deterministic replacements; no source may weaken a hard rejection, bypass exactly-three assembly, or receive semantic repair. |

### R3-P12 — Quest-domain AI quality contract

**Outcome:** Role 2 generation targets criteria that Role 3 can validate consistently.

**Acceptance:** Quality rubric covers feasibility, clarity, novelty, moment fit, streamer fit, audience fit, duration, difficulty, and safety; real evidence for the D-072-approved provider reaches Role 1 without weakening deterministic authority.

### R3-P13 — End-to-end engine evaluation

**Required cases:**

- Valid real-intelligence candidates.
- Provider unavailable/slow/malformed.
- Unsafe, impossible, duplicated, stale, and unknown-dependent candidates.
- All intervention decisions and lifecycle transitions.
- Normal voting, ties, zero votes, veto, cancellation, skip, expiry, success, and failure.
- Automatic progress with adequate evidence and refusal when evidence is uncertain.
- Reconnect-relevant state reconstruction.
- Duplicate command IDs, stale expected revisions, simultaneous control attempts, server/client clock skew, and out-of-order delivery assumptions.
- Multiple action-game contexts without game-specific core rules.

**Acceptance:** Deterministic tests pass; Role 2 live outputs drive the engine; Role 1 receives lifecycle/safety evidence and declared limitations.

### R3-P14 — UI and integration handoff

**Outcome:** Roles 1, 4, and 5 consume one stable quest-cycle contract.

**Handoffs:**

- Role 1: public engine port, commands, events, revision/idempotency requirements, atomic persistence inputs, and realtime view-state needs.
- Role 4: available streamer actions, reasons, veto/emergency states.
- Role 5: options, vote state, active quest, progress, results, rewards, reconnect states.

**Acceptance:** Role 3 consumer/producer contract tests pass against Role 1/2 canonical examples; no UI implements lifecycle, validation, tie, reward, timer authority, or permission rules; the engine has no Supabase/Twitch/UI imports; real golden workflow reaches every terminal state needed for evidence.

## Phase 7: Live Director deterministic half

D-075 activates the research-bounded Live Director scope and assigns Role 3 five isolated passes. The self-contained owner brief is `docs/roles/ROLE-3-LIVE-DIRECTOR-BRIEF.md`; the complete ten-pass file/dependency/acceptance matrix is `docs/build-plans/LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md`. These passes extend the existing intervention and exactly-three engine authority; they do not create a second quest lifecycle.

| Pass | Role 3 outcome | Merge boundary |
| --- | --- | --- |
| `LD-R3-01` / R3-009 | Deterministic cue suitability and attention budget return `stay-silent`, `wait`, or `offer-cue` only after hard gates | Consume Role 1's canonical context contract; use proposed fixtures only until that seam merges |
| `LD-R3-02` / R3-010 | Cue lifecycle/actions cover acknowledge, one-resurface Later, dismiss, convert, stale, expiry, and cancellation | Role 1 owns command identity, revisions, server time, persistence, and broadcast |
| `LD-R3-03` / R3-011 | Converted cues reuse exactly-three validation/replacement and streamer approval | Role 2 still generates candidates; no direct cue-to-viewer publication |
| `LD-R3-04` / R3-012 | Context invalidation, emergency, cooldown, reconnect, and history rules remain deterministic | No scheduler, persistence, UI authority, or automatic-completion expansion |
| `LD-R3-05` / R3-013 | Failure-oriented evaluation, fixtures, public seam examples, and limitations reach Role 1 | Role 1 separately proves real Twitch/OBS/provider/runtime behaviour |

**LD-R3-03 implementation record (2026-08-19):** `DefaultDirectorCueConverter` accepts only the current canonical `converted` cue, treats absent provider/algorithmic candidates as untrusted empty input, and reuses `DefaultCandidateAssembler` plus `DefaultQuestEngine` without relaxing validation or creating another lifecycle. The only successful output is a private canonical `proposed` cycle with exactly three options and streamer approve/reject actions; invalid cue/context, fallback exhaustion, and proposal rejection return typed `no-publication`. The coordinator emits cue/context-linked audit metadata but does not generate candidates, publish to viewers, start voting, persist, authenticate, schedule, or broadcast.

**LD-R3-04 implementation record (2026-08-20):** Cue reconciliation now distinguishes safety cancellation from stale intent, audience, context, and impossibility reasons while leaving ordinary gameplay change non-terminal and preserving already consumed/terminal cues during recovery. Conversion rechecks authoritative emergency/session/impossibility flags plus cue, intent, context, and audience expiry before entering the exactly-three path. Privacy-safe resolved-cue summaries contain only cue/intent IDs, aggregate topic, disposition, and authoritative times; reconnect-safe merging deduplicates the same cue and starts the post-resolution cooldown from the accepted resolution time. Existing active-quest interruption, terminal outcome, recent-quest repetition, and 120-second cooldown policies remain authoritative and unchanged. Role 1 still owns revision stamping, idempotency ledgers, persistence, scheduling, and broadcast.

**LD-R3-05 implementation record (2026-08-20):** The Role 3 evaluation now integrates all four server-authorised cue actions, provider-absent exactly-three fallback conversion, conversion-time emergency/session/impossibility rejection, deterministic replay, and privacy-safe reconnect-history deduplication. `EVALUATION.md` maps timing/evidence, provider/candidate, invalidation, cooldown, recovery, lifecycle, result, replay, and game-neutral cases to their deterministic tests. `README.md` publishes the stable suitability → cue lifecycle → private exactly-three conversion → existing quest-engine handoff while keeping authentication, revisions, persistence, scheduling, emergency/session latches, provider invocation, projection, and broadcast with Role 1. This is fixture-only component evidence; real Twitch, OBS, OpenAI, Supabase, UI, and golden-workflow proof remain external integration work.

**R3-014 implementation record (2026-08-20):** The server composition now injects Role 2's configured candidate provider and Role 3's `DefaultLiveDirectorProposalCoordinator` into the sole orchestrator. A valid `turn-into-vote` command first resolves the deterministic cue transition, then performs generation and conversion without persisting an intermediate converted-only revision. Provider refusal, timeout, malformed output, outage, or absence becomes null candidate input for the credential-free deterministic fallback; missing current gameplay evidence returns typed no-publication and leaves state unchanged. Success atomically stamps the converted cue, exactly-three private proposal, and conversion events into one revision before broadcast. Viewer and OBS models preserve the public quest lifecycle while structurally stripping private rationale, evidence citations, confidence, and provider provenance. Focused fixture tests exercise same-revision publication, deterministic fallback, stale/duplicate commands, reconnect persistence, no-publication, hosted/viewer compatibility, and OBS privacy; live Twitch, OBS, OpenAI, Supabase, and golden-workflow evidence remain unverified.

### Phase 7 acceptance

- Hard lifecycle, emergency, safety, support, freshness, confidence, and `unknown` gates remain stronger than cue-scoring or profile intensity.
- Sparse, ambiguous, conflicting, sarcastic, stale, and high-focus cases wait or stay silent rather than fabricating audience consensus or suitability.
- Exactly three validated options—or a typed no-publication result—remain the only cue conversion result.
- Provider, algorithmic, and deterministic provenance never weaken Role 3 validation; the credential-free path remains usable.
- The engine imports no Twitch, Supabase, UI, or provider implementation and emits only stable state/events/allowed actions for Role 1 composition.
- Each pass rebases current `main`, deconflicts the corresponding Role 1 wave, adds one change fragment, requests advisory review when useful, and reports fixture-only evidence truthfully.

## Coordinate with Role 1 when

- A canonical contract changes; implementation may proceed with affected producer/consumer tests, and the contributor landing it deconflicts it before merge with Role 1 available to assist.
- A mechanic changes accepted product scope or another module's runtime responsibility; Role 1 settles the durable decision before merge.
- Safety, privacy, monetary, or wagering risk appears.
- The provider recommendation introduces cost or a new external service.
- UI requirements cannot be expressed through current engine state.
- The golden workflow or feature-freeze deadline is threatened.
