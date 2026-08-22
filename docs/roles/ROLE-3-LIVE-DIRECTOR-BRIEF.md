# Role 3 Live Director Pickup Brief

**Assigned lead:** `L0pch`

**Owner counterpart:** `Dewflash` (Role 1 / project owner)

**Status:** Ready under D-075

**Full authority:** `docs/build-plans/LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md`

**GitHub handoff:** [Issue #150](https://github.com/Dewflash/chatxpt/issues/150)

## What the owner decided

ChatXPT will test a narrow **audience-to-sidequest orchestration** product, not a generic streamer assistant. The evidenced pain is that streamers can lose attention and feedback while simultaneously playing, monitoring chat, choosing an engagement action, operating the tool, and closing the interaction loop. ChatXPT cannot create viewers and must never imply that it can.

The accepted loop is:

```text
streamer-declared goal
+ fresh, source-labelled gameplay observations
+ privacy-safe audience aggregates
-> one private Director Cue when the moment is suitable
-> Acknowledge / Later / Dismiss / Turn into vote
-> exactly three validated sidequests through the existing engine
-> viewer participation through the Twitch Extension
-> compressed public payoff in OBS
-> optional intervention-specific Session Brief
```

The current recommended quests remain in Live Config. The Twitch Extension remains the primary participation surface; the hosted Quest Board and `1`/`2`/`3` Twitch-chat paths remain fallbacks. The OBS Browser Source remains public and read-only. Streamer-private context and cue reasoning appear only in Studio/Live Config, including a browser pop-out or OBS Custom Dock.

## Scope boundaries you must preserve

Keep:

- Session Goal / Current Objective.
- Source-separated private Live Context: `Streamer says`, `ChatXPT detects`, and `Chat suggests`.
- One narrow, expiring Chat Pointer as cue evidence—not a replacement chat panel.
- One phase-aware Director Cue.
- The existing exactly-three candidate validation/replacement and streamer-approval route.
- Extension Vote, Active, and Result with private receipt/recovery.
- The existing compressed OBS vote/winner/active/progress/result projection.
- Live Config pop-out / OBS Custom Dock private delivery.

Experiment only:

- A minimal public-safe Extension Catch-up Card.
- One intervention-specific, non-causal Session Brief.

Do not build:

- Carry-forward AI coaching, gameplay strategy, continuous narration, or a gameplay explanator.
- Full chat summaries, ordinary chat panels, generic AI cohost/producer behaviour, growth analytics, or wellness tooling.
- A native always-on-top companion, game injection, private audio/earcons/hotkeys, or extra public OBS context.
- Full catch-up timelines, viewer-paid game control, persistent viewer profiling, fake viewers, fake consensus, or fabricated gameplay facts.

## Your half: deterministic Live Director mechanics

You own five independently mergeable passes. The detailed file and acceptance matrices are in the full implementation plan; this section is the pickup sequence.

| Pass | Outcome | Required proof |
| --- | --- | --- |
| `LD-R3-01` Cue suitability and attention budget | Pure policy returns `stay-silent`, `wait`, or `offer-cue` after hard lifecycle, safety, evidence, freshness, and confidence gates | Deterministic quiet/active/high-focus/sparse/conflicting/sarcastic/stale/unknown/emergency/repetition/intensity cases |
| `LD-R3-02` Cue lifecycle and actions | Proposed, acknowledged, postponed, dismissed, converted, stale, expired, and cancelled states expose server-authorised actions | Invalid/late/context-change/emergency/dismiss/postpone/resurface/convert/expiry cases; `Later` resurfaces at most once while the same evidence stays fresh |
| `LD-R3-03` Exactly-three conversion | `Turn into vote` reuses the existing Role 2 -> Role 3 pipeline and returns exactly three validated sidequests or a typed no-publication result | Zero/one/two/three valid candidates, provider failure, invalid facts, safety/restriction, diversity/repetition, replacement, and fallback-exhaustion tests |
| `LD-R3-04` Invalidation, emergency, cooldown, and history | Evidence or lifecycle changes stale/cancel cues predictably and history prevents nagging/repetition | Safety/impossibility/session-end/emergency/intent-update/audience-expiry/reconnect/out-of-order/history cases |
| `LD-R3-05` Evaluation and handoff | Stable public engine seam, fixtures, limitations, and failure-oriented evaluation are ready for Role 1 integration | Full cue/action/conversion/invalidation matrix and deterministic replay across multiple game-neutral contexts without Twitch/Supabase/UI/provider imports |

Use these branches in order:

1. `role-3/live-director-01-suitability`
2. `role-3/live-director-02-cue-lifecycle`
3. `role-3/live-director-03-conversion`
4. `role-3/live-director-04-invalidation`
5. `role-3/live-director-05-evaluation`

## Mechanics already settled

- Role 3 remains deterministic authority. AI/provider provenance never grants trust or bypasses validation.
- Hard safety, lifecycle, emergency, freshness, confidence, support, and `unknown` gates run before any suitability score.
- D-095 makes proposed-cycle routing mode-specific: Automatic pushes all three validated options to viewer voting without a streamer candidate choice, while Manual starts one streamer-selected option directly without a voting state.
- Automatic voting never exposes fewer or more than three options; Manual direct activation still requires the selected option to belong to the current exactly-three validated proposal.
- Unsafe, impossible, malformed, missing, stale, duplicated, or rejected candidates use separately validated replacements; validation rules are never relaxed.
- The provider-unavailable path remains operational: Role 2 has a credential-free algorithmic route and Role 3 retains deterministic fallback assembly.
- Role 1 owns command authentication, idempotency, expected/current revisions, server time, persistence, scheduling, broadcast, and public/private projection.
- UI clients receive allowed actions from authority; they do not invent lifecycle permissions, timers, winners, or rewards.
- Raw chat, usernames, Twitch IDs, viewer identity, and provider payloads are not Role 3 inputs or retained evidence.
- Unsupported or uncertain game facts remain `unknown`. Vanilla Minecraft is only the calibrated demo target; the engine stays game-neutral.

## How the two halves meet

| Wave | Your delivery | Dewflash delivery | Integration seam |
| --- | --- | --- | --- |
| A | Suitability policy against proposed fixtures | Canonical context/command/projection spine | Rebase to the final public contract before merge; delete any temporary duplicate type |
| B | Cue lifecycle/actions | Intent, audience pointer, and Live Context composition | Producer/consumer tests cover every action and context state |
| C | Exactly-three conversion | Studio/Live Config controls and private delivery | Engine mechanics merge before live controls are wired |
| D | Invalidation/history | Extension/OBS projections | No private leakage and no UI-owned lifecycle authority |
| E | Evaluation/handoff | Session Brief, real integration, and value evidence | Role 3 publishes deterministic evidence first; Role 1 records real Twitch/OBS results |

Nobody waits for personal permission. You may advance against canonical fixtures while the counterpart pass is still in progress. Before merge or direct integration, fetch current `main`, inspect overlap, notify the affected contributor, and deconflict both textual and semantic changes. Advisory review is useful when it improves the work, but it is not required; no role label is a veto under D-071/D-076.

## First pickup

Start with `LD-R3-01` only. Read the current `src/quest-engine/intervention.ts`, its tests, the canonical signal/view contracts, and the Live Director plan. Claim the branch/issue, record the bounded pass in `docs/roles/ROLE-3-TODO.md`, and keep the first PR pure and fixture-driven. Do not wait for UI, Twitch credentials, provider credit, or real OBS evidence.

At each pass exit, use the repository safe-handoff format:

```text
Outcome:
Branch / commit:
Files and contracts changed:
Public seams and fixture IDs:
Commands run and results:
Fallback behavior checked:
Decisions assumed or still open:
Overlap/deconfliction performed:
Known limitations / next owner:
```

Role 1 will coordinate and deconflict the merge seams; any contributor with repository permission may merge or directly land deconflicted work under D-076 after running relevant checks or documenting why they were not run. Your job is to make the deterministic mechanics explicit enough that Role 1 and the surfaces never have to guess.
