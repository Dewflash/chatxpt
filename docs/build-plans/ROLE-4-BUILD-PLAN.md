# Role 4 Build Plan: Streamer Studio and Twitch Live Config

**Implementation responsibility lead:** Role 4 (`JYL1m`)

**Plan responsibility lead:** Role 2 (`joelyrk`) under D-016 and D-071

**Status:** Accepted after Role 4's consolidated feasibility review in [issue #15](https://github.com/Dewflash/chatxpt/issues/15) and [PR #30](https://github.com/Dewflash/chatxpt/pull/30); no scope revision was required

**Primary directories:** `src/streamer/`, `src/design-system/`

**Shared matrix:** `docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md`

## Mission

Deliver a self-service ChatXPT Studio for persistent setup and management plus a compact Twitch Config/Live Config companion for stream-time control. The surfaces render Role 1-authorised state and emit commands; they never own Twitch/OBS integration, AI/extraction, quest mechanics, persistence, permissions, or authoritative timers.

## Sequential implementation rule

Role 4 implements one phase at a time.

1. Complete every P0 deliverable and exit check in the current phase.
2. Record the commands, fixtures, screenshots, and limitations actually verified.
3. Record every contract gap, notify the relevant leads, and either implement the cross-role slice, use a labelled fixture, or defer it for a stated technical reason.
4. Begin the next phase only after the current phase exit is reviewable.

Role 4 may split a phase into small pull requests, but may not start later-phase product work to bypass an incomplete exit. Role 5 may progress concurrently once the Phase 1 design-system handoff is stable.

### How Codex coaches a novice owner through design decisions

The decision tables below are starter prompts and minimum areas to consider, not a fixed or exhaustive questionnaire. For every user-visible pass, Codex inspects the actual streamer task and generates a small, relevant batch that helps Role 4 think about the experience. It may reword, omit an irrelevant example, add a better question, or show a tiny text wireframe. It should cover the user goal and, where relevant, organisation, information hierarchy, layout/responsiveness, interaction feedback, error/recovery UX, visual tone, motion, accessibility, and trust.

Codex explains the visible result and trade-off first, recommends a default, and then selects the appropriate implementation technique. It must never ask a jargon-only question such as `Flexbox or Grid?`: Role 4 decides whether the content should feel like cards, sections, a sidebar, or another understandable arrangement; Codex decides whether Grid, Flexbox, or another implementation produces that result. Role 4 may reply `Approve all recommendations`.

Role 2 maintains this baseline plan. Role 4's settled answers are recorded in `docs/roles/ROLE-4-EXECUTION.md`. Any contributor may edit either record, while coordinating plan-level changes with Role 2 and preserving the execution record as the source of settled UX choices. Codex checks that record to avoid repeating settled choices, then asks only the relevant unresolved choices for the current pass.

## Definition of done

- A new streamer can connect the accepted Twitch test setup, configure OBS Virtual Camera, save a persistent profile, understand readiness, and start a session without hidden manual state.
- A returning streamer can reuse saved settings instead of repeating onboarding.
- Studio exposes game, personality/tone, creativity/intensity, safety, restrictions, preferred/forbidden quest types, accessibility, and accepted voting/reward preferences without exposing raw provider/model selection.
- Studio distinguishes fresh real signals, low-confidence/unknown/stale signals, free-AI, algorithmic, deterministic fallback, fixture-only diagnostics, and not-implemented states.
- Twitch Config handles infrequent installation/setup; Twitch Live Config handles compact stream-time status and permitted quest controls without duplicating Studio.
- Every streamer action is enabled only from authoritative capability/allowed-action data and is sent through Role 1 with command ID and expected revision.
- Loading, empty, permission-denied, misconfigured, disconnected, stale, fallback, reconnecting, duplicate, forbidden, expired, and terminal states are verified.
- Role 5 consumes the public design system without importing or copying Role 4 internals.
- Role 1 mounts the public modules through thin routes and the setup-to-live-control workflow passes against one authoritative session/cycle revision.

## P0, P1, and exclusions

### P0 required before feature freeze

- Minimum shared design-system entry point and accessibility conventions.
- Studio shell, first-time setup, returning-streamer readiness, persistent profile/preferences, safety/restrictions, game settings, and integration health.
- OBS Virtual Camera setup/status and truthful real/fixture/unknown disclosure.
- Developer-only Test Lab entry with unmistakable diagnostic labelling; it cannot supply judged live evidence.
- Session preparation/start/end controls supplied by Role 1.
- Proposed-quest review and authoritative approve/reject/start/pause/cancel/skip/succeed/fail/emergency-pause controls.
- Compact Twitch Config and Live Config surfaces.
- Responsive, keyboard, reduced-motion, failure, reconnect, and consumer-contract evidence.

### P1 only after the P0 integration exit

- Richer session history and post-stream aggregate summary after Role 1 supplies UI-X04.
- Deeper setup diagnostics, explanations, and non-essential integration telemetry.
- Streamer-experience measurement hooks proposed to Role 1.
- Additional visual polish that does not change public seams or threaten the golden workflow.

### Explicitly excluded

- Provider/model pickers as normal streamer controls.
- YouTube, Discord, or other non-Twitch adapters or platform-specific behaviour.
- Direct Supabase access, client-owned persistence, permission checks, or session authority.
- Quest intervention, validation, timing, voting, winner, progress, reward, or lifecycle calculations.
- OBS WebSocket automation, a desktop companion, public developer API/SDK, billing, or persistent reward economy.
- Simulated signals presented as real capture or live intelligence.

## Surface responsibilities

### ChatXPT Studio

Studio is the complete management surface:

- First-time Twitch installation/connection guidance and returning connection status.
- OBS Virtual Camera selection, permission, raw-game scene guidance, capture health, and recovery.
- Persistent streamer profile, game, personality/tone, creativity/intensity, safety, restrictions, quest preferences, accessibility, and accepted voting/reward settings.
- Pre-stream readiness checklist and service health for Twitch, OBS/capture, AI/intelligence, persistence/realtime, and session state.
- Detailed intelligence disclosure: known/unknown/stale/conflicting facts, confidence/freshness, live/fixture evidence, provider/algorithmic/fallback status, and advertised capability tier.
- Full live controls, session history/summary when available, and explicitly developer-only diagnostics.

### Twitch Config

Twitch Config is for infrequent Extension installation and channel configuration. It shows the minimal channel link/installation state, directs full management to Studio, and never becomes a second complete settings product.

### Twitch Live Config

Live Config is a compact dashboard companion:

- Current session/realtime/capture/AI status.
- Proposed quest review and current voting/active/result state.
- Only the quest actions listed by the authoritative quest cycle for the authenticated broadcaster/moderator.
- Approved quick intensity adjustment and vote visibility after UI-X03 is accepted.
- Emergency pause that remains prominent and keyboard accessible when Role 3 permits it.
- A clear path back to Studio for setup, detailed settings, history, testing, and recovery.

Twitch currently describes Config as infrequent setup in a dynamically sized iframe up to 1100px wide and Live Config as stream-time dashboard control that may pop out. Role 1 owns Extension registration and hosting; Role 4 must keep both modules fluid and CSP-compatible. See [Twitch Extension life cycle](https://dev.twitch.tv/docs/extensions/life-cycle) and [Extensions reference](https://dev.twitch.tv/docs/extensions/reference/).

## Public entry and dependencies

Role 4 exports its renderable modules and public props through `@/streamer` and its shared tokens/components through `@/design-system`. Product code must not import another role's private files.

Current accepted inputs:

- `StreamerViewModel`, `StreamerProfile`, `QuestCycleState`, `ServiceHealth`, `GameplaySnapshot`, and `AudienceSnapshot`.
- `StreamerQuestCommand` for accepted quest actions.
- `DomainError` and browser-safe snapshot/reconnect health delivered by Role 1.

Required upstream seams UI-X01 through UI-X06 and UI-X09 are defined in the shared matrix. Role 4 must flag missing setup/profile/session/history contracts in its feasibility review and may not create competing canonical definitions.

## Phase 0 / R4-P01: Feasibility review and implementation baseline

**Deadline:** 3 August 2026

**Outcome:** Role 4 confirms that the plan can be implemented without silently inventing contracts or scope.

### Owner design gate

Codex first prepares the technical feasibility review itself, then uses these as starting points for a tailored visual/product discussion:

| ID | What Codex asks Role 4 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D4-01 | What should Studio feel like at first glance? | A serious broadcast control room, a playful quest/game interface, or a plain utility dashboard. | A clean broadcast control room with a few playful quest accents; trustworthy during setup and energetic only around quests. | Settled in `ROLE-4-EXECUTION.md` |
| D4-02 | How should the main Studio be organised? | A left sidebar keeps major areas visible; top tabs save horizontal space; a step-by-step flow guides one task at a time. | Desktop sidebar for Setup, Profile, Live Quests, and Test Lab; guided steps inside first-time Setup; compact mobile navigation. Add History only if the optional P1 phase is approved and built. | Settled in `ROLE-4-EXECUTION.md` |
| D4-03 | How much information should be visible? | Large guided sections are easier for beginners; dense panels help during a live stream; showing everything at once becomes noisy. | Spacious and guided before the stream, compact and status-dense during the stream. | Settled in `ROLE-4-EXECUTION.md` |
| D4-04 | Does Role 4 already have brand references it wants Codex to follow? | Existing colours, logos, or screenshots can guide the system; otherwise Codex creates reversible defaults and Role 4 reviews screenshots. | Do not block on assets; begin with an original dark/light system and one energetic accent, then revise from screenshots. | Settled in `ROLE-4-EXECUTION.md` |

### Work

- Read the root guide, integration contract, Role 4 guide/TODO, this plan, and the shared matrix.
- Return one consolidated response covering conflicts, missing requirements, route/harness needs, dependency requests, viewport/accessibility risks, and the smallest viable recovery for each issue.
- Compare UI-X01 through UI-X06 and UI-X09 with available Role 1/2/3 work.
- Confirm the minimum design-system handoff Role 5 can consume during Phase 1.
- Identify any package change with purpose, version, client/server impact, bundle/runtime risk, and no-package fallback; any contributor may implement it and Role 1 deconflicts shared files.

### Exit evidence

- One written feasibility review is posted to [issue #15](https://github.com/Dewflash/chatxpt/issues/15), where Role 2 and Role 1 can compare it.
- Role 2 records one revision or explicitly records that no revision was needed.
- Every gap has a responsibility area, available contributor, and required-by phase.
- The feasibility record may be completed alongside source work; it is not an edit or push permission gate under D-071.

**Acceptance record (4 August 2026):** Role 2 accepted Role 4's review without changing phase, priority, responsibility, or scope. The existing UI-X01 through UI-X06, UI-X09, and UI-X10 assignments preserve every reported dependency. Under D-071, any contributor may implement upstream behaviour in its proper module while the UI remains non-authoritative.

## Phase 1 / R4-P02: Public UI boundary and shared design foundation

**Deadline:** 4 August 2026, 18:00 SGT

**Early Role 5 handoff:** 4 August 2026, 12:00 SGT

**Integration wave:** Wave 1 — Boundaries

**Outcome:** Role 4 publishes a stable public UI seam and the minimum accessible design-system contract needed by both UI roles.

### Owner design gate

| ID | What Codex asks Role 4 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D4-05 | How should cards and controls be arranged? | Rows work well for toolbars; columns and card grids organise larger dashboard sections. Codex can combine both and choose Flexbox/Grid internally. | Grid for page/card layout and Flexbox for button/status rows; no owner decision about CSS syntax is required. | Open |
| D4-06 | Where should ribbons, badges, and progress treatments appear? | Badges are compact status labels; ribbons are louder highlights; progress bars show time or completion. | Use badges for service/state health, reserve one ribbon treatment for the selected/winning quest, and use progress only for real authoritative progress. | Open |
| D4-07 | How animated should the shared interface feel? | No motion is calm; subtle motion confirms actions; arcade motion feels energetic but can distract and cost performance. | Subtle button/card feedback and quest transitions, always with reduced-motion and no continuous decorative animation. | Open |
| D4-08 | What component character should the shared design system use? | Sharp corners feel technical; very round shapes feel playful; medium rounding balances both. | Medium-radius, high-contrast panels with clear focus rings and generous touch targets. | Open |

### P0 work

- Define render-only module props around accepted view models, typed command dispatch, transport health, and loading state; no route/auth/persistence code.
- Export Studio, Twitch Config, and Twitch Live Config module entry points through `src/streamer/index.ts` using names selected by Role 4 and documented for Role 1.
- Publish semantic tokens and minimum base components through `src/design-system/index.ts` as required by the shared matrix.
- Provide safe defaults for dark/light Twitch-hosted contexts, visible focus, contrast, touch targets, reduced motion, long/localised text, and narrow layouts.
- Add Role 4-owned consumer tests using the accepted Core fixtures and render wrappers; request any shared test dependency through Role 1.
- Provide a fixture gallery or development harness module that is unmistakably fixture-only and mounted only by Role 1's test harness.

### Exit checks

- `@/streamer` and `@/design-system` expose documented public entries with no private cross-role imports.
- `npm run check:boundaries` and the smallest Role 4 contract tests pass.
- Role 5 can render one button/control, status, notice, card/panel, and progress treatment using only `@/design-system`.
- Loading, focus, reduced-motion, light/dark, narrow-width, and long-text screenshots are recorded.
- Breaking changes after this handoff require Role 5 review.

## Phase 2 / R4-P03: Studio setup, persistence, intelligence, and readiness

**Deadline:** 5 August 2026, 18:00 SGT

**Integration wave:** Wave 2 — Core

**Outcome:** A new or returning streamer can reach a truthful ready-to-stream state through Studio.

### Owner design gate

| ID | What Codex asks Role 4 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D4-09 | Should first-time setup be one long page or a guided sequence? | One page exposes everything; a stepper reduces overload and shows progress. | A short guided setup sequence, followed by a reusable readiness dashboard for returning streamers. | Open |
| D4-10 | How should many customisation settings be grouped? | Separate pages are clearest but slower; tabs are compact; collapsible advanced sections keep uncommon choices out of the way. | Five understandable groups: Game, Streamer Style, Quest Intensity, Safety/Restrictions, and Accessibility; advanced details collapsed. | Open |
| D4-11 | How should readiness be communicated? | One overall score is simple but can hide the real blocker; a checklist shows exactly what needs attention. | A checklist with individual Twitch, capture, intelligence, realtime, and session status plus one clear next action; no misleading readiness percentage. | Open |
| D4-12 | How much AI/extraction detail should be visible? | Technical detail builds trust but can overwhelm; hiding it makes failures confusing. | Plain status and confidence first, with expandable method/provenance details for curious streamers and testers. | Open |

### P0 flow A — First-time setup

1. Explain ChatXPT's Twitch-only MVP and the distinction between Studio, Twitch viewer Extension, and OBS output.
2. Connect/install Twitch through Role 1's authorised setup client.
3. Guide OBS Virtual Camera selection and permission recovery; warn against recursively capturing the ChatXPT overlay.
4. Save streamer/game/experience/safety/accessibility preferences through the accepted profile update seam.
5. Show a readiness checklist driven by authoritative services/capabilities, not optimistic UI state.
6. Start a preparing/live session only through Role 1's lifecycle service.

### P0 flow B — Returning streamer

- Load persisted profile/preferences and current integration health.
- Show what changed or requires attention without forcing complete onboarding again.
- Restore the latest authorised session snapshot or clearly show offline/ended state.

### P0 intelligence presentation

- Display capability tier and supported signals without claiming universal HUD understanding.
- Represent known, unknown, stale, unavailable, permission-denied, and conflicting observations.
- Use understandable confidence/freshness bands while preserving access to method/time details.
- Distinguish live real input, credential-free algorithms, free-AI provider output, deterministic fallback, and fixture-only Test Lab data.
- Never expose raw provider payloads, private chat, secrets, or raw model controls.

### P0 diagnostics

- Show actionable health/recovery for Twitch, OBS/capture, AI/intelligence, realtime/persistence, and session status.
- Provide developer-only fixture/simulator controls only through the accepted Test Lab harness with persistent diagnostic labelling.
- Do not store frames or raw chat in Role 4 code.

### Required fixtures

`r4.loading.no-snapshot.v1`, all `r4.setup.*`, all `r4.intelligence.*`, all `r4.generation.*`, `r4.realtime.reconnecting.v1`, and the relevant `r4.error.command-set.v1` variants.

### Exit checks

- First-time and returning flows work against Role 1's memory runtime or accepted harness.
- Saved preferences survive reload through Role 1 persistence; UI local storage is not the source of truth.
- Permission denied, capture unavailable/stale, provider unavailable, realtime disconnected, and unknown evidence all have recovery or honest limitation states.
- Desktop and narrow/mobile Studio screenshots plus keyboard-only walkthrough are recorded.
- No simulated input is labelled live.

## Phase 3 / R4-P04: Studio live controls and Twitch Config/Live Config

**Deadline:** 6 August 2026, 18:00 SGT

**Integration wave:** Wave 3 — Behaviour

**Outcome:** Streamers and moderators control an authoritative quest cycle from Studio or the compact Twitch surface without duplicated business rules.

### Owner design gate

| ID | What Codex asks Role 4 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D4-13 | How should three proposed quests be compared? | Three side-by-side cards are fast on wide screens; a stacked list is clearer in narrow Twitch views. | Responsive three-card comparison in Studio and a stacked compact list in Live Config. | Open |
| D4-14 | Which actions deserve confirmation? | Confirming everything is slow; confirming destructive/end-state actions prevents accidental disruption. | Confirm cancel, skip, fail, and end-session actions; approve/start/pause remain immediate; emergency pause stays one obvious immediate action. | Open |
| D4-15 | How should live controls be prioritised? | Showing every action equally creates a dangerous button wall; primary and overflow groups focus attention. | One primary contextual action, visible emergency pause, and secondary allowed actions in a clearly labelled group or menu. | Open |
| D4-16 | How compact should Twitch Live Config be? | Dense layouts show more state; spacious layouts are easier under pressure. | One-column status-first layout with the active/proposed quest and current allowed actions above secondary details. | Open |

### P0 work

- Render proposed, voting, active, progress, terminal, cooldown, paused/emergency, and ended states from `StreamerViewModel`.
- Render exactly three proposed/voting options when provided, including duration, difficulty, reward suggestion/result, rationale appropriate for the streamer, source status, and relevant unknown/fallback disclosure.
- Show only actions in `questCycle.availableStreamerActions`, further filtered by Role 1's authenticated actor capability.
- Emit each command once with a new command ID and the latest expected revision; disable repeat submission until Role 1 responds.
- On stale revision, reload the snapshot and require the streamer to decide again. On duplicate, show the authoritative existing result. On forbidden/expired, remove the invalid affordance after refresh.
- Derive countdown display from `startsAt`/`endsAt`, but never decide voting close, quest expiry, or terminal outcome on the client.
- Keep Config focused on installation/channel readiness and Live Config focused on current status, compact controls, quick accepted settings, and emergency pause.
- Preserve the same command semantics across Studio and Live Config.

### Required fixtures

All `r4.quest.*`, `r4.error.command-set.v1`, `r4.realtime.reconnecting.v1`, and `r4.session.ended.v1` fixtures.

### Exit checks

- Approve/reject/start/pause/cancel/skip/succeed/fail/emergency commands are emitted only when supplied as allowed actions.
- Broadcaster and moderator capability differences are demonstrated; denied commands do not mutate local authoritative state.
- Stale, simultaneous, duplicate, expired, reconnect, and token-loss flows retain or reload the correct revision.
- Config and Live Config render at dynamic narrow/wide and pop-out sizes without relying on a fixed iframe dimension.
- Focus order, keyboard activation, live announcements, reduced motion, and destructive-action confirmation are verified.

## Phase 4 / R4-P05: P0 integration, resilience, and evidence

**Functional exit:** 7 August 2026, 12:00 SGT

**Evidence exit:** 7 August 2026, 18:00 SGT

**Integration wave:** Wave 4 — Product

**Outcome:** The complete streamer path is integrated with Role 1/2/3 and ready for the golden workflow.

### Owner design gate

| ID | What Codex asks Role 4 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D4-17 | Which streamer moment should lead Role 4's evidence? | Setup proves frictionlessness; quest review proves control; live recovery proves reliability. | Lead with returning-streamer readiness into proposed-quest review, then include setup and recovery as supporting evidence. Role 1 retains final demo narrative authority. | Open |

### P0 work

- Exercise setup -> saved profile -> session readiness -> real intelligence -> exactly three validated candidates -> controls -> voting visibility -> active quest -> result -> ended session.
- Verify the same session/cycle revision in Studio, Live Config, Role 1 persistence, viewer clients, and OBS evidence supplied by the integration run.
- Exercise capture permission loss, unknown gameplay fact, AI unavailable/algorithmic route, realtime reconnect, stale command, duplicate command, forbidden moderator action, token expiry, persistence failure, and broadcast failure.
- Record actionable screenshots/short recordings for all P0 fixture families and real integration states.
- Provide consumer contract-test and actual interaction evidence; a schema parse alone is not a working UI claim.

### Exit checks

- Role 1 mounts the public modules without importing Role 4 private files.
- `npm run check` and `git diff --check` pass before handoff.
- The walkthrough states which inputs/services were real, memory-backed, fixture-only, algorithmic, AI-provider, or unverified.
- No client-side permission, lifecycle, timer, winner, reward, or persistence authority remains.
- Role 4 TODO and one `changes/role-4/` fragment reflect the verified result.

## Phase 5 / R4-P06: Optional P1 refinement after P0 passes

**Cutoff:** 7 August 2026, 18:00 SGT

This phase starts after Phase 4 stability evidence passes. No role-owner approval gate applies; the contributor must preserve the golden workflow and deconflict shared changes with Role 1.

### Owner design gate

| ID | What Codex asks Role 4 | Choices explained in plain language | Recommended starting point | Baseline status |
| --- | --- | --- | --- | --- |
| D4-18 | If there is time for only one refinement, what should receive it? | History helps retention, diagnostics helps recovery, and visual polish helps presentation. | Improve the weakest observed P0 usability point first; otherwise add a concise post-stream summary rather than broad analytics. | Open |

### P1 work

- Add richer retained session history and post-stream aggregate summary through UI-X04.
- Add deeper diagnostic explanation and non-essential status detail.
- Add accepted streamer-experience measurement events without collecting raw chat or unnecessary viewer identity.
- Refine visual polish, empty states, and onboarding copy without changing public contracts.

### Exit checks

- P0 regression checks remain green.
- No new dependency, shared contract, route, or provider decision lands without its owner.
- Work incomplete at feature freeze is deferred and labelled, not disguised as implemented.

## Feasibility review response format

Role 4's Codex posts one response to [issue #15](https://github.com/Dewflash/chatxpt/issues/15) before Phase 1:

```text
Plan reviewed: ROLE-4-BUILD-PLAN.md + shared matrix
Feasible as written: yes/no
Conflicts or missing requirements:
Contract/command/view gaps (include UI-X IDs):
Route/harness gaps:
Design-system minimum handoff confirmation:
Dependency requests and no-package fallback:
Implementation risks and smallest recovery:
Requested plan revision (one consolidated list):
```

Role 2 compares the response with this plan, records one revision, and notifies Role 1. Detailed visual, interaction, accessibility, component, and code choices then remain with Role 4 as long as they preserve the accepted plan.

## Coordinate with Role 1 when

- A canonical view, command, profile, health, setup, history, or error contract changes; any contributor may implement it with affected tests and Role 1 deconfliction.
- Twitch Extension route/asset/CSP/auth behaviour or OBS setup changes; any contributor may implement the proper integration module while Role 1 coordinates safety and overlap.
- A package, lockfile, app route, environment value, or integration test changes; any contributor may edit it after checking overlap and coordinating before merge.
- A decision changes scope, safety, privacy, cost, responsibility, or the golden workflow; the project owner settles that durable decision before merge.
- P0 cannot meet the shared schedule or real-evidence requirement.
