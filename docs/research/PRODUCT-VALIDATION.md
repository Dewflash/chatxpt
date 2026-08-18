# ChatXPT Product Validation Record

**Owner:** Role 1 (`Dewflash`)

This file records evidence for problem-solution fit, originality, expected impact, and trade-offs. It must distinguish observations from team hypotheses and must not contain unnecessary personal information.

**Current discovery status:** the Live Director expansion below is a proposed, evidence-gated product direction. It is a recorded discovery backlog, not an accepted implementation plan or proof that the named pain points are prevalent. Role implementation queues must not treat it as committed scope until the secondary-research gate and project-owner review are complete.

## Current validation method

Primary interviews are not part of the current Live Director discovery pass. Validate the problem through secondary research only:

- Current official Twitch creator guidance, help documentation, and supported product surfaces.
- Peer-reviewed or otherwise methodologically transparent research about small and medium livestreamers, viewer participation, divided attention, audience management, newcomer comprehension, retention, and post-stream reflection.
- A current capability audit of Twitch and relevant streamer tools so ChatXPT does not duplicate existing analytics, polls, overlays, or dashboards.
- Source-by-source limitations, dates, sample characteristics, and a clear separation between documented behaviour, documented pain, and the team's inference.

The evidence gate may support a credible problem thesis, but it may not claim universal product-market fit or that small streamers are simply executing badly. If evidence is weak or contradictory, narrow, defer, or reject the corresponding feature before implementation planning.

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

### Proposed streamer-side additions

| Surface | Addition to validate | Intended pain addressed | Scope boundary |
| --- | --- | --- | --- |
| ChatXPT Studio, before stream | Session Goal, Current Objective, desired audience involvement, and hard safety/boundary review | The system needs an explicit account of what the streamer says they are doing instead of inventing intent from frames or chat | Manual/selectable intent is P0 candidate; continuous microphone transcription is later-only unless separately justified |
| Twitch Live Config, during stream | Private Live Context showing `Streamer says`, `ChatXPT detects`, and `Chat suggests`, with provenance, freshness, confidence, and honest `unknown` | The streamer cannot continually reconcile gameplay, chat, and tool state while playing | Compact live surface; no raw chat dump, provider name, or fabricated consensus |
| Twitch Live Config, during stream | One Director Cue with a short reason and `Acknowledge`, `Turn into vote`, `Later`, and `Dismiss` actions | The streamer needs one actionable audience-backed opportunity rather than another dashboard | Engagement-aware advice, not general optimal-gameplay coaching |
| Streamer-private cue channel | A glanceable cue outside the public broadcast, with delivery options evaluated separately | A streamer in fullscreen gameplay may not see Studio, Twitch Live Config, or the OBS preview | See the private-visibility feasibility question below; do not reuse the public OBS overlay as private UI |
| ChatXPT Studio, after stream | Automatic Session Brief and an annotated timeline connecting game phase, chat aggregate, cue/quest, participation, and result | Generic metrics do not explain what ChatXPT did or what happened around an intervention | Correlation only; never claim an intervention caused retention without appropriate evidence |
| ChatXPT Studio, before next stream | At most one carry-forward suggestion derived from the prior brief | Close the learning loop without creating a broad AI business coach | P1 candidate and removable if evidence does not support its usefulness |

### Proposed viewer-side additions

| Surface | Addition to validate | Intended pain addressed | Scope boundary |
| --- | --- | --- | --- |
| Twitch Extension viewer | Expandable Catch-up Card showing declared stream goal, detected current phase, important recent event, current audience decision, and active sidequest/progress | Late or quiet viewers may not understand what is happening when the streamer is not narrating | Source labels and `unknown` are mandatory; no invented plot, intent, or game fact |
| Twitch Extension viewer | Audience-decision context that explains why a vote is appearing before the existing select-then-confirm three-option vote | Voting is more meaningful when viewers understand the situation they are influencing | Exactly three validated sidequests remain the current activation path |
| Twitch Extension viewer | Late-join recovery for the current goal, winning choice, quest status, and result | Viewers can arrive mid-cycle and otherwise lack the shared context | Consume the same authoritative revision; do not create viewer-local quest truth |
| OBS Browser Source | Short broadcast-safe context updates plus existing voting, winner, progress, and result visuals | Viewers watching the video need glanceable shared state without opening the Extension | Public, read-only, low-distraction output; not a configuration surface and not a private streamer HUD |
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
| LD-V01 | READY | Validate the divided-attention and engagement-production problem for under-resourced small/medium Twitch game streamers using secondary research. | Multiple credible sources, segment definitions, limitations, counterevidence, and an evidence-strength assessment. |
| LD-V02 | READY | Validate whether newcomers and viewers of low-narration streams experience a meaningful game-state/context gap. | Research-backed viewer problem statement; distinguish game comprehension, stream goal, recent event, and active interaction needs. |
| LD-V03 | READY | Validate whether repeated chat suggestions, missed requests, and deciding what to acknowledge are sufficiently common and costly to justify the Director Cue. | Evidence for prevalence and workflow cost; current Twitch/mod/bot workarounds and remaining gap. |
| LD-V04 | READY | Audit current Twitch and third-party capabilities for catch-up context, chat summarisation, streamer-private cues, interventions, and annotated post-stream analytics. | Truthful capability/differentiation matrix with current sources and no unsupported competitor claims. |
| LD-V05 | READY | Test the product thesis against sparse-chat, rising-community, and busy-small-team operating modes plus different gameplay-attention patterns. | Playbook matrix states when ChatXPT should explain, cue, wait, or offer a sidequest and when it should remain silent. |
| LD-V06 | READY | Determine what game/context facts the current game-neutral and calibrated extraction tiers can support without fabricating intent. | Required facts mapped to declared, observed, derived, unavailable, and future-only sources. |
| LD-V07 | READY | Decide the private streamer cue channel after comparing second-screen Live Config, OBS Dock, private audio/hotkeys, and an always-on-top companion. | Project-owner go/no-go with platform, accessibility, capture-recursion, anti-cheat, and implementation-risk notes. |
| LD-V08 | READY | Define the minimum intervention-specific Session Brief and the exact moments it appears. | Post-stream and next-stream information hierarchy that does not duplicate Twitch Analytics or overstate causality. |
| LD-V09 | READY | Produce a keep/defer/reject scope recommendation for every proposed streamer and viewer addition. | Evidence-to-feature traceability and an explicit judgement of whether the expansion remains one coherent Live Director product. |
| LD-V10 | WAITING | Create the isolated cross-role implementation plan only after LD-V01 through LD-V09 and project-owner scope acceptance. | Later owner request, accepted scope, contract impact, isolated passes, role queues, dependencies, and acceptance evidence. |

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
| — | — | — | No participant evidence recorded yet. | — | — | — | Unverified hypothesis only. |

## Alternatives and differentiation

This is a claim framework, not a completed market study. Verify concrete competitor capabilities before naming a product in the deck.

| Existing approach | Useful today | Typical gap ChatXPT tests | Evidence required |
| --- | --- | --- | --- |
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
