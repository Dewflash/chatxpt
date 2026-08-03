# Role 4 Build Plan: Streamer Studio and Twitch Live Config

**Implementation owner:** Role 4 (`JYL1m`)

**Plan owner:** Role 2 (`joelyrk`) under D-016

**Status:** Awaiting Role 4's one consolidated feasibility review

**Primary directories:** `src/streamer/`, `src/design-system/`

**Shared matrix:** `docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md`

## Mission

Deliver a self-service ChatXPT Studio for persistent setup and management plus a compact Twitch Config/Live Config companion for stream-time control. The surfaces render Role 1-authorised state and emit commands; they never own Twitch/OBS integration, AI/extraction, quest mechanics, persistence, permissions, or authoritative timers.

## Sequential implementation rule

Role 4 implements one phase at a time.

1. Complete every P0 deliverable and exit check in the current phase.
2. Record the commands, fixtures, screenshots, and limitations actually verified.
3. Resolve or formally defer every blocking contract gap with its owner.
4. Begin the next phase only after the current phase exit is reviewable.

Role 4 may split a phase into small pull requests, but may not start later-phase product work to bypass an incomplete exit. Role 5 may progress concurrently once the Phase 1 design-system handoff is stable.

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

### Work

- Read the root guide, integration contract, Role 4 guide/TODO, this plan, and the shared matrix.
- Return one consolidated response covering conflicts, missing requirements, route/harness needs, dependency requests, viewport/accessibility risks, and the smallest viable recovery for each issue.
- Compare UI-X01 through UI-X06 and UI-X09 with available Role 1/2/3 work.
- Confirm the minimum design-system handoff Role 5 can consume during Phase 1.
- Identify any package request with purpose, version, client/server impact, bundle/runtime risk, and no-package fallback; Role 1 owns installation.

### Exit evidence

- One written feasibility review is sent to Role 2 and Role 1.
- Role 2 records one revision or explicitly records that no revision was needed.
- Every blocker has an owner and required-by phase.
- No source implementation starts before this exit.

## Phase 1 / R4-P02: Public UI boundary and shared design foundation

**Deadline:** 4 August 2026, 18:00 SGT

**Early Role 5 handoff:** 4 August 2026, 12:00 SGT

**Integration wave:** Wave 1 — Boundaries

**Outcome:** Role 4 publishes a stable public UI seam and the minimum accessible design-system contract needed by both UI roles.

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

This phase starts only if Phase 4 has passed and Role 1 agrees the work cannot destabilise the golden workflow.

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

Role 4 returns one response before Phase 1:

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

## Escalate to Role 1 when

- A canonical view, command, profile, health, setup, history, or error contract must change.
- Twitch Extension route/asset/CSP/auth behaviour or OBS setup requires Role 1 implementation.
- A package, lockfile, app route, environment value, or integration test must change.
- A decision changes scope, safety, privacy, cost, ownership, or the golden workflow.
- P0 cannot meet the shared schedule or real-evidence requirement.
