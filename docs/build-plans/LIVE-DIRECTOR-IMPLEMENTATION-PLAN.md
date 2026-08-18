# Live Director Expansion Implementation Plan

**Owner:** Role 1 (`Dewflash`) as product-direction and integration coordinator

**Responsibility leads:** Role 2 for intelligence, Role 3 for intervention and quest mechanics, Role 4 for streamer UX, and Role 5 for viewer/overlay UX

**Status:** Active implementation authority under D-075. Secondary research and the quantitative evidence ledger are complete; the retained P0 capabilities and bounded P1 experiments are authorised as falsifiable product hypotheses, not proven solution fit.

**Authority:** D-007, D-008, D-012, D-024, D-030, D-041, D-052, D-067, D-068, D-071, D-073, D-074, and D-075

## Activation decision

The project owner accepted the research-bounded Live Director recommendation on 19 August 2026. This plan now authorises the retained passes below. It does not authorise broader AI-cohost, generic analytics, gameplay-coaching, raw-chat, or native-desktop scope.

`docs/research/LIVE-DIRECTOR-SECONDARY-RESEARCH.md` and `docs/research/LIVE-DIRECTOR-EVIDENCE-MATRIX.md` remain the claim boundary. They support the bounded pain while showing that adjacent mechanisms have mixed support and ChatXPT's exact solution effect is unproven. Every retained item must therefore be evaluated against a baseline and may be removed if it fails its kill condition.

The activation conditions are complete:

1. `LD-V01` through `LD-V09` produced the problem, capability, playbook, source-truth, and feature-value evidence.
2. D-075 records the project-owner `keep`, `defer`, and `reject` decisions.
3. The retained scope, privacy boundary, pass split, and evaluation measures are recorded here.
4. The Role 1 and Role 3 queues, Role 3 pickup brief, project queue, and coordination board are linked to this plan.

If evidence shows that Twitch or an existing tool already closes the same gameplay-aware orchestration loop, or that the target pain is weak, the relevant pass is removed rather than implemented for presentation value.

## Objective

Turn ChatXPT from a quest-voting surface into a bounded game-aware engagement director without becoming a generic chat dashboard, gameplay coach, or streamer analytics suite.

The intended loop is:

```text
streamer-declared goal
+ fresh gameplay observations
+ privacy-safe audience aggregates
-> source-labelled private Live Context
-> suitable-moment Director Cue
-> acknowledge, postpone, dismiss, or convert into exactly three validated sidequests
-> individual viewer participation in the Twitch Extension
-> universal public payoff in the OBS overlay
-> privacy-safe intervention outcome in the Session Brief
```

Exactly three validated sidequests remain the flagship participation action. Live Context, Chat Pointers, Catch-up, and analytics support that loop; they do not replace it.

## Settled three-surface rule

All retained surfaces consume the same authoritative session and quest-cycle revision, but each projection must perform a distinct job.

| Surface | Audience | Question it answers | Permitted content |
| --- | --- | --- | --- |
| ChatXPT Studio / Twitch Live Config | Broadcaster and authorised moderators | What should I privately decide, and why? | Source-labelled Live Context, Chat Pointers, confidence/freshness/`unknown`, Director Cues, exactly-three proposal review, safety and lifecycle controls, health, and later aggregate history |
| OBS Browser Source | Everyone receiving the broadcast | What must everyone understand within about three seconds? | Vote-open callout, compact choices/countdown, winner, active sidequest, progress, community hype, result, and reconnect state |
| Twitch Extension | Each viewer individually | What can I understand or do? | P1 Catch-up experiment, full quest details, exactly-three select-then-confirm voting, private vote receipt, reactions, personal session points, expanded progress, result, and late-join/reconnect recovery |

Rules:

- Similar state is allowed; duplicate full interfaces are not.
- OBS is a public read-only scoreboard, not a private streamer HUD or interaction client.
- The Extension is a persistent viewer companion, not only a voting modal.
- Studio and Live Config may expose why an intervention fits. The OBS overlay never exposes internal reasoning, raw chat, usernames, viewer identity, provider details, or personal receipts.
- The Extension may show concise audience-facing context, but not the streamer's private cue evidence or hidden restrictions.
- OBS Custom Docks and OBS Browser Sources are separate: a dock is private control UI; a browser source placed in the scene is public broadcast output.

## Accepted keep, experiment, defer, and reject scope

### P0: keep and implement

| Capability | Minimum useful behaviour | Explicit boundary |
| --- | --- | --- |
| Declared Session Goal / Current Objective | Broadcaster sets and quickly refreshes the intent ChatXPT may display or reason about | Never infer the streamer's intent solely from frames or chat |
| Private Live Context | Separates `Streamer says`, `ChatXPT detects`, and `Chat suggests` with source, freshness, confidence, and `unknown` | No combined certainty score and no provider payload |
| Chat Pointer | Surfaces a relevant topic with message count, unique-participant count, time window, and expandable short-lived evidence where permitted | One viewer is not labelled as chat consensus; spam is deduplicated; raw chat is not permanent history or model input |
| Director Cue | Offers one bounded opportunity with `Acknowledge`, `Turn into vote`, `Later`, and `Dismiss` | It advises engagement timing, not optimal game strategy, and it expires when context changes |
| Exactly-three conversion | Reuses the existing Role 2 candidate and Role 3 validation/lifecycle route | No direct cue-to-viewer activation and no bypass of streamer permissions or deterministic authority |
| Extension live companion | Preserves Vote, Active, and Result states with personal interaction/recovery | Does not calculate winners, timers, rewards, fallback selection, or lifecycle locally |
| OBS public projection | Preserves and tightens the existing universally important, broadcast-safe vote/winner/active/progress/result states | No extra public gameplay narration, private cue, detailed rationale, raw chat, personal fields, or commands |
| Private cue delivery | Reuses Live Config as a pop-out or OBS Custom Dock so the cue remains private | No game-process injection, audio/hotkey dependency, capture leak, or native desktop runtime |

### P1: bounded experiments

| Experiment | Minimum useful behaviour | Kill condition |
| --- | --- | --- |
| Extension Catch-up Card | Optional public-safe goal, phase/recent event, current decision, and active sidequest for a late joiner | Remove if source truth is too weak, it materially slows participation, or use collapses to the existing vote/active state |
| Intervention-specific Session Brief | One cue/intervention record connecting aggregate context, action, participation, outcome, evidence class, and limitations | Remove if it merely repeats Twitch metrics, lacks intervention coverage, or tempts unsupported causal claims |

### Defer

- Private audio, earcons, and hotkeys until distraction, capture leakage, and accessibility can be tested separately.
- Any richer persistent private delivery channel that requires a new runtime or OS-level permissions.

### Reject from this implementation plan

- Carry-forward AI coaching or automatic next-stream prescriptions.
- An always-on-top desktop companion or game-process overlay.
- A gameplay explanator, strategy coach, continuous narration, or microphone-transcription feature.
- A full chat summary, ordinary chat panel, generic AI cohost/producer, reactive-overlay platform, growth analytics suite, or wellness tool.
- Extra public OBS context beyond the compressed shared quest headline and payoff.
- Full catch-up timelines/highlights, viewer-paid direct game control, or persistent viewer profiling.

## Candidate contract spine

Exact schema names are decided only in `LD-R1-01`. Prefer extending the existing canonical envelope, signal, view-model, command, and session-history seams over creating parallel state.

The minimum candidate concepts are:

- **Declared stream intent:** goal, current objective, desired audience involvement, author, update time, and expiry/staleness.
- **Audience pointer aggregate:** topic/intent, unique-participant count, qualifying-message count, window start/end, confidence, source signal IDs, and ambiguity state. Raw Twitch messages remain ephemeral or within the accepted 24-hour debugging maximum and never become this retained record.
- **Live Context:** separate declared, observed, and derived facts with provenance, freshness, confidence, capability, and `unknown`.
- **Director Cue:** reason, evidence references, created/expiry time, state, and server-authorised actions. The cue must become stale when its supporting context is no longer current.
- **Public viewer context:** only broadcaster-approved or public-safe goal, phase, recent event, current decision, active sidequest, and result fields.
- **Intervention record:** cue shown, action taken, timing, quest-cycle reference, aggregate participation, terminal outcome, evidence class, and limitations.

Every streamer, viewer, and overlay projection is built server-side from these facts. UI clients never join private and public data locally.

## Surface projection matrix

| State or feature | Studio / Live Config | Twitch Extension | OBS overlay |
| --- | --- | --- | --- |
| Declared goal/objective | Editable in Studio; compact and refreshable in Live Config | P1 Catch-up experiment only | Omitted |
| Detected gameplay | Detailed source/freshness/unknown | P1 Catch-up experiment only | Omitted |
| Chat Pointer | Private aggregate plus optional short-lived evidence | P1 Catch-up may show only an approved public-safe decision summary, never private evidence | Omitted |
| Director Cue | Full private reason and actions | Not shown | Never shown |
| Proposed quests | Exactly three, with fit evidence and approve/reject controls | Exactly three understandable voting cards after publication | Compact vote-open state and choices where readable |
| Personal vote receipt | Not required except aggregate operational status | Accepted choice, duplicate/late/error and reconnect recovery | Never shown |
| Active sidequest | Full controls and status | Detailed rules, progress, reactions, and personal contribution | Headline, time/progress, and shared hype |
| Result | Operational result and later history | Persistent result, session points, and recent community story | Short shared celebration/result |
| Failure/reconnect | Actionable service recovery | Personal retry/reauth while retaining the last safe state | Public reconnect banner while retaining the last safe state |

## Isolated implementation passes

The implementation is divided into ten independently reviewable passes: five driven by Role 1 and five driven by Role 3. This is an even split by bounded pass and coherent responsibility, not a promise of identical line counts. Role 3 owns the complete deterministic cue-to-quest policy half; Role 1 owns the canonical authority, product delivery, integration, and evidence half. Under D-071 and D-073 these assignments are responsibility and pickup clarity, not permission or merge gates.

Each pass uses a short-lived `role-1/` or `role-3/` branch and one pull request where practical. Every pass must sync current `main`, inspect overlapping branches, add one change fragment, run affected producer/consumer tests, and disclose fixture-only versus real evidence. Role 1 deconflicts textual or semantic overlap before the affected pull requests merge.

### Role 1 half

#### LD-R1-01 — Canonical authority, privacy, and projection spine

- **Branch:** `role-1/live-director-01-contracts`
- **User-visible outcome:** One authoritative revision can represent declared intent, private Live Context, an expiring Chat Pointer, a Director Cue, public-safe context, and an intervention record without leaking private evidence.
- **Primary files:** `src/core/contracts/commands.ts`, `signals.ts`, `views.ts`, `session-history.ts`, `src/core/application/schemas.ts`, `types.ts`, `view-projector.ts`, `src/core/testing/fixtures.ts`, and affected `tests/integration/` contract tests. Add persistence fields only if the accepted retained data cannot use the current versioned JSON state.
- **Inputs:** The accepted P0/P1 scope, existing `ContractEnvelope`, command/revision/idempotency rules, current `StreamerViewModel`, `ViewerViewModel`, and `OverlayViewModel`.
- **Outputs:** Versioned schemas, broadcaster/moderator/system permissions, server timestamps, expiry/staleness, typed errors, public/private projection rules, and valid/unknown/stale/conflicting/privacy-denied fixtures.
- **Acceptance:** Private cue reason, pointer evidence, raw chat, usernames, personal receipts, and provider details are structurally absent from viewer/overlay projections; all projections share the same authoritative revision; invalid/stale/duplicate commands fail closed.
- **Exclusions:** No UI, cue suitability algorithm, new provider call, raw-chat persistence, or parallel state authority.

#### LD-R1-02 — Declared intent, Chat Pointer, and private Live Context composition

- **Branch:** `role-1/live-director-02-live-context`
- **User-visible outcome:** The streamer can state the current goal/objective and privately see `Streamer says`, `ChatXPT detects`, and `Chat suggests` as separate, honest source classes.
- **Primary files:** Role 1 command/orchestrator/persistence seams in `src/core/application/` and `src/realtime/`; Role 2 aggregate/public-entry changes in `src/ai/` if needed; canonical fixtures and integration tests. Rendering is reserved for LD-R1-03.
- **Inputs:** Fresh gameplay snapshot, streamer-declared intent, privacy-safe audience aggregates, capability/freshness/confidence, and Role 3's cue-input contract from LD-R3-01.
- **Outputs:** Monotonic intent updates, one narrow expiring pointer with unique-participant and qualifying-message counts, spam deduplication, ambiguity/sparse-chat handling, and a source-separated private context snapshot.
- **Acceptance:** Tests cover known, unknown, stale, conflict, deleted/cleared chat, single-viewer non-consensus, duplicate/spam, reconnect, and permission states. Only aggregates survive product history; real Twitch-chat evidence is required before a live claim.
- **Exclusions:** No ordinary chat window, full summary, microphone transcription, inferred streamer intent, or fake audience activity.

#### LD-R1-03 — Streamer controls and private delivery

- **Branch:** `role-1/live-director-03-streamer-delivery`
- **User-visible outcome:** Studio and Twitch Live Config show the accepted goal/context/pointer/cue controls while preserving the existing recommended exactly-three quest review. The same private Live Config can open as a browser pop-out or OBS Custom Dock.
- **Primary files:** `src/streamer/studio-management.tsx`, `twitch-config.tsx`, related CSS/tests, Role 1 thin mounts/auth, and OBS-dock setup documentation.
- **Inputs:** LD-R1-01 projections and commands plus LD-R3-02 server-authorised cue actions.
- **Outputs:** Session Goal/Current Objective controls; compact private Live Context; one cue with `Acknowledge`, `Turn into vote`, `Later`, and `Dismiss`; health/unknown/reconnect states; safe pop-out/dock guidance.
- **Acceptance:** Keyboard, focus, compact-width, long-text, stale-action, permission, loading, offline, and reconnect states pass. The private route cannot be embedded as a public OBS Browser Source without broadcaster authority.
- **Exclusions:** No public private-cue overlay, native desktop companion, audio/earcon/hotkey dependency, gameplay advice, or provider/model picker.

#### LD-R1-04 — Viewer companion and compressed OBS projection

- **Branch:** `role-1/live-director-04-viewer-obs`
- **User-visible outcome:** The Twitch Extension and hosted fallback preserve Vote, Active, and Result with private receipt/recovery, while OBS preserves the compressed public vote/winner/active/progress/result payoff. Catch-up is isolated behind a P1 experiment flag.
- **Primary files:** `src/viewer/presentation.ts`, `surfaces.tsx`, related styles/tests, Role 1 viewer/overlay projection and route integration, plus affected Twitch Extension asset/integration tests.
- **Inputs:** LD-R1-01 public projections, existing participation service, authoritative deadlines/revisions, and accepted Role 3 lifecycle state.
- **Outputs:** Exactly-three select-then-confirm voting, late-join/reconnect recovery, expanded active/result depth, optional minimal Catch-up Card, hosted-board parity where supported, and low-distraction OBS states.
- **Acceptance:** Desktop/mobile, keyboard, screen-reader, reduced-motion, long-text, zero/tie/late/duplicate/error/reconnect/terminal fixtures pass; one viewer's receipt never reaches another viewer or OBS; the `1`/`2`/`3` fallback remains hidden until needed.
- **Exclusions:** No client-side winner/timer/reward authority, full catch-up timeline, extra gameplay narration, public rationale, or full Extension density in OBS.

#### LD-R1-05 — Session Brief, golden integration, and value evaluation

- **Branch:** `role-1/live-director-05-evidence`
- **User-visible outcome:** A P1 intervention-specific brief explains what ChatXPT surfaced and what aggregate outcome followed; the retained loop is then evaluated end to end rather than declared successful from screenshots.
- **Primary files:** `src/core/contracts/session-history.ts`, `src/realtime/session-history.ts`, Studio history presentation, `tests/integration/`, `docs/evidence/manifest.json`, and evaluation records.
- **Inputs:** Authoritative cue action, quest cycle, participation aggregates, outcome, evidence class, and limitations from the same source revision.
- **Outputs:** One non-causal intervention record/brief and real vanilla Minecraft + Twitch + OBS evaluation, including provider-unavailable and chat/hosted fallback cases.
- **Acceptance:** The same revision reaches Studio/Live Config, two viewers, persistence, and OBS. Sparse/conflicting chat, unknown context, provider failure, reconnect, duplicate/stale commands, emergency pause, and all retained fallbacks are exercised. Full checks and evidence-manifest validation pass.
- **Exclusions:** No generic growth dashboard, retention-causality claim, carry-forward AI coaching, raw chat/usernames/viewer IDs, or provider payload retention.

### Role 3 half

Role 3's self-contained pickup authority is also recorded in `docs/roles/ROLE-3-LIVE-DIRECTOR-BRIEF.md` and assigned through [issue #150](https://github.com/Dewflash/chatxpt/issues/150).

#### LD-R3-01 — Cue suitability and attention budget

- **Branch:** `role-3/live-director-01-suitability`
- **Engine outcome:** A pure deterministic policy decides `stay-silent`, `wait`, or `offer-cue` from source-labelled intent, gameplay, audience, lifecycle, safety, freshness, confidence, and recent history.
- **Primary files:** `src/quest-engine/intervention.ts`, `intervention.test.ts`, public engine types/exports only where required, and test fixtures.
- **Inputs:** LD-R1-01's proposed context fixture while the canonical PR is under review; final merge consumes its public contract.
- **Outputs:** Hard-gate order, attention budget, cue suitability score/reasons, cooldown/repetition interaction, and typed unknown/insufficient-evidence results.
- **Acceptance:** Quiet, active, transition, high-focus, sparse, conflicting, sarcastic/ambiguous, stale, unknown-heavy, unsafe, emergency-paused, repeated, and intensity-profile cases are deterministic. Safety/lifecycle/freshness gates always run before scoring.
- **Exclusions:** No UI visibility decision, chat ingestion, candidate generation, persistence, or broadcaster permission logic.

#### LD-R3-02 — Director Cue lifecycle and available actions

- **Branch:** `role-3/live-director-02-cue-lifecycle`
- **Engine outcome:** A cue has explicit proposed, acknowledged, postponed, dismissed, converted, stale, expired, and cancelled semantics with deterministic server-authorised actions.
- **Primary files:** `src/quest-engine/engine.ts`, `intervention.ts`, related tests, `index.ts`, and public test helpers.
- **Inputs:** Fresh suitability output and authoritative `now`; Role 1 remains command deduplication/revision authority.
- **Outputs:** Action availability, expiry/invalidation rules, action events, and a conservative `Later` policy: at most one resurface, only while the same evidence remains fresh and the cycle is otherwise eligible.
- **Acceptance:** Illegal, duplicate-assumption, stale, late, cross-session/cycle, emergency, context-change, dismiss, acknowledge, postpone/resurface, convert, and expiry paths are tested. Client clocks never decide eligibility.
- **Exclusions:** No direct broadcast, storage, UI timer, or automatic quest publication.

#### LD-R3-03 — Exactly-three cue conversion

- **Branch:** `role-3/live-director-03-conversion`
- **Engine outcome:** `Turn into vote` enters the existing candidate/validation route and can expose exactly three valid, distinct sidequests—or a typed no-publication result—without weakening safety.
- **Primary files:** `src/quest-engine/engine.ts`, `validation.ts`, `provider-quality.ts`, their tests, and deterministic fallback fixtures.
- **Inputs:** Converted cue context, Role 2 candidate batch from provider or algorithmic path, current profile/restrictions/capabilities/history.
- **Outputs:** Candidate acceptance/rejection/replacement evidence tied to the cue, exactly-three assembly, and streamer-approval-ready state.
- **Acceptance:** Zero/one/two/three valid inputs, malformed/refused/timed-out provider output, unsupported facts, unsafe/restricted objectives, repetition/diversity failure, and fallback exhaustion are deterministic. No provider provenance bypasses validation and fewer/more than three never publish.
- **Exclusions:** No Role 2 provider adapter changes, viewer vote counting, or direct cue-to-viewer activation.

#### LD-R3-04 — Invalidation, emergency, cooldown, and history effects

- **Branch:** `role-3/live-director-04-invalidation`
- **Engine outcome:** Changing evidence and streamer controls invalidate cues and quest conversion predictably, and recent cue/quest history prevents nagging or repetition.
- **Primary files:** `src/quest-engine/engine.ts`, `intervention.ts`, `outcomes.ts`, related tests, and public events/actions.
- **Inputs:** Authoritative gameplay/audience freshness, lifecycle changes, emergency latch, outcome/history, and server time.
- **Outputs:** Stale/cancel reasons, cue and quest cooldown interaction, post-dismissal/post-conversion history rules, and recovery-safe state reconstruction.
- **Acceptance:** Safety change, impossibility, session end, emergency pause/clear, ordinary gameplay change, audience expiry, intent update, reconnect, out-of-order assumptions, and recent repetition are covered without weakening existing quest terminal semantics.
- **Exclusions:** No scheduler, persistence, broadcast, or automatic success predicate expansion.

#### LD-R3-05 — Deterministic evaluation and Role 1 handoff

- **Branch:** `role-3/live-director-05-evaluation`
- **Engine outcome:** Role 1 receives a stable public engine seam and a failure-oriented evidence pack that can drive the golden integration without guessing mechanics.
- **Primary files:** `src/quest-engine/evaluation.test.ts`, `EVALUATION.md`, `README.md`, public exports/testing fixtures, Role 3 TODO/execution records, and its change fragment.
- **Inputs:** Merged LD-R3-01 through LD-R3-04 behaviour and canonical LD-R1-01 contracts.
- **Outputs:** Producer contract examples, action/event/state catalogue, fixture matrix, limitations, and integration handoff in the repository's safe-handoff format.
- **Acceptance:** Evaluation covers suitable/unsuitable timing, sparse/conflicting/sarcastic input, unknown/stale evidence, provider failure, candidate rejection, exact-three assembly, every cue action, lifecycle invalidation, emergency, cooldown, deterministic replay, and multiple game-neutral contexts. Quest-engine tests run without Twitch, Supabase, UI, or provider imports.
- **Exclusions:** No claim of real Twitch/OBS/provider execution; Role 1 records those boundaries in LD-R1-05.

### Merge waves and deconfliction

| Wave | Role 1 pass | Role 3 pass | Merge/deconfliction rule |
| --- | --- | --- | --- |
| A | LD-R1-01 contract spine | LD-R3-01 suitability against proposed fixtures | Role 1 publishes the canonical seam; Role 3 rebases and replaces any local adapter before merge. |
| B | LD-R1-02 context composition | LD-R3-02 cue lifecycle | Merge producer/consumer tests together; neither PR imports the other's private files. |
| C | LD-R1-03 streamer delivery | LD-R3-03 exactly-three conversion | Role 3 mechanics merge before Role 1 wires live controls; current quest review remains usable throughout. |
| D | LD-R1-04 viewer/OBS projection | LD-R3-04 invalidation/history | Verify no private field leakage and no UI-owned lifecycle authority before either PR merges. |
| E | LD-R1-05 brief/integration/evidence | LD-R3-05 evaluation/handoff | Role 3 publishes the deterministic handoff first; Role 1 completes real multi-surface evidence and records failures truthfully. |

The waves describe integration order, not permission waiting. A contributor may advance a pass using canonical fixtures while its counterpart is under review, then deconflict the public seam before merge.

## Cross-role acceptance checklist

The older `LD-Pxx` labels below remain as outcome groupings for traceability to the research record. They are not additional assignments or branches; the ten `LD-R1/R3` passes above are the active work units.

### LD-P00 — Research, differentiation, and scope gate

**Status:** Complete under D-075.

**Outcome:** Every candidate feature has evidence, a native/competitor comparison, an evaluable value claim, and a `keep`, `defer`, or `reject` outcome.

**Work:**

- Complete `LD-V01` through `LD-V09` using the secondary-research-only method.
- Define the small/medium streamer segments and operating modes to which each claim applies.
- Produce the claim/evidence, streamer playbook, capability/differentiation, source-truth, and feature-evaluation matrices.
- Record counterevidence and explicit falsification conditions.
- Set evaluation targets only where the evidence and available prototype measurement support them; do not invent universal benchmarks.

**Exit:** Project owner accepts the retained scope and value thesis. Rejected features are removed from later passes.

### LD-P01 — Canonical context, command, privacy, and projection spine

**Outcome:** One revisioned server authority can represent retained intent, pointers, cues, public context, and intervention records without leaking private data between surfaces.

**Primary responsibility areas:** `src/core/`, `src/realtime/`, `src/integrations/`, Supabase migrations if persistence is retained, and `tests/integration/`.

**Work:**

- Extend canonical schemas and commands only for the scope retained by `LD-P00`.
- Define broadcaster/moderator/system/viewer/overlay permissions, freshness, expiry, idempotency, and typed errors.
- Add separate streamer, viewer, and overlay projections from one authoritative revision.
- Keep raw chat out of retained product history and out of provider context; store only approved aggregates and traceable non-personal signal references.
- Publish valid, unknown, stale, conflicting, unavailable, privacy-denied, and version-mismatch fixtures.

**Exit:** Schema plus producer/consumer tests prove that a private Chat Pointer or Director Cue cannot appear in `ViewerViewModel` or `OverlayViewModel`, while all three projections remain revision-consistent.

### LD-P02 — Declared intent and private Live Context

**Outcome:** The broadcaster can state the stream goal/current objective and privately see source-separated gameplay and audience context without opening a raw chat clone.

**Primary responsibility areas:** Role 1 command/persistence composition, Role 2 audience/gameplay aggregation, and Role 4 Studio/Live Config rendering.

**Work:**

- Add the accepted intent controls to Studio and the smallest quick-update control to Live Config.
- Build privacy-safe Chat Pointer aggregation with unique-participant counting, spam deduplication, ambiguity handling, expiry, and honest sparse-chat behaviour.
- Render `Streamer says`, `ChatXPT detects`, and `Chat suggests` separately.
- Preserve the current exactly-three recommended quest review in Live Config.

**Exit:** Fixture and component evidence covers known, unknown, stale, conflicting, sparse-chat, deleted/cleared-chat, reconnect, and permission states. Real Twitch chat evidence is separately labelled and required before a live claim.

### LD-P03 — Director Cue and exactly-three sidequest conversion

**Outcome:** A fresh suitable moment produces one private cue that the streamer can acknowledge, postpone, dismiss, or convert through the existing exactly-three quest pipeline.

**Primary responsibility areas:** Role 2 behavioural signals, Role 3 intervention/quest mechanics, Role 1 orchestration, and Role 4 private controls.

**Work:**

- Define cue eligibility, attention budget, cooldown, expiry, `Later` resurface rules, and dismissal feedback through the existing Role 3 intervention authority.
- Make `Turn into vote` invoke Role 2 candidate generation and Role 3 validation/replacement; it cannot publish fewer or more than three options.
- Cancel or stale the cue when supporting gameplay, intent, safety, or audience context changes.
- Record cue action and latency without retaining raw chat or private viewer identity.

**Exit:** Tests cover suitable/unsuitable, stale, ambiguous, sparse-chat, emergency-pause, provider failure, invalid candidates, dismissal, postponement, duplicate commands, and exactly-three publication. No cue bypasses Role 3 or streamer authority.

### LD-P04 — Twitch Extension live companion

**Outcome:** The Extension preserves Vote, Active, and Result as P0; a minimal Catch-up Card is a separable P1 experiment.

**Primary responsibility areas:** Role 1 viewer projection/recovery and Role 5 viewer presentation.

**Work:**

- Behind the P1 experiment boundary, add only the public-safe goal, phase/recent-event, decision, active-sidequest, and result context retained by `LD-P00`.
- Preserve exactly-three select-then-confirm voting and authoritative private vote receipt.
- Add late-join and reconnect restoration, expanded active rules/progress, reactions, and personal session points without persistent viewer profiling.
- Keep commands optional and disable them safely when identity/realtime authority is unavailable.
- Bring the hosted Quest Board to equivalent public context where capability allows; retain concise `1`/`2`/`3` chat fallback rather than copying the full companion into chat.

**Exit:** Compact desktop/mobile, keyboard, screen-reader, reduced-motion, long-text, late-join, permission, reconnect, stale, and terminal states pass. One viewer's personal fields never reach another viewer or OBS.

### LD-P05 — OBS universal public projection

**Outcome:** Every viewer receives the shared interaction headline without needing to open the Extension, while gameplay remains readable.

**Primary responsibility areas:** Role 1 secure read-only overlay projection and Role 5 overlay presentation.

**Work:**

- Project only the public fields retained by `LD-P00`.
- Render vote-open/compact choices, winner, active sidequest, progress, shared hype, result, and reconnect states.
- Apply a strict distraction budget: short context transitions, safe-area layouts, resolution scaling, and no private rationale or command controls.
- Reuse the authoritative session/cycle revision and deadlines; do not calculate outcomes in the overlay.

**Exit:** Fixture screenshots cover all states and safe-area variants. A real OBS Browser Source run proves transparent output, reconnect, legibility, and absence of private/personal fields.

### LD-P06 — Intervention-specific Session Brief

**Outcome:** After the stream, Studio explains what ChatXPT surfaced, what action followed, and what aggregate outcome occurred without duplicating generic Twitch analytics or claiming causality.

**Primary responsibility areas:** Role 1 aggregate read model/persistence and Role 4 history/summary presentation.

**Work:**

- Extend the existing privacy-safe session-history path with retained intervention records.
- Show cue timing/action, public context class, participation, quest outcome, response latency, evidence class, and known limitations.
- Exclude raw chat, usernames, viewer IDs, private receipts, provider payloads, and unsupported retention claims.

**Exit:** Aggregate/history tests prove privacy and source classification. Studio labels correlation and insufficient evidence explicitly.

### LD-P07 — Private Live Config pop-out / OBS Dock delivery

**Outcome:** A streamer can keep the authorised private Live Config visible as a browser pop-out or OBS Custom Dock without leaking it into the broadcast.

**Order:** Reuse the authenticated Live Config route and document pop-out/dock setup. Private audio/hotkeys remain deferred, and an always-on-top desktop companion is rejected from this plan.

**Exit:** Accessibility, authentication, capture-recursion, permission, and privacy evidence passes for the web/dock route. Failure leaves ordinary Live Config usable.

### LD-P08 — Golden integration and value evaluation

**Outcome:** The retained product loop is repeatable across real authorised inputs and the three surfaces, and its value claims have measured evidence rather than screenshots alone.

**Work:**

- Run one real vanilla Minecraft plus real Twitch activity flow through Live Context, cue, exactly-three vote, Extension, OBS, result, and Session Brief.
- Run sparse-chat, conflicting-chat, `unknown`, provider-unavailable, reconnect, duplicate/stale command, and fallback flows.
- Verify the exact same authoritative revision in Studio/Live Config, two viewers, persistence, and OBS.
- Record the evaluation matrix below with source revision, evidence class, inputs, limitations, and reviewer.

**Exit:** `npm run check`, affected producer/consumer tests, multi-client integration, real Twitch/OBS evidence, and evidence-manifest validation pass. The team reports failed value hypotheses as failures rather than polishing them away.

## Value and evaluation matrix

The research report supplies the falsification framework, while D-075 accepts the scope rather than claiming an effect size. The table below records the dimensions that must remain measurable; thresholds may be committed only when their denominator and baseline are recorded.

| Value claim | Quantifiable measure | Qualitative evidence | Baseline/comparison | Guardrail or rejection signal |
| --- | --- | --- | --- | --- |
| ChatXPT reduces engagement-operation burden | Time and streamer actions from suitable moment to published interaction; cue acknowledgement/dismissal; interruption count | Documented workflow steps and attention demands from research | Manual monitoring plus manual poll/reward setup | No reduction in steps/time, or cue handling creates equal or greater distraction |
| ChatXPT surfaces relevant moments | Cue precision against an annotated evaluation set; stale/false cue rate; unknown coverage | Failure analysis for sarcasm, conflicts, sparse chat, and high-focus gameplay | Rule-only or no-cue baseline | Frequent irrelevant/late cues or unsafe confidence inflation |
| Context makes participation more meaningful | Accepted-vote participation rate, vote completion time, and late-join task comprehension where an ethical controlled evaluation is available | Research synthesis of newcomer/context needs and observed explanation burden | Exactly-three vote without Catch-up/context | Context is ignored, slows voting materially, or cannot be generated truthfully |
| Extension adds value beyond OBS | Catch-up opens, repeat Extension use, reactions, personal receipt/recovery success, and active/result-state use | Viewer-workflow analysis showing why individual depth cannot live in broadcast graphics | OBS-only shared state plus basic voting | Extension use collapses to voting only and added states provide no evidenced benefit |
| OBS creates shared awareness without obstruction | Time to identify vote/winner/active/result state; overlay uptime/reconnect; safe-area collision checks | Legibility and distraction review across the calibrated game and target resolutions | Extension-only state | Overlay obscures gameplay, leaks private data, or duplicates full Extension density |
| Session Brief supports reflection | Brief availability, intervention coverage, source classification, and data completeness | Research support for intervention-level reflection rather than generic analytics | Twitch-native aggregate analytics | Brief only repeats native metrics or implies unsupported causality |

## Research and product kill criteria

Narrow or reject the expansion if any of the following is observed during the implementation evaluation:

- The evidenced problem is only generic low engagement rather than a specific coordination, context, or participation failure.
- Twitch or common existing tools already provide the complete gameplay-aware, streamer-controlled, cross-surface orchestration loop at comparable effort.
- Reliable gameplay/audience context cannot be produced often enough without fabrication.
- Chat Pointer or Director Cue relevance cannot survive spam, conflicting intent, sparse chat, and high-focus gameplay.
- The Extension's Catch-up/Active/Result states do not add measurable or well-supported value beyond OBS plus voting.
- The setup or attention burden exceeds the interaction burden it removes.
- The only defensible analytics are generic metrics already available in Twitch.

## Handoff and verification discipline

- Each contributor activates at most one of their own passes at a time after syncing current `main` and checking overlapping branches/PRs; the paired Role 1 and Role 3 passes may run concurrently.
- Update every affected role TODO when a pass starts and ends; the plan alone is not a work claim.
- Use public module entries and canonical producer/consumer tests; no UI imports another module's private implementation.
- Add exactly one change fragment per pull request and disclose every cross-role file touched.
- Record screenshots, runs, and evaluations in `docs/evidence/manifest.json` only when they qualify as project evidence.
- State separately what is source-inspected, fixture-only, memory-backed, real Twitch, real OBS, real cloud, provider-backed, algorithmic, or deterministic fallback.
- Preserve Twitch Extension primary participation, hosted-board fallback, and hidden-until-needed `1`/`2`/`3` chat fallback throughout every pass.

## Current reality

This document is active implementation authority, not runtime evidence. No Live Director contract, Chat Pointer, Catch-up Card, Director Cue, Session Brief expansion, or private cue channel is claimed implemented merely because D-075 activated the passes. The current product retains its existing exactly-three quest, viewer participation, and OBS quest-state surfaces until each corresponding pass is merged and verified. ChatXPT's direct solution fit remains unproven until LD-R1-05 records comparative evidence.
