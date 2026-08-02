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

## Non-negotiable boundaries

- Do not implement extraction, audience analysis, provider-adapter code, Twitch/OBS integration, persistence, or UI code.
- Do not edit canonical contracts in `src/core/`; propose changes to Role 1.
- Do not trust AI output without deterministic validation.
- Do not infer missing real gameplay facts. Consume Role 2 confidence/unknown values and degrade safely.
- Rewards remain session-scoped, non-monetary, and non-wagering.
- Simulated/crafted candidates are allowed for engine tests only; judged integration uses real Role 2 intelligence.

## Phase 1: Establish engine boundaries without waiting

### L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-01 | Internal engine architecture: reducer/state machine, services, and pure-rule boundaries | Open | — |
| D3-02 | Candidate, command, state, event, and error representation inside Role 3 | Open | — |
| D3-03 | Determinism strategy for time, randomness, and fallback selection | Open | — |

### R3-P01 — Owned ports and candidate fixtures

**Outcome:** Role 3 works before Role 1/2 implementation is complete.

**Work:**

- Define Role 3-owned ports adapting canonical contracts.
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

**Acceptance:** Legal transitions work; illegal commands return typed errors; time and randomness are injectable for deterministic tests.

## Phase 2: Intervention and streamer control

### L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-04 | Intervention scoring/rules and required confidence/freshness | Open | — |
| D3-05 | Timing, cooldown, repetition window, and interruption defaults | Open | — |
| D3-06 | Proposed/approval/veto/automatic activation behaviour | Open | — |
| D3-07 | Emergency pause, cancellation, and changing-gameplay behaviour | Open | — |

### R3-P03 — Intervention policy

**Outcome:** Quest cycles begin at suitable moments using real intelligence and streamer preferences.

**Inputs:** Activity intensity, downtime, audience energy/boredom/hype/risk, streamer profile, current lifecycle state, recent quests/outcomes, confidence, freshness, and unknown fields.

**Acceptance:** Tests cover quiet, active, unsafe, repetitive, uncertain, stale, and unknown-heavy moments; low confidence cannot masquerade as a known event.

### R3-P04 — Streamer control policy

**Outcome:** Role 4 receives deterministic available actions for every state.

**Work:**

- Implement L0pch's approval/veto/automatic/manual policy.
- Define permitted approve, reject, start, pause, cancel, skip, succeed, and fail commands.
- Define emergency and changed-gameplay behaviour.

**Acceptance:** Available actions derive from engine state; UI does not invent permissions; every action has a tested transition/result.

## Phase 3: Validation and exactly-three assembly

### L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-08 | Validation order and hard-reject versus warning rules | Open | — |
| D3-09 | Candidate repair versus replacement policy | Open | — |
| D3-10 | Difficulty, duration, clarity, diversity, and repetition thresholds | Open | — |
| D3-11 | Fallback taxonomy, selection, seeding, and history sensitivity | Open | — |

### R3-P05 — Deterministic validation pipeline

**Required checks:**

- Legal/non-harmful/non-wagering safety.
- Streamer restrictions and accessibility.
- Feasibility for known real state; unknown fields cannot justify a specific factual challenge.
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
| D3-12 | Voting duration, minimum participation, and vote-change policy | Open | — |
| D3-13 | Tie-breaking and zero-vote behaviour | Open | — |
| D3-14 | Streamer veto window and winning-option replacement/cancellation | Open | — |
| D3-15 | Activation behaviour when gameplay changes during voting | Open | — |

### R3-P08 — Vote resolution rules

**Outcome:** Role 1 participation data resolves to one deterministic winner or a typed no-activation result.

**Acceptance:** Tests cover normal majority, ties, zero votes, late votes, vote changes, duplicate rejection assumptions, disconnect, cancellation, and expiry.

### R3-P09 — Winner activation and interruption

**Outcome:** One winner becomes an active quest only when Role 3 permits it.

**Acceptance:** Streamer policy, changed gameplay, emergency controls, cancellation, skip, and invalid activation are deterministic and exposed through stable events/actions.

## Phase 5: Progress, outcomes, rewards, and history

### L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-16 | Manual versus automatic progress and completion policy | Open | — |
| D3-17 | Success, failure, cancellation, skip, and expiry semantics | Open | — |
| D3-18 | Session-point and hype formulas | Open | — |
| D3-19 | Cooldown/history effects on future intervention and candidates | Open | — |

### R3-P10 — Progress and terminal outcomes

**Outcome:** Every active quest reaches a clear terminal state or remains explicitly active.

**Acceptance:** Progress is bounded and timestamped; automatic evidence requires adequate real-signal confidence; manual controls follow permissions; all terminal paths are tested.

### R3-P11 — Session rewards and history

**Outcome:** Results update non-monetary session points, hype, cooldown, and recent history.

**Acceptance:** Formulas are deterministic; anonymous viewers remain supported; no wagering/persistent economy; history prevents repetition without retaining unnecessary personal data.

## Phase 6: Quest-domain AI quality and integration

### Joint L0pch/Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D23-01 | Free provider/model comparison and final recommendation to Role 1 | Open | — |
| D23-02 | Structured candidate schema details and quest-quality rubric | Open | — |
| D23-03 | Provider timeout/malformed response threshold before algorithmic fallback | Open | — |

### L0pch-only decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D3-20 | Quest objectives/instructions Role 2's model context must optimise for | Open | — |
| D3-21 | How provider/algorithmic source affects validation without bypassing rules | Open | — |

### R3-P12 — Quest-domain AI quality contract

**Outcome:** Role 2 generation targets criteria that Role 3 can validate consistently.

**Acceptance:** Quality rubric covers feasibility, clarity, novelty, moment fit, streamer fit, audience fit, duration, difficulty, and safety; joint provider recommendation reaches Role 1.

### R3-P13 — End-to-end engine evaluation

**Required cases:**

- Valid real-intelligence candidates.
- Provider unavailable/slow/malformed.
- Unsafe, impossible, duplicated, stale, and unknown-dependent candidates.
- All intervention decisions and lifecycle transitions.
- Normal voting, ties, zero votes, veto, cancellation, skip, expiry, success, and failure.
- Automatic progress with adequate evidence and refusal when evidence is uncertain.
- Reconnect-relevant state reconstruction.
- Multiple action-game contexts without game-specific core rules.

**Acceptance:** Deterministic tests pass; Role 2 live outputs drive the engine; Role 1 receives lifecycle/safety evidence and declared limitations.

### R3-P14 — UI and integration handoff

**Outcome:** Roles 1, 4, and 5 consume one stable quest-cycle contract.

**Handoffs:**

- Role 1: commands, events, persistence/realtime needs, idempotency assumptions.
- Role 4: available streamer actions, reasons, veto/emergency states.
- Role 5: options, vote state, active quest, progress, results, rewards, reconnect states.

**Acceptance:** No UI implements lifecycle, validation, tie, reward, or permission rules; contract proposals are reviewed; real golden workflow reaches every terminal state needed for evidence.

## Escalate to Role 1 when

- A canonical contract must change.
- A mechanic changes accepted product scope or another role's ownership.
- Safety, privacy, monetary, or wagering risk appears.
- The provider recommendation introduces cost or a new external service.
- UI requirements cannot be expressed through current engine state.
- The golden workflow or feature-freeze deadline is threatened.
