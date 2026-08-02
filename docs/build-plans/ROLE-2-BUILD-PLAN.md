# Role 2 Build Plan: Real Gameplay Intelligence and AI Candidates

**Owner:** `joelyrk`

**Plan authority:** Role 1 defines phases/outcomes; Joelyrk owns named component decisions

**Primary directories:** `src/extraction/`, `src/ai/`

## Mission

Turn real OBS Virtual Camera frames and real Twitch audience activity into trustworthy, game-neutral intelligence and exactly three structured quest candidates for Role 3. Deliver the Role 4 and Role 5 build plans first so all five contributors can work.

## Definition of done

Role 2 is complete when:

- Separate Role 4 and 5 plans are accepted after one feasibility review each.
- Real team-owned gameplay from OBS Virtual Camera produces timestamped, confidence-scored, game-neutral observations.
- Real Twitch chat produces privacy-aware audience intelligence.
- OCR and visual algorithms run selectively; unavailable facts are `unknown`.
- A free provider path can contribute structured quest generation when available.
- A credential-free algorithmic path operates on the same real inputs when the provider is unavailable.
- Role 2 emits exactly three candidate quests with source/reason/confidence/provider metadata.
- Role 3 can validate or replace candidates without importing Role 2 internals.
- Evaluation evidence covers multiple action-game HUDs, audience states, provider failure, malformed output, latency, and known limitations.

## Non-negotiable boundaries

- Do not edit canonical types in `src/core/`; propose changes to Role 1.
- Do not implement Twitch/OBS integration, quest lifecycle, deterministic safety enforcement, voting, rewards, or UI code.
- Do not fabricate live health, kills, combat, phase, or other gameplay state.
- Raw frames are ephemeral. Raw Twitch chat may be retained for at most 24 hours under D-024.
- AI must be free for the MVP; no paid provider usage is authorised.
- Test fixtures may be simulated or annotated, but only real-frame/real-chat runs count as live evidence.

## Phase 1: Unblock Roles 4 and 5

### Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-01 | Separate plan structure and delivery order for Role 4 and Role 5 | Open | — |
| D2-02 | Required UI-visible intelligence, confidence, unknown, provider, and fallback states | Open | — |
| D2-03 | Which UI features are P0, P1, or excluded within accepted product direction | Open | — |

### R2-P01 — Role 4 Streamer Studio plan

**Outcome:** JYL1m receives an implementation-ready plan for Studio and Twitch Live Config.

**Plan must define:**

- Surfaces and end-to-end streamer flows.
- OBS Virtual Camera setup/status and real-data disclosure.
- Profile, preferences, safety, intensity, testing, history, and live controls.
- AI/algorithmic/unknown states exposed to the streamer.
- Loading, disconnected, permission-denied, provider-unavailable, and reconnect states.
- Dependencies on Roles 1 and 3, milestones, acceptance evidence, and exclusions.

**Acceptance:** Role 4 provides one feasibility response; Joelyrk records one revision; Role 1 is notified; Role 4 can start without inventing scope.

### R2-P02 — Role 5 Viewer/Overlay plan

**Outcome:** drdexe receives an implementation-ready plan for Twitch viewer, fallback board, chat fallback, and OBS visuals.

**Plan must define:**

- Exactly-three-option voting and active quest flows.
- Identity, anonymous fallback, session points, hype, progress, results, and reconnect states.
- Twitch Extension, hosted fallback, chat fallback, and viewer-facing OBS overlay coverage.
- AI/algorithmic/unknown disclosure needed by viewers without overwhelming them.
- Dependencies on Roles 1, 3, and Role 4's visual system; milestones, evidence, and exclusions.

**Acceptance:** Role 5 provides one feasibility response; Joelyrk records one revision; Role 1 is notified; Role 5 can start without inventing scope.

## Phase 2: Define Role 2 boundaries and real fixtures

### Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-04 | Internal extraction/AI module structure and port layout | Open | — |
| D2-05 | Real owned gameplay scenarios and annotation method for evaluation | Open | — |
| D2-06 | How Role 2 represents partial, stale, conflicting, and unknown observations internally | Open | — |

### R2-P03 — Owned ports and boundary fixtures

**Outcome:** Role 2 can develop before Role 1 finishes live capture or Supabase.

**Work:**

- Define Role 2-owned input/output ports adapting Role 1 contracts.
- Create real recorded-frame fixtures from team-owned gameplay plus expected annotations stored separately.
- Create real/sanitised chat fixtures plus explicitly synthetic edge cases for tests only.
- Propose missing canonical fields to Role 1 without editing `src/core/`.

**Acceptance:** Extraction and AI tests run without Twitch/OBS; fixtures carry provenance; expected answers are not supplied to production analyzers.

## Phase 3: Real-frame gameplay extraction

### Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-07 | Frame sampling cadence and adaptive-trigger strategy | Open | — |
| D2-08 | Lightweight motion, scene, colour/bar, and icon features used in P0 | Open | — |
| D2-09 | OCR engine, preprocessing, region-selection, and temporal confirmation strategy | Open | — |
| D2-10 | Confidence fusion, stale-data expiry, contradiction handling, and `unknown` thresholds | Open | — |
| D2-11 | Whether a free vision model materially improves P0 beyond algorithms/OCR | Open | — |

### R2-P04 — Frame consumer and adaptive sampler

**Outcome:** Role 2 consumes real frames through Role 1's capture interface without owning browser/OBS integration.

**Work:**

- Consume ephemeral frames and timestamps.
- Bound resolution, frequency, memory, and processing concurrency.
- Pause cleanly when capture ends or permission is lost.
- Surface capture unavailable/stale status instead of inventing observations.

**Acceptance:** Real OBS Virtual Camera frames pass through the sampler; no raw video is persisted; resource use is measured.

### R2-P05 — Lightweight visual algorithms

**Outcome:** Credential-free analysis derives broad real action signals.

**Candidate features:**

- Motion/activity intensity.
- Scene and match-transition changes.
- Downtime/stability.
- Colour/bar movement where reliable.
- Known icon/template evidence where justified.

**Acceptance:** Algorithms distinguish at least quiet versus active moments on multiple owned action-game examples; false claims become low confidence or `unknown`.

### R2-P06 — Selective OCR adapter

**Outcome:** Visible HUD text/numbers contribute real observations when reliable.

**Work:**

- Evaluate browser/local OCR choices such as Tesseract.js and PaddleOCR-compatible options.
- Crop/preprocess likely text regions rather than OCR every full frame.
- Parse health/score/timer/kill-feed/outcome patterns only with sufficient context.
- Confirm readings temporally and retain raw text only as permitted.

**Acceptance:** OCR evidence includes bounding region, text, confidence, timestamp, and parser result; one-frame anomalies do not create false events; unsupported HUDs return `unknown`.

### R2-P07 — Game-neutral observation fusion

**Outcome:** Algorithms, OCR, optional free vision, and recent history become a stable gameplay snapshot.

**Output concepts:**

- Player condition.
- Recent action outcome.
- Activity/combat intensity.
- Downtime.
- Team pressure/status.
- Match/session phase.
- Resource pressure.
- Notable recent event.
- Confidence, source method, observed time, expiry, and unknown fields.

**Acceptance:** Same contract works across multiple action-game examples; game/HUD-specific details remain inside extraction adapters.

## Phase 4: Real audience intelligence

### Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-12 | Audience-signal taxonomy and aggregation windows | Open | — |
| D2-13 | Rule-based versus free-model classification boundary | Open | — |
| D2-14 | Sarcasm, spam, repeated-request, low-volume, and conflicting-chat handling | Open | — |
| D2-15 | Whether any raw chat is stored within the 24-hour maximum or processed in memory only | Open | — |

### R2-P08 — Audience aggregation and behavioural signals

**Outcome:** Real Twitch chat becomes timestamped, explainable audience intelligence.

**Signals:**

- Energy and sentiment.
- Hype and boredom.
- Risk appetite.
- Humour/joking intent.
- Repeated requests.
- Unsafe/toxic intent needed for suppression.
- Sample size, confidence, freshness, and supporting aggregate evidence.

**Acceptance:** Tests cover sparse, busy, sarcastic, spammy, contradictory, unsafe, and multilingual/unknown cases; stored records obey D-024.

### R2-P09 — Combined intelligence snapshot

**Outcome:** Gameplay, audience, streamer profile, recent quests, and restrictions become model-ready context without leaking raw platform/provider payloads.

**Acceptance:** Snapshot is bounded, traceable, game-neutral, and consumable by both algorithmic and provider candidate generation.

## Phase 5: Free AI and exactly three candidates

### Joint Joelyrk/L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D23-01 | Free provider/model comparison and final recommendation to Role 1 | Open | — |
| D23-02 | Structured candidate schema details and quest-quality rubric | Open | — |
| D23-03 | Provider timeout/malformed response threshold before algorithmic fallback | Open | — |

### Joelyrk-only decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-16 | Model-ready context construction and signal prioritisation | Open | — |
| D2-17 | Provider adapter, structured-output validation, retry, and observability design | Open | — |
| D2-18 | Algorithmic candidate generation when free AI is unavailable | Open | — |

### R2-P10 — Provider evaluation and adapter

**Outcome:** One free provider/model path is recommended jointly and isolated behind a validated adapter.

**Evaluation:** Integration effort, free availability, latency, privacy, structured output, reliability, quest quality, game fit, and fallback behaviour.

**Acceptance:** No client secret; runtime validation; clear provider status; no paid calls; recommendation recorded with Role 3 and sent to Role 1.

### R2-P11 — Context and candidate generation

**Outcome:** Real intelligence produces exactly three distinct structured candidates.

**Each candidate includes:**

- Objective/title and concise instructions.
- Duration and difficulty suggestion.
- Reward suggestion for Role 3 to accept/change.
- Reason tied to real gameplay/audience/profile inputs.
- Source signal references, confidence, provider/algorithmic status, and generation timestamp.

**Acceptance:** Output validates at runtime, contains exactly three candidates, avoids raw provider payloads, and does not claim unavailable gameplay facts.

### R2-P12 — Credential-free algorithmic intelligence/candidates

**Outcome:** Free-model failure does not stop the real-input workflow.

**Work:**

- Use real fused signals to produce exactly three algorithmic candidates while preserving the accepted external contract.
- Label method/provider state explicitly.
- Never replace missing observations with fabricated state.

**Acceptance:** Provider-off run reaches Role 3 deterministically with real inputs and clear status; Role 3 can validate/replace options safely.

## Phase 6: Evaluation and handoff

### Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-19 | Minimum accuracy/confidence/latency evidence for live demo readiness | Open | — |
| D2-20 | Which limitations must appear in Studio, README, and submission evidence | Open | — |

### R2-P13 — Real extraction and intelligence evaluation

**Required cases:**

- At least two action-game HUD/pacing styles using owned gameplay.
- Quiet, active, transition, and visually ambiguous moments.
- OCR-readable and OCR-unreadable states.
- Sparse, hyped, bored, spammy, and unsafe chat.
- Free AI available, unavailable, slow, and malformed.
- Confidence decay, stale observations, contradictions, and unknown fields.

**Acceptance:** Results distinguish inspected, algorithmic, OCR, AI, unknown, fixture-only, and live evidence; limitations are documented.

### R2-P14 — Role 3 and UI handoff

**Outcome:** Role 2 delivers stable candidate/intelligence behaviour without requiring consumers to understand extraction/provider internals.

**Acceptance:** Role 3 integration tests consume Role 2 outputs; Role 4/5 plans reflect actual states; Role 1 receives contract proposals, evaluation evidence, performance limits, and open risks.

## Escalate to Role 1 when

- A canonical contract must change.
- A paid service or new external account is proposed.
- Retention/privacy exceeds accepted limits.
- Role 4/5 feasibility feedback changes product scope.
- Role 2 needs another role's source edited.
- Live extraction cannot meet the golden workflow or feature-freeze deadline.
