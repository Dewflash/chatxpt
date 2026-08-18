# Role 4 Feasibility Review: Streamer Studio and Twitch Live Config

**Reviewer:** Role 4 (JYL1m)

**Target reviewers:** @joelyrk (Role 2 plan owner) and @Dewflash (Role 1 project owner)

**Date:** 3 August 2026

**Plan reviewed:** docs/build-plans/ROLE-4-BUILD-PLAN.md and docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md against current main at 61d3e4e

**Review status:** Accepted. The review was submitted in [issue #15, comment 5164904061](https://github.com/Dewflash/chatxpt/issues/15#issuecomment-5164904061); Role 1 acknowledged the handoff; and Role 1 plus Role 2's plan owner approved [PR #30](https://github.com/Dewflash/chatxpt/pull/30) on 4 August 2026 with no scope revision.

**Current authority:** D-071 supersedes role-based implementation gates in this historical review. Any contributor may implement missing upstream work in its proper module; UI modules still must not invent backend authority.

## Owner decisions

| ID | Approved decision |
| --- | --- |
| D4-01 | Use a clean broadcast-control-room feeling: calm and trustworthy for setup, with energetic colour reserved for quests and important live moments. |
| D4-02 | Use a desktop sidebar for Setup, Profile, Live Quests, and Test Lab; use compact narrow navigation; keep first-time setup guided inside Setup; add History only if P1 is approved. |
| D4-03 | Keep pre-stream setup spacious and explanatory; make live-session controls compact and status-dense. |
| D4-04 | Treat the existing violet/lime prototype as a loose reference. Build reversible accessible dark/light tokens, avoid externally hosted fonts, and allow later brand assets without blocking P0. |

## Consolidated response

### Feasibility

Conditionally yes. StreamerViewModel, strict schemas, typed errors, evidence classes, revisions, quest commands, signal provenance, and the public @/streamer boundary are a sound render-only foundation. @/design-system is intentionally empty and ready for Role 4 ownership.

Full P0 UI exits still require the relevant seams. Missing setup, persistence, authentication, actor permissions, quest mechanics, timers, AI status, or route authority stays outside UI modules, but any contributor may implement those capabilities in their corresponding modules without waiting for the responsibility lead.

### Conflicts and missing requirements

1. The public streamer boundary has schemas and types but no render modules. This is expected Role 4 work after acceptance.
2. The current root page and /overlay are legacy local-state surfaces, not accepted Studio, Twitch Config/Live Config, harness, or realtime evidence.
3. StreamerViewModel.services cannot drive Twitch/OBS setup, readiness actions, or recovery.
4. StreamerProfile has generic numeric experience and preference lists but no update command, accepted personality/tone representation, or voting/reward settings.
5. Commands include pause and emergency-pause, but QuestCycleState.status has no paused/emergency-paused representation.
6. availableStreamerActions exists, but the streamer view does not express broadcaster-versus-moderator capability.
7. Canonical fixtures cover only a minimal preparing/idle, unknown-safe streamer state.

### Upstream seams and smallest recovery

- **UI-X01 / #17 - Role 1, Phase 2:** Twitch installation, OBS Virtual Camera setup/permission/capture, readiness, recovery actions, and evidence labels. Interim: disabled or fixture-labelled adapters.
- **UI-X02 / #18 - Role 1, Phases 2-3:** browser-safe profile, lifecycle, setup, and quest client with typed results/revisions plus actor-safe capability. Interim: injected render callbacks.
- **UI-X03 / #19 - Roles 1 and 3, Phases 2-3:** personality/tone, voting/reward/intensity settings, persistence/versioning, and mid-session legality. Interim: unavailable or fixture-only controls.
- **UI-X04 / #20 - Role 1, P1:** omit history from P0.
- **UI-X05 / #21 - Role 1, Phase 1:** thin mounts, authorised dispatch, identity/token-expiry, fixture selection, reconnect controls, DOM interaction, and browser screenshots. Interim: fixture-labelled render-only modules.
- **UI-X06 / #22 - Role 3 through Role 1, Phase 3:** authoritative quest examples including paused/emergency state, tie/zero-vote, interruption, progress, terminal results, and reward state. Interim: render only accepted states.
- **UI-X09 / #25 - Role 2 through Role 1, Phase 2:** known, low-confidence, unknown, stale, denied, provider, algorithmic, and fallback examples. Interim: unknown-safe fixture only.
- **UI-X10 / #26 - Role 1, shared-system relevance:** shared primitives must not assume personal viewer state or private-recovery transport.

### Route, harness, and public modules

Role 1 still needs thin secure mounts for /studio, /studio/test-lab, Twitch Config, and Twitch Live Config. The harness must cover canonical fixtures, broadcaster/moderator capability, command errors, stale revision, token expiry, reconnect, long text, themes, reduced motion, and narrow/wide containers.

Role 4 proposes StreamerStudio, StreamerTestLab, TwitchConfigPanel, and TwitchLiveConfigPanel from @/streamer. Props accept validated state and typed callbacks, never backend implementations.

### Design-system handoff

The Phase 1 handoff is feasible with React/CSS. It will publish semantic colour, type, spacing, radius, elevation, focus, and motion tokens plus accessible button, icon-button, field/label, card/panel, status badge, progress, notice, and visually-hidden primitives.

It will support light/dark/Twitch contexts, non-colour cues, visible focus, at least 44-pixel targets, localisation, zoom, narrow containers, reduced motion, and additive changes. P0 uses system/local fonts unless a contributor implements and verifies CSP-safe font loading, coordinating shared configuration with Role 1.

### Dependencies

No Role 4 P0 runtime dependency is requested. UI-X05 assigns Role 1 the dev-only component/browser test stack and lockfile edit. Until then, Role 4 uses accepted schema/contract checks, pure helpers, available render checks, and the Role 1 harness.

### Risks

| Risk | Owner | Recovery |
| --- | --- | --- |
| UI-X05 or mounts late | Role 1 | Publish fixture-labelled render-only entries; do not claim integration. |
| UI-X01/UI-X02/UI-X03 late | Roles 1/3 | Show unavailable/diagnostic controls; never use local storage as authority. |
| UI-X09 late | Role 2 | Use unknown-safe state and label intelligence unverified. |
| UI-X06 late | Role 3 through Role 1 | Omit unresolved states; never infer lifecycle or rewards. |
| Twitch sizing/CSP unresolved | Role 1 | Keep modules fluid/dependency-light and hosting unverified. |
| Design-system handoff late | Role 4 | Deliver tokens and minimum primitives first; keep changes additive. |
| Dense live controls harm access | Role 4 | Keep emergency control visible, preserve focus, confirm destructive actions, and avoid overflow/noisy announcements. |

### Requested plan revision

No phase, priority, ownership, or scope change is requested. Role 2 should explicitly bind paused/emergency representation to UI-X06, actor capability to UI-X02/UI-X05, settings clarification to UI-X03, and the no-runtime-dependency baseline.

## Implementation baseline after acceptance

The acceptance gate is satisfied. Role 4 begins R4-P02 on a fresh branch after PR #30 merges. Work remains inside src/streamer and src/design-system. Role 4 will not add routes, auth, Supabase calls, Twitch/OBS adapters, AI logic, quest mechanics, lifecycle timers, shared dependencies, or shared test configuration.

## Evidence

- Inspected current contracts/ports, fixtures, realtime subscriber, role entries, package/test stack, legacy routes, Role 1-3 status, shared matrix, and issues #15, #17-#22, #25, and #26.
- Ran clean/in-sync Git checks, git diff --check, and full npm run check: lint, TypeScript, boundary validation (55 files/137 imports), 11 test files/73 tests, and production build.
- Evidence is source/document inspection plus fixture/memory verification. Role 4 rendering, Twitch surfaces, live Twitch/OBS, Supabase multi-client, and live AI are not verified.

No Role 4 UI source implementation has started in this pass. R4-001 is complete and R4-002 is ready after PR #30 merges.
