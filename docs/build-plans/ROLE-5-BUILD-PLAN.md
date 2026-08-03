# Role 5 Build Plan: Viewer Participation and OBS Quest Visuals

**Implementation owner:** Role 5 (`drdexe`)

**Plan owner:** Role 2 (`joelyrk`) under D-016

**Status:** Awaiting Role 5's one consolidated feasibility review in [issue #16](https://github.com/Dewflash/chatxpt/issues/16)

**Primary directory:** `src/viewer/`

**Shared matrix:** `docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md`

## Mission

Deliver fast, accessible viewer participation through the Twitch Extension, a hosted ChatXPT Quest Board fallback, and `1`/`2`/`3` Twitch-chat fallback, plus clear read-only quest visuals for OBS. Every surface consumes Role 1-authorised view state. No Role 5 client owns votes, winner selection, fallback selection, lifecycle, timers, permissions, progress, rewards, or persistence.

## Sequential implementation rule

Role 5 implements one phase at a time.

1. Complete every P0 deliverable and exit check in the current phase.
2. Record the commands, fixtures, screenshots, and limitations actually verified.
3. Resolve or formally defer every blocking contract gap with its owner.
4. Begin the next phase only after the current phase exit is reviewable.

Role 5 may split a phase into small pull requests, but may not start later fallbacks or visual polish to bypass an incomplete primary-flow exit. Role 5 starts Phase 1 after Role 4 publishes the minimum `@/design-system` handoff; it does not wait for the complete Studio.

### How Codex coaches a novice owner through design decisions

The decision tables below are starter prompts and minimum areas to consider, not a fixed or exhaustive questionnaire. For every user-visible pass, Codex inspects the actual viewer/overlay task and generates a small, relevant batch that helps Role 5 think about the experience. It may reword, omit an irrelevant example, add a better question, or show a tiny text wireframe. It should cover the user goal and, where relevant, organisation, information hierarchy, layout/responsiveness, interaction feedback, error/recovery UX, visual tone, motion, accessibility, and trust.

Codex explains the visible result and trade-off first, recommends a default, and then selects the appropriate implementation technique. It must never ask a jargon-only question such as `Flexbox or Grid?`: Role 5 decides how the viewer experience should behave and feel; Codex decides whether Grid, Flexbox, or another implementation produces that result. Role 5 may reply `Approve all recommendations`.

Role 2 owns this baseline plan. Role 5's settled answers are recorded in `docs/roles/ROLE-5-EXECUTION.md`, so Role 5 does not edit another owner's plan. Codex checks that record to avoid repeating settled choices, then asks only the relevant unresolved choices for the current pass.

## Definition of done

- Twitch viewers see exactly three understandable options with duration, difficulty, reward, authoritative countdown, and clear vote availability.
- Authenticated and anonymous viewers can vote safely when permitted and receive authoritative acknowledgement without optimistic double-application.
- Live tallies, tie/zero-vote resolution, winner, activation, progress, terminal result, session points, and community hype remain consistent with the latest server revision.
- The hosted Quest Board offers the same canonical experience without a separate account requirement.
- The chat fallback explains `1`/`2`/`3` voting and shows counted/rejected/late status supplied by Role 1; Role 5 never parses Twitch chat.
- The OBS overlay renders inactive, voting, active, progress, result, hype, and reconnect states from `OverlayViewModel` and emits no commands.
- Loading, offline, identity, permission, stale, duplicate/late vote, tie, zero-vote, disconnected, fallback, reconnect, expired-token, cancelled, and other terminal states are verified.
- Desktop, Twitch panel/mobile, hosted mobile/desktop, keyboard, screen-reader, reduced-motion, transparency, and low-distraction evidence is recorded.
- One streamer, two viewers, and OBS show the same authoritative session/cycle revision during the integrated vote-to-result workflow.

## P0, P1, and exclusions

### P0 required before feature freeze

- Public viewer/fallback/chat-instruction/overlay module boundaries consuming `@/design-system`.
- Twitch Extension loading/offline/ready, exactly-three voting, acknowledgement, tally, countdown, tie/zero-vote, winner, active quest, progress, result, reconnect, identity, and error states.
- Hosted Quest Board room/access, anonymous/authenticated participation, and the same canonical viewer commands.
- Twitch-chat fallback availability, instructions, and Role 1-supplied counted/rejected/late presentation.
- OBS overlay inactive/voting/active/progress/result/reconnect visuals.
- Basic reactions when `canReact`, plus session points and community hype display; the primary vote path must remain usable when reactions are unavailable.
- Responsive, accessibility, failure, reconnect, consumer-contract, same-revision multi-device, and OBS evidence.

### P1 only after the P0 integration exit

- Richer reaction animation/polish, hype celebration, and result transitions within reduced-motion limits.
- Additional community summary and session-point explanation.
- Viewer-engagement measurement hooks proposed to Role 1.
- Non-essential visual polish that does not increase Extension load risk or change public seams.

### Explicitly excluded

- Vote acceptance, deduplication, tally authority, winner/tie/zero-vote resolution, fallback selection, lifecycle, progress, reward, or permission logic in UI code.
- Direct Supabase writes or product-table reads.
- Requiring Twitch viewers to leave Twitch, scan a QR code, or create a ChatXPT account for the primary experience.
- Persistent cross-stream points/economy, wagering, purchases, Bits monetisation, or billing.
- Non-Twitch platform adapters, public API/SDK, arbitrary third-party-stream analysis, or streamer control surfaces.
- Provider/model names as a normal viewer control and technical AI detail that distracts from voting.
- Fixture or simulated state presented as real multi-viewer/Twitch evidence.

## Surface responsibilities

### Twitch viewer Extension

- Primary voting and active-quest experience for desktop and mobile Twitch viewers.
- Exactly three concise options, vote acknowledgement, live tallies when authoritative, absolute-time countdown display, winner/activation, progress, result, basic reactions, session points, hype, and reconnect.
- Twitch identity when Role 1 supplies it; safe anonymous mode otherwise.
- No nested iframe, direct database access, or dependence on client clock for outcomes.

The implementation must support a compact panel-style target and fluid mobile contexts. Twitch's current design guidance describes a 318px by 496px panel content target, recommends fluid mobile layouts with no assumed aspect ratio, and recommends touch targets of at least 44pt/dp. Current mobile policy caps initial CDN load at 1MB and expects loading within three seconds at roughly 500Kb/s. See [Designing Extensions](https://dev.twitch.tv/docs/extensions/designing/), [Extension guidelines and policies](https://dev.twitch.tv/docs/extensions/guidelines-and-policies/), and [Building Extensions](https://dev.twitch.tv/docs/extensions/building/).

Twitch-hosted CSP disallows nested iframes and inline scripts without an allowed nonce/hash, and external network connections require configured HTTPS/WSS allowlists. Role 1 owns asset packaging, Extension Helper/auth wiring, allowlists, and Local/Hosted Test; Role 5 keeps its module compatible. See [Extension life cycle](https://dev.twitch.tv/docs/extensions/life-cycle).

### Hosted Viewer Quest Board

- First fallback when Extension interaction is unavailable.
- Entry through an eight-character room code or Role 1-authorised link.
- Same `ViewerViewModel`, commands, tally/countdown/result semantics, identity classes, and revisions as the Extension.
- Mobile and desktop browser support without a separate account requirement.
- Clear invalid/expired/forbidden/unavailable room states and recovery guidance.

### Twitch-chat fallback

- Final fallback selected by authoritative `participationMode`/capabilities.
- Clear mapping of visible option 1/2/3 to the chat message the viewer should send.
- Counted, duplicate, rejected, and late acknowledgement supplied by Role 1's chat path.
- Role 5 owns copy/presentation only; Role 1 owns Twitch ingestion, identity, parsing, authentication, rate limits, and canonical command emission.

### OBS browser overlay

- Broadcast-only, transparent, read-only visuals for inactive, voting, active, progress, result, hype, and reconnect states.
- No configuration, voting, identity, personal points, command emission, or persistent state.
- Authoritative countdown display derived from server timestamps; no client expiry/result decision.
- Safe readable placement, low distraction, resolution scaling, and overlay-recursion guidance supplied alongside Role 1's OBS setup.

## Public entry and dependencies

Role 5 exports its renderable modules and public props through `@/viewer` and consumes shared visuals only through `@/design-system`. Product code must not import another role's private files.

Current accepted inputs and outputs:

- `ViewerViewModel`, `OverlayViewModel`, `QuestCycleState`, `ParticipationCapabilities`, `ServiceHealth`, and `DomainError`.
- `ViewerVoteCommand` and `ViewerReactionCommand` emitted through a Role 1-authorised dispatcher.
- Role 1 snapshot/reconnect health and Twitch/hosted access context supplied outside Role 5 internals.

Required upstream seams UI-X05 through UI-X08, UI-X10, and the early Role 4 design-system handoff are defined in the shared matrix. Role 5 must flag any missing tie/zero-vote, personal receipt/reconnect, chat delivery, room discovery/access, or route/harness contract in its feasibility review and may not create competing canonical definitions.

## Phase 0 / R5-P01: Feasibility review and implementation baseline

**Deadline:** 3 August 2026

**Outcome:** Role 5 confirms the plan can be implemented across Twitch, hosted fallback, chat fallback, and OBS without inventing authority.

### Owner design gate

Codex first prepares the technical feasibility review itself, then uses these as starting points for a tailored visual/product discussion:

| ID | What Codex asks Role 5 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D5-01 | What should the viewer experience feel like? | A game HUD feels competitive; a community party feels expressive; a clean Twitch panel prioritises speed. | A clean, high-energy Twitch panel: fast to understand, with celebration reserved for meaningful quest moments. | Open |
| D5-02 | How should voting feel? | Tapping the whole quest card is fastest; a separate vote button is explicit; selecting then confirming reduces mistakes. | Select an accessible full card, then use one clear Vote button; preserve the selected state while waiting for authority. | Open |
| D5-03 | How loud should reactions and celebrations be? | Minimal feedback stays calm; arcade effects add hype but can obscure voting and strain Extension performance. | Short, bounded celebrations that never cover the options or block the next action, with reduced-motion alternatives. | Open |
| D5-04 | Does Role 5 already have viewer/overlay references it wants Codex to follow? | Existing screenshots can guide composition; otherwise Codex applies Role 4's system and proposes reversible layouts. | Do not block on references; begin from Role 4 tokens and review compact, mobile, and overlay screenshots. | Open |

### Work

- Read the root guide, integration contract, Role 5 guide/TODO, this plan, and the shared matrix.
- Return one consolidated response covering conflicts, missing requirements, route/harness needs, Extension/mobile/CSP constraints, OBS risks, dependency requests, and the smallest viable recovery for each issue.
- Compare UI-X05 through UI-X08 and UI-X10 with current Role 1/3 work.
- Confirm that Role 4's minimum design-system handoff is sufficient to start Phase 1.
- Identify any package request with purpose, version, client/server impact, bundle/runtime risk, and no-package fallback; Role 1 owns installation.

### Exit evidence

- One written feasibility review is posted to [issue #16](https://github.com/Dewflash/chatxpt/issues/16), where Role 2 and Role 1 can compare it.
- Role 2 records one revision or explicitly records that no revision was needed.
- Every blocker has an owner and required-by phase.
- No source implementation starts before this exit.

## Phase 1 / R5-P02: Public viewer boundary, design-system consumption, and harness

**Deadline:** 4 August 2026, 18:00 SGT

**Design-system dependency:** Role 4 minimum handoff by 4 August 2026, 12:00 SGT

**Integration wave:** Wave 1 — Boundaries

**Outcome:** Role 5 publishes stable public render/command seams and proves it can consume Role 4's visual foundation across viewer and overlay contexts.

### Owner design gate

| ID | What Codex asks Role 5 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D5-05 | How should the three quest options rearrange across screen sizes? | A horizontal grid compares quickly on desktop; one stacked column works inside narrow Twitch/mobile panels. | One column for Twitch/mobile and a three-card grid for the wider hosted board; Codex chooses Grid/Flexbox internally. | Open |
| D5-06 | Which shared visual treatments should be louder for viewers? | Badges communicate status, ribbons spotlight one item, and progress bars show authoritative progress. | Reuse Role 4 components, enlarge touch areas, and reserve the ribbon or spotlight treatment for the winning or active quest. | Open |
| D5-07 | How should buttons respond visually? | Colour-only feedback is weak; small press, loading, and accepted states feel responsive; large animations can imply a result before the server replies. | Immediate press feedback, then a clear pending state; celebrate only after authoritative acknowledgement. | Open |

### P0 work

- Define render-only module props around accepted view models, typed command dispatch, room/access result, transport health, loading state, and Twitch context supplied by Role 1.
- Export Twitch viewer, hosted board, chat instruction, and read-only overlay module entry points through `src/viewer/index.ts` using names selected by Role 5 and documented for Role 1.
- Consume tokens/base components only from `@/design-system`; do not copy or edit Role 4 files.
- Add Role 5-owned consumer tests using accepted Core fixtures and render wrappers; request shared test dependencies through Role 1.
- Provide a fixture gallery/development harness module that is unmistakably fixture-only and mounted only by Role 1's local harness.
- Establish performance budgets compatible with the current 1MB mobile initial-load policy and a three-second constrained-network target; record actual built asset evidence once Role 1 packaging exists.
- Establish focus, live-region, contrast, touch-target, reduced-motion, long-text/localisation, and transparent-overlay conventions.

### Exit checks

- `@/viewer` imports only accepted public seams and exposes documented viewer/fallback/chat/overlay entries.
- `npm run check:boundaries` and the smallest Role 5 contract tests pass.
- One Extension shell, one hosted shell, and one transparent overlay state render using only `@/design-system`.
- Compact panel, fluid mobile portrait/landscape, hosted desktop/mobile, and 16:9 overlay screenshots are recorded.
- Initial loading and error fallbacks remain usable if realtime/auth is not ready.

## Phase 2 / R5-P03: Primary Twitch Extension vote-to-result flow

**Deadline:** 5 August 2026, 18:00 SGT

**Integration wave:** Wave 2 — Core

**Outcome:** The primary Twitch viewer surface completes voting and active-quest presentation against canonical state without owning the outcome.

### Owner design gate

| ID | What Codex asks Role 5 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D5-08 | How should an accepted vote be confirmed? | A brief toast is noticeable but disappears; persistent highlighting remains understandable during reconnects. | Keep the selected card visibly marked and add a short accessible confirmation message after the server accepts it. | Open |
| D5-09 | When should live tallies become visually prominent? | Showing them before voting can influence choices; showing them after voting rewards participation while preserving a cleaner first choice. | Keep options primary before voting, then reveal stronger tally bars after the viewer votes while still respecting the authoritative view. | Open |
| D5-10 | What should happen when a quest wins? | A full-screen celebration is dramatic but disruptive; an inline winner transition preserves context. | A short inline winner and activation transition under one second, never blocking the active quest and disabled under reduced motion. | Open |
| D5-11 | Which engagement number should be most prominent? | Personal points reward the individual; community hype reinforces collective participation. | Community hype is the primary shared signal; personal session points remain secondary and private. | Open |

### P0 states and flow

1. Load/authorise and show offline, unavailable, or ready state from Role 1.
2. Render exactly three options during voting with title, instruction, duration, difficulty, reward, and concise context/fallback disclosure.
3. Emit one `ViewerVoteCommand` with a unique command ID and latest expected revision when `canVote` is true.
4. Wait for authoritative acknowledgement through `acceptedCandidateId`/command result; never increment tallies optimistically.
5. Render authoritative tallies and remaining-time display without closing voting locally.
6. Render tie and zero-vote states from Role 3/1 examples without choosing a winner.
7. Render authoritative winner/activation, active quest, automatic/manual/unknown progress, terminal result, session points, and community hype.
8. Offer reactions only when `canReact`; failures must not block voting.
9. On stale/duplicate/late/forbidden/rate-limited responses, follow the shared typed-error behaviour and refresh as required.
10. Retain the latest safe snapshot while reconnecting, then accept only a newer authorised revision.

### Identity and privacy

- Use Role 1-mapped Twitch viewer identity when available; never expose raw Extension JWTs or private IDs in UI/logs.
- Support anonymous viewers without inventing a persistent identity or cross-session reward record.
- Do not show another viewer's accepted choice or personal session points; Role 1's sanitised snapshots are authoritative.

### Required fixtures

`r5.loading.no-snapshot.v1`, `r5.session.offline.v1`, `r5.mode.extension-ready.v1`, all `r5.identity.*`, all `r5.vote.*`, all `r5.quest.*`, `r5.viewer.personal-restored.v1`, `r5.engagement.points-hype.v1`, `r5.realtime.reconnecting.v1`, and `r5.realtime.permission-expired.v1`.

### Exit checks

- Exactly-three voting, acknowledgement, tally, countdown, tie/zero-vote, winner, active, progress, result, points, hype, and basic reaction states are interactively demonstrated against Role 1's memory runtime or accepted harness.
- Duplicate clicks/commands do not double-apply local state; stale snapshots do not replace newer revisions.
- Anonymous/authenticated, permission loss, token expiry, reconnect, late vote, unavailable reaction, and offline states are verified.
- Keyboard-only and screen-reader-labelled voting works; focus remains stable as realtime tallies update.
- Panel and mobile targets remain usable without horizontal scrolling or hidden primary actions.

## Phase 3 / R5-P04: Hosted fallback, chat fallback, and OBS overlay

**Deadline:** 6 August 2026, 18:00 SGT

**Integration wave:** Wave 3 — Behaviour

**Outcome:** Every accepted participation/output fallback renders the same authoritative quest cycle through the correct role-safe surface.

### Owner design gate

| ID | What Codex asks Role 5 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D5-12 | How should viewers enter the hosted fallback? | A direct link is frictionless; a room code works when links cannot be opened; a QR code helps a streamer move viewers to mobile but must never be required on Twitch. | Direct authorised link first, eight-character code fallback, and an optional streamer-share QR supplied through Role 1. | Open |
| D5-13 | How should chat-only instructions be written? | Long explanations are clear but spammy; concise numbered instructions are fast but need a poll-open announcement. | One concise poll-open message mapping `1`/`2`/`3`, bounded acknowledgement behaviour from Role 1, and one final result message. | Open |
| D5-14 | Where should the OBS quest card sit? | Top, bottom, and side positions can each collide with different game HUDs; one fixed centre overlay is most obstructive. | A compact edge-card layout with safe-area variants; verify the default against the selected demo game and keep critical gameplay visible. | Open |
| D5-15 | What should viewers see during reconnect? | A blocking screen is obvious but hides the latest quest; a banner preserves context while warning that data may be stale. | Retain the latest safe quest state with a prominent reconnecting banner and disable commands until authority returns. | Open |

### P0 hosted Quest Board

- Accept Role 1's room/access result and show invalid, expired, forbidden, unavailable, loading, and reconnect states.
- Use the same `ViewerViewModel`, vote/reaction commands, expected revision, and typed error behaviour as the Extension.
- Support authenticated and anonymous access without a separate ChatXPT account.
- Keep room code and session identifiers out of telemetry/screenshots where not needed.

### P0 Twitch-chat fallback

- Render the authoritative participation mode and option-number mapping.
- Explain that viewers send only `1`, `2`, or `3` in Twitch chat.
- Present counted, rejected, duplicate, late, and unavailable status only from UI-X07/Role 1 output.
- Do not implement chat listening, message parsing, identity, deduplication, rate limits, vote storage, or acknowledgement authority.

### P0 OBS overlay

- Render inactive, voting, active, progress, result, hype, disconnected/reconnecting, and ended states from `OverlayViewModel`.
- Keep `readOnly: true` as a hard rendering boundary and export no command callbacks.
- Derive remaining-time text/animation from absolute timestamps but do not mark expiry or result locally.
- Avoid personal viewer identity/points and technical provider details. Show only concise fallback/degraded copy when it affects the displayed quest.
- Verify transparent background, 16:9 scaling from 1280x720 through 1920x1080 and high-density equivalents, readable safe areas, long text, colour contrast, reduced motion, and capture-recursion guidance.

### Required fixtures

All `r5.mode.*`, `r5.board.room-error-set.v1`, `r5.chat.acknowledgement-set.v1`, and `r5.overlay.state-set.v1` fixtures, plus the Phase 2 quest/reconnect fixtures.

### Exit checks

- Hosted and Extension clients display the same cycle revision and emit the same canonical viewer commands.
- Chat instructions correspond exactly to the visible three options and never claim a vote was counted without Role 1 acknowledgement.
- Overlay emits no commands, stores no authority, and recovers to the latest snapshot after disconnect.
- Fallback selection is driven only by `participationMode`/capabilities from Role 1.
- Hosted mobile/desktop, chat-mode, and transparent OBS screenshots/recordings are captured.

## Phase 4 / R5-P05: P0 multi-client integration, resilience, and evidence

**Functional exit:** 7 August 2026, 12:00 SGT

**Evidence exit:** 7 August 2026, 18:00 SGT

**Integration wave:** Wave 4 — Product

**Outcome:** The complete vote-to-result experience is integrated across real clients and ready for the golden workflow.

### Owner design gate

| ID | What Codex asks Role 5 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D5-16 | Which viewer moment should lead Role 5's evidence? | Voting proves speed, winner and overlay prove shared payoff, and reconnect proves reliability. | Lead with two viewers voting into the same winner and OBS quest, then show reconnect and fallback as proof of robustness. Role 1 retains final demo narrative authority. | Open |

### P0 work

- Exercise exactly three validated candidates -> two viewer votes -> authoritative tally -> winner -> OBS active quest -> progress -> terminal result -> session points/hype.
- Verify the same session/cycle revision and timestamps across the streamer UI, two viewer clients, Role 1 persistence, and OBS.
- Exercise authenticated and anonymous viewers, Extension unavailable -> hosted fallback, hosted unavailable -> chat fallback, duplicate/late vote, tie, zero vote, token expiry, reconnect, out-of-order snapshot, Twitch offline, persistence failure, broadcast failure, cancellation, skip, expiry, success, and failure.
- Verify Local or Hosted Test with allowlisted accounts and real Twitch activity through Role 1. Fixture harness evidence remains separately labelled.
- Measure Extension loading/bundle evidence in the actual packaging path supplied by Role 1.
- Record consumer contract tests plus actual mouse/touch/keyboard interaction and multi-client evidence.

### Exit checks

- Role 1 mounts public modules without importing Role 5 private files.
- One real two-viewer vote/reconnect run and one OBS browser-source run are recorded.
- `npm run check` and `git diff --check` pass before handoff.
- Screenshots/recordings cover primary, fallback, accessibility, reconnect, degraded, and terminal states.
- Evidence states what was real Twitch/Supabase/OBS, memory-backed, fixture-only, or unverified.
- No client-side vote, timer, lifecycle, reward, fallback, permission, or persistence authority remains.
- Role 5 TODO and one `changes/role-5/` fragment reflect the verified result.

## Phase 5 / R5-P06: Optional P1 refinement after P0 passes

**Cutoff:** 7 August 2026, 18:00 SGT

This phase starts only if Phase 4 has passed and Role 1 agrees the work cannot destabilise the golden workflow or violate Extension performance limits.

### Owner design gate

| ID | What Codex asks Role 5 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D5-17 | If there is time for only one refinement, what should receive it? | Reaction polish increases energy, explanations increase clarity, and result transitions strengthen the payoff. | Improve the weakest observed P0 usability point first; otherwise refine the winner-to-active-quest transition. | Open |

### P1 work

- Refine reaction, hype, result, and reward celebration with reduced-motion alternatives.
- Add clearer session-point/community explanations and retained non-personal summary where accepted.
- Add viewer-engagement measurement events proposed to Role 1 without raw chat or unnecessary identity.
- Refine visual polish, empty states, and microcopy without changing public contracts.

### Exit checks

- P0 regression and constrained-layout/performance checks remain green.
- Voting remains the clearest and fastest primary action.
- No new dependency, shared contract, route, or platform decision lands without its owner.
- Work incomplete at feature freeze is deferred and labelled, not disguised as implemented.

## Feasibility review response format

Role 5's Codex posts one response to [issue #16](https://github.com/Dewflash/chatxpt/issues/16) before Phase 1:

```text
Plan reviewed: ROLE-5-BUILD-PLAN.md + shared matrix
Feasible as written: yes/no
Conflicts or missing requirements:
Contract/command/view gaps (include UI-X IDs):
Route/Extension/hosted/OBS harness gaps:
Design-system handoff sufficient: yes/no and missing items
Dependency requests and no-package fallback:
Performance/accessibility/viewport risks:
Implementation risks and smallest recovery:
Requested plan revision (one consolidated list):
```

Role 2 compares the response with this plan, records one revision, and notifies Role 1. Detailed visual, interaction, accessibility, component, and code choices then remain with Role 5 as long as they preserve the accepted plan.

## Escalate to Role 1 when

- A canonical viewer/overlay view, command, room/access, chat acknowledgement, health, identity, reward, or error contract must change.
- Twitch Extension route/asset/CSP/auth/hosting or OBS secure-read behaviour requires Role 1 implementation.
- A package, lockfile, app route, environment value, or integration test must change.
- A decision changes scope, safety, privacy, cost, ownership, or the golden workflow.
- P0 cannot meet the shared schedule, performance constraints, or real-evidence requirement.
