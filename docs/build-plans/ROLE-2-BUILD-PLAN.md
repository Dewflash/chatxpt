# Role 2 Build Plan: Real Gameplay Intelligence and AI Candidates

**Owner:** `joelyrk`

**Plan authority:** Role 1 defines phases/outcomes; Joelyrk owns named component decisions

**Primary directories:** `src/extraction/`, `src/ai/`

## Mission

Turn real OBS Virtual Camera frames and real Twitch audience activity into trustworthy, game-neutral intelligence and exactly three structured quest candidates for Role 3. Deliver the Role 4 and Role 5 build plans first so all five contributors can work.

## Definition of done

Role 2 is complete when:

- Separate but synchronised Role 4 and 5 plans are accepted after one feasibility review each, with no missing public seam or circular dependency.
- Real team-owned gameplay from OBS Virtual Camera produces timestamped, confidence-scored, game-neutral observations.
- Real Twitch chat produces privacy-aware audience intelligence.
- OCR and visual algorithms run selectively; unavailable facts are `unknown`.
- The opt-in server-side OpenAI path can contribute structured quest generation when the approved team credential and credit are available.
- A credential-free algorithmic path operates on the same real inputs when the provider is unavailable.
- Role 2 emits exactly three candidate quests with source/reason/confidence/provider metadata.
- Role 3 can validate or replace candidates without importing Role 2 internals.
- Evaluation evidence covers multiple action-game HUDs, audience states, provider failure, malformed output, latency, and known limitations.

## Non-negotiable boundaries

- Do not edit canonical types in `src/core/`; propose changes to Role 1.
- Do not implement Twitch/OBS integration, quest lifecycle, deterministic safety enforcement, voting, rewards, or UI code.
- Do not fabricate live health, kills, combat, phase, or other gameplay state.
- Raw frames are ephemeral. Raw Twitch chat may be retained for at most 24 hours under D-024.
- No contributor buys quota. The approved `gpt-5.6-terra` path may use only existing team-owned prepaid or promotional credit; payment or new spend requires another owner decision.
- Test fixtures may be simulated or annotated, but only real-frame/real-chat runs count as live evidence.
- Expose Role 2 through documented public ports from `src/extraction/` and `src/ai/`; do not import another role's internals.
- Request shared dependencies through Role 1 so multiple roles do not conflict in `package.json` or the lockfile.
- Support universal broad visual signals for action games and calibrated HUD facts only for explicitly configured adapters; unsupported facts remain `unknown`.

## Phase 1: Unblock Roles 4 and 5

### Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-01 | Shared plan template, synchronised milestones, and delivery order for Role 4 and Role 5 | Resolved by Joelyrk | Separate Role 4 and Role 5 plans use sequential gated phases: an owner completes and verifies one phase before beginning the next. The roles may progress concurrently once shared dependencies are available. |
| D2-02 | Required UI-visible intelligence, confidence, unknown, provider, and fallback states | Resolved by Joelyrk | Studio exposes detailed confidence, freshness, unknown, capture, provider, and fallback states. Viewer surfaces use simplified context-aware/fallback disclosure. OBS omits technical detail unless degradation affects the displayed quest. |
| D2-03 | Which UI features are P0, P1, or excluded within accepted product direction | Resolved by Joelyrk | P0 covers Role 4 setup-to-live-control and Role 5 voting-to-result across all three participation paths plus OBS. P1 covers deeper history/analytics, reaction polish, and diagnostic refinements. Provider/model pickers, non-Twitch integrations, persistent rewards, and simulated-live claims are excluded. |
| D2-03A | Cross-plan view-model/command/fixture/dependency matrix and early design-system handoff | Resolved by Joelyrk | Publish two standalone plans plus one authoritative shared matrix. Role 4 publishes minimum design tokens/base components first; Role 5 consumes that entry point without waiting for the complete Studio. |

**Accepted baseline (5 August 2026):** `ROLE-4-BUILD-PLAN.md`, `ROLE-5-BUILD-PLAN.md`, and `ROLE-4-5-DELIVERY-MATRIX.md` are accepted after one consolidated feasibility review from each implementing owner. Role 4's review required no scope revision. Role 2 compared Role 5's F5-01 through F5-04 recommendations and settled D5-01 through D5-04 baseline, accepted them without a scope revision, preserved every UI-X dependency, and notified Role 1 through issues #15 and #16. R2-P01, R2-P02, and R2-P02A are complete.

### R2-P01 — Role 4 Streamer Studio plan

**Outcome:** JYL1m receives an implementation-ready plan for Studio and Twitch Live Config.

**Plan must define:**

- Surfaces and end-to-end streamer flows.
- Required Role 1 route/embedding mounts, Role 4 public entry point, consumed view models, and emitted commands.
- OBS Virtual Camera setup/status and real-data disclosure.
- Profile, preferences, safety, intensity, testing, history, and live controls.
- AI/algorithmic/unknown states exposed to the streamer.
- Fixture-backed loading, empty, disconnected, stale, permission-denied, provider-unavailable, fallback, reconnect, and terminal states.
- A first milestone that publishes design tokens/base-component entry points for Role 5 without waiting for the complete Studio.
- Dependencies on Roles 1 and 3, milestones, acceptance evidence, and exclusions.

**Acceptance:** Role 4 provides one feasibility response; Joelyrk records one revision; Role 1 is notified; Role 4 can start without inventing scope.

**Accepted:** Role 4's response was accepted without a plan revision through issue #15 and PR #30. Its reported gaps remain assigned to UI-X01 through UI-X06, UI-X09, and UI-X10.

### R2-P02 — Role 5 Viewer/Overlay plan

**Outcome:** drdexe receives an implementation-ready plan for Twitch viewer, fallback board, chat fallback, and OBS visuals.

**Plan must define:**

- Exactly-three-option voting and active quest flows.
- Required Role 1 route/Extension/hosted/OBS mounts, Role 5 public entry point, consumed view models, and emitted commands.
- Identity, anonymous fallback, session points, hype, progress, results, and reconnect states.
- Twitch Extension, hosted fallback, chat fallback, and viewer-facing OBS overlay coverage.
- AI/algorithmic/unknown disclosure needed by viewers without overwhelming them.
- Fixture-backed loading, empty, stale, permission, duplicate/late vote, tie, zero-vote, disconnected, fallback, reconnect, and terminal states.
- Twitch iframe/viewport, mobile, accessibility, reduced-motion, focus, and OBS transparency/readability constraints.
- Dependencies on Roles 1, 3, and Role 4's visual system; milestones, evidence, and exclusions.

**Acceptance:** Role 5 provides one feasibility response; Joelyrk records one revision; Role 1 is notified; Role 5 can start without inventing scope.

**Accepted:** Role 5's response was [accepted without a plan revision through issue #16](https://github.com/Dewflash/chatxpt/issues/16#issuecomment-5189664413). F5-01 through F5-04 remain Role 5 implementation recommendations; the shared matrix already assigns every cross-role dependency and interim path.

### R2-P02A — Cross-plan integration matrix

**Outcome:** Roles 4 and 5 build separate experiences against one synchronised runtime.

**Work:**

- Align both plans to the shared integration waves and deadlines.
- List every required view model, command, typed error, capability, canonical fixture ID, route/embedding mount, and upstream owner/deadline.
- Define the early Role 4 design-system handoff and the Role 1 local Extension/overlay harness needed by Role 5.
- State explicitly that UIs cannot own AI, extraction, lifecycle, vote resolution, countdown outcomes, permissions, rewards, persistence, or fallback selection.

**Acceptance:** The two feasibility reviews confirm no missing seam or circular dependency; Role 4 and Role 5 can implement concurrently and both name the same canonical fixtures/revisions.

**Accepted:** Both reviews confirmed the split plans are feasible with the recorded upstream dependencies. Role 4 and Role 5 may progress independently through their sequential phases once each phase's named dependencies are available.

## Phase 2: Define Role 2 boundaries and real fixtures

### Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-04 | Internal extraction/AI module structure and port layout | Resolved by Joelyrk | Keep `src/extraction/` responsible for Role 1 source adapters, frame/audience analysis, observation fusion, and canonical snapshot production. Keep `src/ai/` responsible for intelligence composition, context, candidate strategies, and provider adapters. Export canonical-port implementations/factories only; inject browser, OCR, clock, and provider dependencies so tests do not require live services. |
| D2-05 | Real owned gameplay scenarios and annotation method for evaluation | Resolved by Joelyrk | Evaluate two short team-owned or explicitly authorised gameplay samples: one quiet/transition sequence and one high-action sequence, preferably with contrasting HUD styles. Keep sampled frames separate from timestamped expected annotations and keep synthetic edge cases separately labelled; production analyzers never receive expected answers. Exact assets remain pending team-owned sample availability. |
| D2-06 | How Role 2 represents partial, stale, conflicting, and unknown observations internally | Resolved by Joelyrk | Preserve per-source evidence candidates with provenance, confidence, observed/received time, expiry, and availability state, then fuse each signal independently into canonical `known`, `unknown`, `stale`, or `unavailable`. Use `conflicting` when similarly credible evidence disagrees, retain previous values only for stale observations, and defer numeric thresholds to D2-10. Any new canonical field is proposed to Role 1 rather than added here. |

### R2-P03 — Owned ports and boundary fixtures

**Outcome:** Role 2 can develop before Role 1 finishes live capture or Supabase.

**Work:**

- Define Role 2-owned input/output ports adapting Role 1 contracts.
- Export those ports through documented public entry points and add producer/consumer tests using Role 1's canonical examples.
- Create real recorded-frame fixtures from team-owned gameplay plus expected annotations stored separately.
- Create real/sanitised chat fixtures plus explicitly synthetic edge cases for tests only.
- Propose missing canonical fields to Role 1 without editing `src/core/`.

**Acceptance:** Extraction and AI tests run without Twitch/OBS; fixtures carry provenance; expected answers are not supplied to production analyzers.

**Progress (4 August 2026):** The public extraction pipeline interfaces, injected observation-fusion boundary, canonical snapshot builders, validating intelligence/candidate provider factories, and Role 2 producer tests are implemented on `role-2/intelligence-boundary`. Fixture-only UI-X09 proposal payloads cover known, low-confidence, unsupported, stale, capture-denied, provider, algorithmic, and deterministic-fallback presentation states. Role 1 promotion into canonical `@/core/testing`, real owned gameplay/chat fixtures, and real `FrameSource` execution remain pending and are not claimed as live evidence.

**Progress (5 August 2026):** `role-2/real-fixture-spike` adds a bounded browser-canvas sampler, game-neutral pixel-change measurement stream over the canonical `FrameSource`, guaranteed ephemeral-frame release, and selective-region OCR adapter plumbing. Ten focused tests use explicitly synthetic pixel arrays and a fake OCR adapter. R2-P03/P03A remain open for authorised gameplay/chat assets with separate annotations, a real browser-delivered OBS frame, an actual OCR engine experiment, and the joint free-provider/no-credential run; none of those are claimed by this slice.

### R2-P03A — Early feasibility spikes

**Outcome:** Role 2's highest-risk assumptions are tested before full implementation.

**Work:**

- Consume at least one real browser-delivered OBS Virtual Camera frame through Role 1's provisional `FrameSource`.
- Measure a minimal motion/activity pass and one selective OCR experiment without freezing the UI thread.
- With Role 3, test free-provider availability/structured output and confirm the no-credential algorithmic/deterministic route.

**Acceptance:** Executed results, latency/resource observations, failure modes, dependency requests, and immediate recovery recommendations reach Role 1 during the first integration wave.

**Progress (7 August 2026):** `role-2/real-input-evidence` adds a threshold-agnostic evidence-report boundary over canonical OBS measurements. It preserves separate human annotations, summarises quiet/action/transition and p50/p95 processing metrics, records sanitised OCR/unknown metadata, checks two-sample and sanitised-audience coverage, and refuses to promote diagnostic inputs to real evidence. Two user-authorised Brawl Stars clips are source-inspected with separate relative-time annotations and local-only hashes, but remain unexecuted inputs rather than live evidence. Role 1's safely merged browser capture and Tesseract revisions, a sanitised real Twitch audience fixture, executed browser/resource observations, privacy review, artifacts, and the manifest entry remain pending.

## Phase 3: Real-frame gameplay extraction

### Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-07 | Frame sampling cadence and adaptive-trigger strategy | Resolved by Joelyrk | Consume Role 1's current two-frame-per-second `FrameSource`, run bounded universal measurements on each delivered frame with at most one analysis in flight, and start rate-limited three-frame selective-OCR bursts only after meaningful activity/transition changes. Role 2 does not require a capture-control contract change for P0. |
| D2-08 | Universal visual feature set versus calibrated HUD-adapter feature set used in P0 | Resolved by Joelyrk; demo target revised by D-072 | P0 universal signals are quiet, action, and transition derived from frame-difference intensity plus temporal stability. Vanilla Minecraft is the rehearsed demo target. A Minecraft adapter may expose a named HUD fact only after matching live calibration proves it reliable; modded, hidden, unrecognised, unsupported, or ambiguous facts remain `unknown`. Brawl Stars remains evaluation-only evidence. |
| D2-09 | OCR engine, preprocessing, region-selection, and temporal confirmation strategy | Resolved by Joelyrk | Request Tesseract.js from Role 1 as the leading free local/browser OCR dependency through [issue #70](https://github.com/Dewflash/chatxpt/issues/70), with no installation until approved. OCR runs only on named calibrated crops after local grayscale/contrast/upscale preprocessing, never on every full frame, and requires two matching readings in a three-reading window at confidence 0.75 or higher. PaddleOCR-compatible or native binaries remain fallback experiments only if the browser path fails. |
| D2-10 | Confidence fusion, stale-data expiry, contradiction handling, and `unknown` thresholds | Resolved by Joelyrk | Derive visual thresholds from two separately annotated authorised samples instead of guessing fixed pixel cutoffs. Use quiet p95 versus action p50 and transition p50 only when quiet/action distributions separate; otherwise collect more evidence. Require confidence 0.75, treat candidates within 0.10 as conflicting/`unknown`, and expire visual observations after three seconds. Diagnostic calibration may not be applied to or presented as live evidence. |
| D2-11 | Whether a free vision model materially improves P0 beyond algorithms/OCR | Resolved by Joelyrk | Exclude free vision AI from P0 by default. Reconsider only after algorithms/OCR have real baseline evidence and a genuinely free, privacy-acceptable trial materially improves annotated accuracy without unacceptable latency or reliability; missing vision AI never blocks the credential-free path. |

**Decision batch accepted (6 August 2026):** Joelyrk approved D2-07 through D2-11 together. `role-2/real-input-evidence` implements threshold derivation, conservative classification, stale/conflict/unknown handling, bounded OCR-burst decisions, local OCR preprocessing, and two-of-three temporal confirmation against diagnostic fixtures. Real thresholds and calibrated facts remain unclaimed until the authorised live runs are available.

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

Universal features may run across action games. Colour bars, icons, text regions, and fact parsers belong to named calibrated adapters and advertise their capabilities.

**Acceptance:** Universal algorithms distinguish at least quiet versus active moments on multiple owned action-game examples; calibrated facts are emitted only by matching adapters; false or unsupported claims become low confidence or `unknown`.

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
- Game-support tier and advertised extraction capabilities.

**Acceptance:** Same contract works across multiple action-game examples; universal versus calibrated capability is explicit; game/HUD-specific details remain inside extraction adapters.

## Phase 4: Real audience intelligence

### Joelyrk decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-12 | Audience-signal taxonomy and aggregation windows | Resolved by Joelyrk | Use a 30-second rolling window for P0 live audience state. Every output carries sample size, observed/received time, freshness/expiry, and confidence; sparse windows remain unknown rather than being treated as neutral. |
| D2-13 | Rule-based versus free-model classification boundary | Resolved by Joelyrk | Use credential-free, explainable rules as the mandatory P0 classifier. A genuinely free model may assist ambiguous classification later only behind the same validated port and cannot be required for the live or fallback path. |
| D2-14 | Sarcasm, spam, repeated-request, low-volume, and conflicting-chat handling | Resolved by Joelyrk | Rate-limit and deduplicate spam per viewer in memory; repeated requests require multiple qualifying events rather than repeated tokens in one message. Sparse, sarcastic, multilingual or unrecognised, and similarly credible conflicting signals become low-confidence or unknown. Unsafe or toxic intent is high-recall suppression evidence only and is never used to create provocative quests. |
| D2-15 | Whether any raw chat is stored within the 24-hour maximum or processed in memory only | Resolved by Joelyrk | Process raw Twitch chat in memory only for the MVP and do not persist raw messages. Retain bounded aggregates plus separately privacy-reviewed sanitised evidence fixtures with viewer identifiers removed. |

**Decision batch accepted (8 August 2026):** Joelyrk approved D2-12 through D2-15 together. PR #111 must preserve evidence-class boundaries so fixture or diagnostic events never contribute to a live-labelled aggregate, and must add sparse, spam, repeated-request, sarcasm/conflict, unsafe, and multilingual/unknown regressions before approval.

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

Raw chat is processed in memory by default. If Joelyrk's D2-15 choice requires temporary persistence, Role 2 supplies the minimum record/expiry requirement and Role 1 implements and tests automatic deletion within 24 hours.

### R2-P09 — Combined intelligence snapshot

**Outcome:** Gameplay, audience, streamer profile, recent quests, and restrictions become model-ready context without leaking raw platform/provider payloads.

**Acceptance:** Snapshot is bounded, traceable, game-neutral, and consumable by both algorithmic and provider candidate generation.

## Phase 5: Server-side AI and exactly three candidates

### Joint Joelyrk/L0pch decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D23-01 | Provider/model comparison and final recommendation to Role 1 | Resolved by D-072 in issue #132 | Use the OpenAI Responses API with exact model `gpt-5.6-terra`, opt-in server-only `OPENAI_API_KEY`, and only existing team-owned credit. Missing credential, credit, quota, or availability uses the credential-free algorithmic path. |
| D23-02 | Structured candidate schema details and quest-quality rubric | Open | — |
| D23-03 | Provider timeout/malformed response threshold before algorithmic fallback | Resolved by D-072 in issue #132 | Make one provider attempt with an eight-second timeout. Refusal, malformed output, rate limit, outage, timeout, missing credential, credit, or quota immediately uses algorithmic recovery; caller cancellation propagates. |

### Joelyrk-only decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D2-16 | Model-ready context construction and signal prioritisation | Resolved by Joelyrk under D-072 | Send only bounded normalised game capabilities, fresh/high-confidence accepted gameplay and audience signals, streamer safety/preferences, and recent titles. Never send raw frames, raw chat, viewer identity, Twitch IDs, usernames, secrets, or unavailable facts. |
| D2-17 | Provider adapter, structured-output validation, retry, and observability design | Resolved by Joelyrk under D-072 | Pin the server-only adapter to `gpt-5.6-terra`, `store: false`, one attempt, and an eight-second timeout. Require strict exactly-three structured validation and fresh/confident source citations. Retain privacy-safe status/latency observations only; never retain prompts, outputs, or vendor payloads. |
| D2-18 | Algorithmic candidate generation when free AI is unavailable | Resolved by Role 1 deadline override | Use a credential-free deterministic strategy that emits exactly three game-neutral candidate quests from validated intelligence, streamer profile, and recent quest titles. It rotates a curated safe template set by session/cycle/revision, avoids recent titles when alternatives exist, labels every candidate as `algorithmic` with `provider: null`, and cites only fresh, high-confidence known canonical signal IDs compatible with Role 3 validation. Missing, stale, weak, unknown, unsupported, or unavailable observations are omitted rather than fabricated. Role 3 remains the deterministic validation, safety, feasibility, scoring, and replacement authority before any candidate reaches voting or overlay surfaces. |

### R2-P10 — Provider evaluation and adapter

**Outcome:** The owner-approved provider/model path is isolated behind a validated server-only adapter.

**Evaluation:** Integration effort, approved-credit availability, latency, privacy, structured output, reliability, quest quality, game fit, and fallback behaviour.

**Acceptance:** No client secret; runtime validation; clear provider status; no unapproved spend; the credential-free path remains mandatory; the decision is recorded in issue #132.

**Progress (6 August 2026):** `role-2/provider-fallback-evaluation` adds a provider-neutral, injected trial/fallback strategy plus privacy-safe operational observations and summary metrics. Fixture tests cover valid provider output, malformed/partial/overfull/incorrectly-labelled output, timeout, refusal, rate limiting, unavailability, generic failure, cancellation, and invalid algorithmic recovery. No external provider call, provider/model selection, or joint recommendation is claimed; D23-01 through D23-03 and D2-16 through D2-17 remain open.

**Progress (9 August 2026):** `codex/role-2-algorithmic-candidate-strategy` implements the accepted D2-18 credential-free strategy with exactly-three output, recent-title avoidance, provider-null algorithmic metadata, and Role 3-compatible source-signal citation filtering. Fixture tests cover deterministic output, duplicate-title avoidance, raw-chat exclusion, low-confidence omission, stale-signal omission, and validating provider compatibility. This is component evidence only; no external provider call or real-input candidate run is claimed.

**Decision revision (19 August 2026):** D-072 in issue #132 supersedes the conflicting provider/cost portions of D-014, D-021, and this plan's earlier free-only language. It selects the exact server-side OpenAI configuration above and vanilla Minecraft as the rehearsed demo game. Role 3 remains the deterministic quest safety, feasibility, evidence, lifecycle, and replacement authority.

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

**Acceptance:** Role 2 producer tests and Role 3 consumer tests pass against the same canonical examples; Role 3 integration tests consume Role 2 outputs only through public ports; Role 4/5 plans reflect actual states; Role 1 receives contract proposals, evaluation evidence, performance limits, and open risks.

## Escalate to Role 1 when

- A canonical contract must change.
- A paid service or new external account is proposed.
- Retention/privacy exceeds accepted limits.
- Role 4/5 feasibility feedback changes product scope.
- Role 2 needs another role's source edited.
- Live extraction cannot meet the golden workflow or feature-freeze deadline.
