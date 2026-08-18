# ChatXPT Product Validation Record

**Owner:** Role 1 (`Dewflash`)

This file records evidence for problem-solution fit, originality, expected impact, and trade-offs. It must distinguish observations from team hypotheses and must not contain unnecessary personal information.

**Current discovery status:** D-074 settles the three-surface responsibility rule, and `docs/build-plans/LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md` records the requested isolated-pass implementation sequence. `docs/research/LIVE-DIRECTOR-SECONDARY-RESEARCH.md` now completes the secondary-research pain, playbook, current-tool, source-truth, differentiation, evaluation, and feature-scope pass. Its keep/defer/reject package is a recommendation awaiting project-owner acceptance, so the implementation plan remains inactive and role queues must not treat the additions as committed scope.

## Current validation method

Primary interviews are not part of the current Live Director discovery pass. Validate the problem through secondary research only:

- Current official Twitch creator guidance, help documentation, and supported product surfaces.
- Peer-reviewed or otherwise methodologically transparent research about small and medium livestreamers, viewer participation, divided attention, audience management, newcomer comprehension, retention, and post-stream reflection.
- A current capability audit of Twitch and relevant streamer tools so ChatXPT does not duplicate existing analytics, polls, overlays, or dashboards.
- Source-by-source limitations, dates, sample characteristics, and a clear separation between documented behaviour, documented pain, and the team's inference.

The evidence gate may support a credible problem thesis, but it may not claim universal product-market fit or that small streamers are simply executing badly. If evidence is weak or contradictory, narrow, defer, or reject the corresponding feature before activating an implementation pass.

## Proposed Live Director expansion

### Problem hypothesis to validate

Under-resourced Twitch game streamers must play, interpret chat, explain the current stream, operate engagement tools, and choose suitable participation moments at the same time. The proposed product addresses this coordination and attention burden by combining a streamer-declared goal, detected gameplay state, and privacy-safe audience signals into one source-labelled live context.

The proposed product loop is:

```text
streamer-declared goal + detected gameplay state + aggregated audience signals
-> source-labelled Live Context
-> viewer Catch-up Card and private streamer Director Cue
-> acknowledge, postpone, dismiss, or convert a suitable moment into exactly three validated sidequests
-> record the intervention and outcome
-> show a concise post-stream Session Brief
```

`Sidequest` remains ChatXPT's core domain term and flagship participation action under D-067. The proposal broadens what ChatXPT understands and explains; it does not yet authorise unrelated engagement mechanics or a generic streamer-management suite.

### Settled surface-value boundary

D-074 accepts the responsibility boundary below for every feature that survives research. The surfaces may show the same authoritative session or sidequest state, but they must not duplicate the same full interface.

| Surface | Audience | Product job | Value that the other surfaces cannot supply |
| --- | --- | --- | --- |
| ChatXPT Studio / Twitch Live Config | Broadcaster and authorised moderators | Private decision support and control | Source-labelled Live Context, Chat Pointers, confidence/freshness/`unknown`, Director Cues, exactly-three proposal review, safety/lifecycle controls, and later aggregate history |
| OBS Browser Source | Everyone receiving the broadcast | Universal shared awareness and payoff | A glanceable public vote, winner, active sidequest, progress, hype, result, and reconnect state even when a viewer has not opened the Extension |
| Twitch Extension | Each viewer individually | Optional depth, interaction, and personal continuity | Catch-up, expanded quest details, select-then-confirm voting, private receipt, reactions, personal points, late-join state, and reconnect restoration without cluttering the broadcast |

OBS answers “what must everyone understand now?”, the Extension answers “what can I understand or do?”, and Studio/Live Config answers “what should the streamer privately decide, and why?”. OBS is a public read-only scoreboard; the Extension is a viewer companion; Studio/Live Config is the producer surface. Internal cue reasoning, raw chat, usernames, private viewer identity, and personal receipts never appear in OBS.

A Chat Pointer or summarised chat feed is not sufficient differentiation. The incremental value thesis to test is whether ChatXPT can reduce engagement-operation effort by connecting streamer-declared intent, fresh gameplay state, aggregated audience intent, deterministic safety, exactly-three quest orchestration, individual viewer participation, universal broadcast payoff, and intervention-specific reflection into one closed loop. Twitch supplies several of the underlying primitives; ChatXPT must prove that its composition and timing add value rather than merely rearranging them.

### Proposed streamer-side additions

| Surface | Addition to validate | Intended pain addressed | Scope boundary |
| --- | --- | --- | --- |
| ChatXPT Studio, before stream | Session Goal, Current Objective, desired audience involvement, and hard safety/boundary review | The system needs an explicit account of what the streamer says they are doing instead of inventing intent from frames or chat | Manual/selectable intent is P0 candidate; continuous microphone transcription is later-only unless separately justified |
| Twitch Live Config, during stream | Private Live Context showing `Streamer says`, `ChatXPT detects`, and `Chat suggests`, with provenance, freshness, confidence, and honest `unknown` | The streamer cannot continually reconcile gameplay, chat, and tool state while playing | Compact live surface; no raw chat dump, provider name, or fabricated consensus |
| Twitch Live Config, during stream | A Chat Pointer showing the relevant topic, unique-participant count, qualifying-message count, time window, and optional short-lived evidence | An ordinary chat feed still requires the streamer to notice repetition, judge relevance, and connect it to gameplay | One viewer is never labelled as consensus; deduplicate spam, show ambiguity, expire stale pointers, and retain only approved aggregates in product history |
| Twitch Live Config, during stream | One Director Cue with a short reason and `Acknowledge`, `Turn into vote`, `Later`, and `Dismiss` actions | The streamer needs one actionable audience-backed opportunity rather than another dashboard | Engagement-aware advice, not general optimal-gameplay coaching |
| Streamer-private cue channel | A glanceable cue outside the public broadcast, with delivery options evaluated separately | A streamer in fullscreen gameplay may not see Studio, Twitch Live Config, or the OBS preview | See the private-visibility feasibility question below; do not reuse the public OBS overlay as private UI |
| ChatXPT Studio, after stream | Automatic Session Brief and an annotated timeline connecting game phase, chat aggregate, cue/quest, participation, and result | Generic metrics do not explain what ChatXPT did or what happened around an intervention | Correlation only; never claim an intervention caused retention without appropriate evidence |
| ChatXPT Studio, before next stream | At most one carry-forward suggestion derived from the prior brief | Close the learning loop without creating a broad AI business coach | P1 candidate and removable if evidence does not support its usefulness |

### Proposed viewer-side additions

| Surface | Addition to validate | Intended pain addressed | Scope boundary |
| --- | --- | --- | --- |
| Twitch Extension viewer | A four-state companion: Catch-up, Vote, Active, and Result | A voting-only Extension becomes irrelevant between polls and cannot help late joiners or preserve personal participation state | Catch-up and result remain optional depth; exactly three validated sidequests remain the activation path |
| Twitch Extension viewer | Expandable Catch-up showing the public-safe stream goal, detected phase, important recent event, current audience decision, and active sidequest/progress | Late or quiet viewers may not understand what is happening when the streamer is not narrating | Source labels and `unknown` are mandatory; no invented plot, intent, game fact, or private Director Cue evidence |
| Twitch Extension viewer | Personal participation state: select-then-confirm vote, accepted receipt, reaction, session points, and late-join/reconnect recovery | OBS can show shared state but cannot receive a command or reveal one viewer's private accepted choice and recovery | Consume server-authorised state; do not calculate votes, rewards, timers, winners, or lifecycle locally |
| OBS Browser Source | Compressed public projection of material context, voting, winner, progress, hype, result, and reconnect | Every viewer needs the shared headline and payoff even when the Extension is closed | Public, read-only, low-distraction output; no private rationale, raw chat, personal fields, or configuration controls |
| Hosted Quest Board fallback | Catch-up and decision context equivalent to the Twitch Extension where capabilities allow | Fallback viewers should not lose the meaning of the interaction | Same participation service and revision; no separate product logic |
| Twitch-chat fallback | Bounded numbered choice and result wording only | Preserve last-resort participation when interactive UI is unavailable | Do not attempt to reproduce the full Catch-up Card in chat or spam per-viewer acknowledgements |

### Private in-game streamer visibility: open feasibility question

The current OBS Browser Source is a public broadcast visual. It can be seen in OBS preview, but it does not automatically appear privately over a fullscreen game on the streamer's monitor.

Candidate private delivery paths to compare before implementation planning:

1. **Twitch Live Config on a second screen:** lowest implementation risk and already aligned with the accepted Twitch surface, but assumes another visible display. A separate mobile companion would be later scope.
2. **OBS Custom Browser Dock:** keeps the cue inside OBS and avoids a new native application, but is not visible over an exclusive-fullscreen game.
3. **Private audio/earcon plus hotkeys:** works without looking away, but must avoid confusing viewers, interrupting gameplay, or reading sensitive chat aloud.
4. **Always-on-top transparent desktop companion:** provides the requested persistent private cue over borderless/windowed gameplay, but adds a native runtime, OS permissions, packaging, capture-exclusion, accessibility, and anti-cheat/game-compatibility risk. It must never inject into the game process.

The current discovery recommendation is to validate Live Config/OBS Dock plus an optional private cue first. A true always-on-top companion remains an explicit go/no-go decision after user-need and technical-feasibility evidence; it is not assumed to be available from the existing web or OBS overlay architecture.

## Live Director evidence-gated to-do

| ID | Status | To-do | Completion evidence |
| --- | --- | --- | --- |
| LD-V01 | DONE | Validate the divided-attention and engagement-production problem for under-resourced small/medium Twitch game streamers using secondary research. | `LIVE-DIRECTOR-SECONDARY-RESEARCH.md` narrows the evidenced problem to live attention and interaction-orchestration cost, defines operating modes instead of unsupported follower bands, and records counterevidence. |
| LD-V02 | DONE | Validate whether newcomers and viewers of low-narration streams experience a meaningful game-state/context gap. | The CatchLive and viewer-motivation evidence supports only a bounded Catch-up experiment; mixed game-understanding results prevent a P0 or retention claim. |
| LD-V03 | DONE | Validate whether repeated chat suggestions, missed requests, and deciding what to acknowledge are sufficiently common and costly to justify the Director Cue. | Audience-management studies document missed chat, interruption, and moderator workarounds; Twitch's existing chat surface limits Chat Pointer to expiring cue evidence rather than a chat product. |
| LD-V04 | DONE | Audit current Twitch and third-party capabilities for catch-up context, chat summarisation, streamer-private cues, interventions, and annotated post-stream analytics. | The report audits current Twitch, Streamlabs, StreamElements, Crowd Control, Tangia, and OBS capabilities and rejects broad occupied categories. |
| LD-V05 | DONE | Test the product thesis against sparse-chat, rising-community, and busy-small-team operating modes plus different gameplay-attention patterns. | The report's operating-mode and live-phase playbook states when ChatXPT stays silent, waits, cues, opens a sidequest, or closes the loop. |
| LD-V06 | DONE | Determine what game/context facts the current game-neutral and calibrated extraction tiers can support without fabricating intent. | The source-truth matrix separates declared, observed, derived, authoritative, unavailable, and future-only facts with explicit `unknown` handling. |
| LD-V07 | OWNER DECISION READY | Decide the private streamer cue channel after comparing second-screen Live Config, OBS Dock, private audio/hotkeys, and an always-on-top companion. | The report recommends Live Config pop-out/OBS Dock for P0, defers audio/hotkeys, and rejects a native always-on-top companion from the MVP; owner acceptance is pending. |
| LD-V08 | DONE | Define the minimum intervention-specific Session Brief and the exact moments it appears. | The report limits the brief to a P1 experiment covering one authoritative intervention, source class, action, participation, outcome, reliability, and limitations without generic metrics or causality. |
| LD-V09 | OWNER DECISION READY | Produce a keep/defer/reject scope recommendation for every proposed streamer and viewer addition. | The report traces every proposed and adjacent feature to evidence, competitor overlap, a scope recommendation, and a kill condition; owner acceptance is pending. |
| LD-V10 | DONE | Record the requested evidence-gated isolated cross-role implementation plan without activating source work. | `docs/build-plans/LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md` records the surface boundary, candidate contract spine, pass order, dependencies, evaluation matrix, and kill criteria. |
| LD-V11 | WAITING | Activate only the retained implementation passes after LD-V01 through LD-V09 and project-owner scope acceptance. | Accepted keep/defer/reject scope is copied into the plan, affected role queues and coordination rows are updated, and rejected features are removed before source work begins. |

## Optional later conversation / usability guide

This guide is retained only in case the project owner later changes the evidence method. It is outside the current secondary-research-only pass.

Use a working flow or concise concept explanation. Do not lead the participant toward a positive answer.

1. How do viewers currently suggest challenges or influence your streams?
2. What becomes difficult when chat is busy or gameplay requires concentration?
3. Which current tool or workaround do you use, and what is missing?
4. Would game-aware, audience-aware sidequests help or distract? Why?
5. At what point should the streamer approve, veto, pause, or disable the system?
6. What setup burden would make you stop using it?
7. For viewers: is voting, seeing the winner, or seeing progress/reward the most valuable part?
8. What would make the experience feel unsafe, unfair, repetitive, or fake?

## Evidence table

| Evidence ID | Date | Participant class | Observed problem/workaround | Reaction to workflow | Concern/trade-off | Product implication | Observation or hypothesis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LD-SR-001 | 2026-08-18 | Secondary research; no primary participant | Divided attention and audience-management cost are documented, but generic low engagement and retention lift are not. Twitch and third-party products already cover most broad feature categories. | Not applicable; no primary reaction collected. | Research is old or bounded in places; vendor metrics are not independent; willingness to install and sustained use remain unknown. | Target the bursty/rising operating mode and the closed-loop sidequest orchestration wedge; make Catch-up and Session Brief P1 experiments; reject broad AI-cohost, coaching, chat, analytics, and native-HUD scope. | Evidence synthesis and bounded team recommendation; see `LIVE-DIRECTOR-SECONDARY-RESEARCH.md`. |

## Alternatives and differentiation

The completed current capability audit and its source limitations are in `docs/research/LIVE-DIRECTOR-SECONDARY-RESEARCH.md`. The table below remains the durable comparison framework; deck claims must use the audited wording and dates rather than broad category claims.

| Existing approach | Useful today | Typical gap ChatXPT tests | Evidence required |
| --- | --- | --- | --- |
| Twitch Chat & Events | Gives creators a live chat/activity surface and current channel-event controls | Whether prioritising a privacy-safe audience signal against gameplay and converting it into a complete streamer-controlled interaction reduces work beyond reading the feed | Current official documentation, workflow decomposition, third-party capability audit, and counterevidence |
| Twitch Polls and Predictions | Supply familiar native participation mechanics | Whether automatically grounding an interaction in the current game moment, streamer boundaries, exactly-three sidequests, progress, and OBS payoff is materially better than launching a generic native interaction | Current official documentation plus feature-to-pain and effort comparison |
| Twitch Extension framework | Supplies embedded viewer, panel/component/overlay, identity, and interaction capabilities | It is ChatXPT's delivery platform, not differentiation by itself; compare whether the proposed companion behaviour is already supplied by current Extensions | Current framework documentation plus an audit of relevant live Extensions and tools |
| OBS overlay | Gives every broadcast viewer the same public visual state | Cannot receive a personal vote/reaction, restore one viewer's receipt, or offer optional depth without adding broadcast clutter | Surface-capability comparison and implemented projection evidence |
| Static poll | Viewers choose among predefined options | Does not automatically connect live gameplay, current audience behaviour, and saved streamer boundaries | Product documentation plus observed streamer workflow |
| Manual chat suggestion | Flexible and socially familiar | High-volume suggestions are hard to structure and evaluate while playing | Streamer/viewer observation |
| Fixed reward redemption | Predictable and easy to moderate | Repeats predefined actions without contextual sidequest generation | Product documentation plus workflow comparison |
| Generic chatbot | Conversational generation | May lack real gameplay grounding, deterministic safety/lifecycle, shared voting, and broadcast progress | Executed ChatXPT evidence and verified comparison |

## Expected-impact hypotheses

Pick only measures the prototype can explain or observe. Do not claim statistical improvement from a small test.

| Hypothesis | Prototype measure | Baseline/comparison | Result | Status |
| --- | --- | --- | --- | --- |
| A returning streamer can become ready without repeating setup. | Time and steps from sign-in to ready session | First-time setup path | — | Open |
| Viewers understand and complete a vote quickly. | Vote completion and time from options visible to accepted vote | Unstructured chat suggestion | — | Open |
| Streamer control remains usable under pressure. | Veto/skip/emergency action success and accidental-action observations | Manual chat management | — | Open |
| Reconnect does not create conflicting outcomes. | Same revision and accepted-state recovery across clients | Forced disconnect scenario | — | Open |
