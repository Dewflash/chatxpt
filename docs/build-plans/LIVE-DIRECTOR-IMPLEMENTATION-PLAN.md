# Live Director Expansion Implementation Plan

**Owner:** Role 1 (`Dewflash`) as product-direction and integration coordinator

**Responsibility leads:** Role 2 for intelligence, Role 3 for intervention and quest mechanics, Role 4 for streamer UX, and Role 5 for viewer/overlay UX

**Status:** Drafted at the project owner's request; evidence-gated and not yet active implementation authority

**Authority:** D-007, D-008, D-012, D-024, D-030, D-041, D-052, D-067, D-068, D-071, D-073, and D-074

## Activation gate

This plan records how the proposed Live Director expansion would be implemented if its value survives the secondary-research gate. It does not by itself authorise source implementation.

Before `LD-P01` begins:

1. `LD-V01` through `LD-V09` in `docs/research/PRODUCT-VALIDATION.md` must produce the problem, capability, playbook, source-truth, and feature-value evidence.
2. Every proposed addition must receive a project-owner `keep`, `defer`, or `reject` decision.
3. The retained scope, value claims, privacy boundary, and evaluation measures must be copied into this plan.
4. The affected role queues and coordination board must be updated against current `main`.

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
| OBS Browser Source | Everyone receiving the broadcast | What must everyone understand within about three seconds? | Brief public context only when material, vote-open callout, compact choices/countdown, winner, active sidequest, progress, community hype, result, and reconnect state |
| Twitch Extension | Each viewer individually | What can I understand or do? | Catch-up, full quest details, exactly-three select-then-confirm voting, private vote receipt, reactions, personal session points, expanded progress, result, and late-join/reconnect recovery |

Rules:

- Similar state is allowed; duplicate full interfaces are not.
- OBS is a public read-only scoreboard, not a private streamer HUD or interaction client.
- The Extension is a persistent viewer companion, not only a voting modal.
- Studio and Live Config may expose why an intervention fits. The OBS overlay never exposes internal reasoning, raw chat, usernames, viewer identity, provider details, or personal receipts.
- The Extension may show concise audience-facing context, but not the streamer's private cue evidence or hidden restrictions.
- OBS Custom Docks and OBS Browser Sources are separate: a dock is private control UI; a browser source placed in the scene is public broadcast output.

## Candidate retained scope

The research gate may narrow or reject any row except the already accepted exactly-three quest flow.

| Capability candidate | Minimum useful behaviour | Explicit boundary |
| --- | --- | --- |
| Declared Session Goal / Current Objective | Broadcaster sets and quickly refreshes the intent ChatXPT may display or reason about | Never infer the streamer's intent solely from frames or chat |
| Private Live Context | Separates `Streamer says`, `ChatXPT detects`, and `Chat suggests` with source, freshness, confidence, and `unknown` | No combined certainty score and no provider payload |
| Chat Pointer | Surfaces a relevant topic with message count, unique-participant count, time window, and expandable short-lived evidence where permitted | One viewer is not labelled as chat consensus; spam is deduplicated; raw chat is not permanent history or model input |
| Director Cue | Offers one bounded opportunity with `Acknowledge`, `Turn into vote`, `Later`, and `Dismiss` | It advises engagement timing, not optimal game strategy, and it expires when context changes |
| Exactly-three conversion | Reuses the existing Role 2 candidate and Role 3 validation/lifecycle route | No direct cue-to-viewer activation and no bypass of streamer permissions or deterministic authority |
| Extension live companion | Moves through Catch-up, Vote, Active, and Result states with personal interaction/recovery | Does not calculate winners, timers, rewards, fallback selection, or lifecycle locally |
| OBS public projection | Shows only universally important, broadcast-safe shared state | No private cue, detailed rationale, raw chat, personal fields, or commands |
| Session Brief | Links an intervention to aggregate context, action, participation, quest outcome, and limitations | Reports correlation and system action, not unsupported retention causality |
| Private cue delivery | Makes the cue glanceable or audible when the streamer cannot see Live Config | Separate go/no-go; no game-process injection, anti-cheat interference, capture leak, or unapproved desktop runtime |

## Candidate contract spine

Exact schema names are decided only in `LD-P01`. Prefer extending the existing canonical envelope, signal, view-model, command, and session-history seams over creating parallel state.

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
| Declared goal/objective | Editable in Studio; compact and refreshable in Live Config | Public-safe catch-up summary | Brief update only when materially useful |
| Detected gameplay | Detailed source/freshness/unknown | Concise public-safe phase or recent event | Usually omitted; a short contextual headline only when necessary |
| Chat Pointer | Private aggregate plus optional short-lived evidence | At most a concise audience-facing explanation | Omitted unless an approved generic callout is necessary; never show raw messages automatically |
| Director Cue | Full private reason and actions | Not shown | Never shown |
| Proposed quests | Exactly three, with fit evidence and approve/reject controls | Exactly three understandable voting cards after publication | Compact vote-open state and choices where readable |
| Personal vote receipt | Not required except aggregate operational status | Accepted choice, duplicate/late/error and reconnect recovery | Never shown |
| Active sidequest | Full controls and status | Detailed rules, progress, reactions, and personal contribution | Headline, time/progress, and shared hype |
| Result | Operational result and later history | Persistent result, session points, and recent community story | Short shared celebration/result |
| Failure/reconnect | Actionable service recovery | Personal retry/reauth while retaining the last safe state | Public reconnect banner while retaining the last safe state |

## Isolated implementation passes

Each activated pass uses a short-lived branch and one reviewable pull request where practical. A later pass does not begin before the prior pass's public seam and acceptance evidence are stable.

### LD-P00 — Research, differentiation, and scope gate

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

**Outcome:** The Extension remains useful before, during, and after voting through four bounded states: Catch-up, Vote, Active, and Result.

**Primary responsibility areas:** Role 1 viewer projection/recovery and Role 5 viewer presentation.

**Work:**

- Add public-safe goal, phase/recent-event, decision, active-sidequest, and result context retained by `LD-P00`.
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
- Render material context updates, vote-open/compact choices, winner, active sidequest, progress, shared hype, result, and reconnect states.
- Apply a strict distraction budget: short context transitions, safe-area layouts, resolution scaling, and no private rationale or command controls.
- Reuse the authoritative session/cycle revision and deadlines; do not calculate outcomes in the overlay.

**Exit:** Fixture screenshots cover all states and safe-area variants. A real OBS Browser Source run proves transparent output, reconnect, legibility, and absence of private/personal fields.

### LD-P06 — Intervention-specific Session Brief

**Outcome:** After the stream, Studio explains what ChatXPT surfaced, what action followed, and what aggregate outcome occurred without duplicating generic Twitch analytics or claiming causality.

**Primary responsibility areas:** Role 1 aggregate read model/persistence and Role 4 history/summary presentation.

**Work:**

- Extend the existing privacy-safe session-history path with retained intervention records.
- Show cue timing/action, public context class, participation, quest outcome, response latency, evidence class, and known limitations.
- Permit at most one evidence-backed, resettable carry-forward suggestion if retained by `LD-P00`.
- Exclude raw chat, usernames, viewer IDs, private receipts, provider payloads, and unsupported retention claims.

**Exit:** Aggregate/history tests prove privacy and source classification. Studio labels correlation and insufficient evidence explicitly.

### LD-P07 — Optional private cue delivery

**Outcome:** If `LD-V07` proves the need, a streamer who cannot see Live Config receives a safe private cue without leaking it into the broadcast.

**Order:** Implement only the accepted option, beginning with the lowest-risk route: Live Config/pop-out or OBS Custom Dock, then optional private audio/hotkeys. An always-on-top desktop companion is a separate future plan unless specifically accepted.

**Exit:** Platform, accessibility, capture-recursion, anti-cheat, packaging, permission, and privacy evidence passes for the selected channel. Failure leaves Live Config usable.

### LD-P08 — Golden integration and value evaluation

**Outcome:** The retained product loop is repeatable across real authorised inputs and the three surfaces, and its value claims have measured evidence rather than screenshots alone.

**Work:**

- Run one real vanilla Minecraft plus real Twitch activity flow through Live Context, cue, exactly-three vote, Extension, OBS, result, and Session Brief.
- Run sparse-chat, conflicting-chat, `unknown`, provider-unavailable, reconnect, duplicate/stale command, and fallback flows.
- Verify the exact same authoritative revision in Studio/Live Config, two viewers, persistence, and OBS.
- Record the evaluation matrix below with source revision, evidence class, inputs, limitations, and reviewer.

**Exit:** `npm run check`, affected producer/consumer tests, multi-client integration, real Twitch/OBS evidence, and evidence-manifest validation pass. The team reports failed value hypotheses as failures rather than polishing them away.

## Value and evaluation matrix

Targets remain `TBD` until `LD-P00`; the plan records what must be measurable, not invented success numbers.

| Value claim | Quantifiable measure | Qualitative evidence | Baseline/comparison | Guardrail or rejection signal |
| --- | --- | --- | --- | --- |
| ChatXPT reduces engagement-operation burden | Time and streamer actions from suitable moment to published interaction; cue acknowledgement/dismissal; interruption count | Documented workflow steps and attention demands from research | Manual monitoring plus manual poll/reward setup | No reduction in steps/time, or cue handling creates equal or greater distraction |
| ChatXPT surfaces relevant moments | Cue precision against an annotated evaluation set; stale/false cue rate; unknown coverage | Failure analysis for sarcasm, conflicts, sparse chat, and high-focus gameplay | Rule-only or no-cue baseline | Frequent irrelevant/late cues or unsafe confidence inflation |
| Context makes participation more meaningful | Accepted-vote participation rate, vote completion time, and late-join task comprehension where an ethical controlled evaluation is available | Research synthesis of newcomer/context needs and observed explanation burden | Exactly-three vote without Catch-up/context | Context is ignored, slows voting materially, or cannot be generated truthfully |
| Extension adds value beyond OBS | Catch-up opens, repeat Extension use, reactions, personal receipt/recovery success, and active/result-state use | Viewer-workflow analysis showing why individual depth cannot live in broadcast graphics | OBS-only shared state plus basic voting | Extension use collapses to voting only and added states provide no evidenced benefit |
| OBS creates shared awareness without obstruction | Time to identify vote/winner/active/result state; overlay uptime/reconnect; safe-area collision checks | Legibility and distraction review across the calibrated game and target resolutions | Extension-only state | Overlay obscures gameplay, leaks private data, or duplicates full Extension density |
| Session Brief supports improvement | Brief availability, intervention coverage, data completeness, and next-stream suggestion acceptance if retained | Research support for intervention-level reflection rather than generic analytics | Twitch-native aggregate analytics | Brief only repeats native metrics or implies unsupported causality |

## Research and product kill criteria

Narrow or reject the expansion if any of the following remains true after `LD-P00`:

- The evidenced problem is only generic low engagement rather than a specific coordination, context, or participation failure.
- Twitch or common existing tools already provide the complete gameplay-aware, streamer-controlled, cross-surface orchestration loop at comparable effort.
- Reliable gameplay/audience context cannot be produced often enough without fabrication.
- Chat Pointer or Director Cue relevance cannot survive spam, conflicting intent, sparse chat, and high-focus gameplay.
- The Extension's Catch-up/Active/Result states do not add measurable or well-supported value beyond OBS plus voting.
- The setup or attention burden exceeds the interaction burden it removes.
- The only defensible analytics are generic metrics already available in Twitch.

## Handoff and verification discipline

- Activate one pass at a time after syncing current `main` and checking overlapping branches/PRs.
- Update every affected role TODO when a pass starts and ends; the plan alone is not a work claim.
- Use public module entries and canonical producer/consumer tests; no UI imports another module's private implementation.
- Add exactly one change fragment per pull request and disclose every cross-role file touched.
- Record screenshots, runs, and evaluations in `docs/evidence/manifest.json` only when they qualify as project evidence.
- State separately what is source-inspected, fixture-only, memory-backed, real Twitch, real OBS, real cloud, provider-backed, algorithmic, or deterministic fallback.
- Preserve Twitch Extension primary participation, hosted-board fallback, and hidden-until-needed `1`/`2`/`3` chat fallback throughout every pass.

## Current reality

This document is planning evidence only. No Live Director contract, Chat Pointer, Catch-up Card, Director Cue, Session Brief expansion, or private cue channel is claimed implemented by this plan. The current product retains its existing exactly-three quest, viewer participation, and OBS quest-state surfaces while the research gate remains open.
