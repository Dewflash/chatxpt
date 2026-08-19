# ChatXPT Integration Contract

**Owner:** Role 1 (`Dewflash`)

**Status:** Authoritative planning and implementation boundary. Concrete schemas are published by R1-P02 under `src/core/`.

## Purpose

Five independently implemented components become one product only when they exchange stable, tested messages through one runtime authority. This document defines those seams before implementation. No role may replace a seam with a direct import of another role's internals.

An individual role being “done” is insufficient. A wave exits only when its work is merged into `main`, consumes the latest canonical examples, and passes the relevant cross-role contract or integration test.

## Runtime authority

Role 1 owns the ChatXPT application orchestrator. It is the only layer that composes adapters, invokes Role 2 and Role 3 ports, persists authoritative state, and broadcasts view state.

```text
Role 1 inputs (Twitch + capture + stored profile)
        -> Role 2 intelligence/candidate port
        -> Role 3 deterministic engine port
        -> Role 1 validates revision, persists, and broadcasts
        -> Role 4/5 render role-specific view models

Role 4/5 command
        -> Role 1 authenticates, authorises, deduplicates, and loads state
        -> Role 3 decides the legal transition/result
        -> Role 1 atomically persists and broadcasts the new revision
```

- Role 2 returns intelligence and candidate data. It does not mutate sessions, votes, quest lifecycle, or UI state.
- Role 3 returns deterministic decisions, events, allowed actions, and new engine state. It does not call Supabase, broadcast realtime messages, ingest Twitch, or render UI.
- Roles 4 and 5 emit commands and render view models. They do not calculate winners, lifecycle transitions, permissions, rewards, authoritative countdowns, or fallback selection.
- Role 1 does not recreate Role 2 analysis or Role 3 rules inside the orchestrator.

## Required public seams

Names may be refined in R1-P02, but responsibilities and dependency direction are fixed.

| Producer | Public seam | Consumer | Minimum responsibility |
| --- | --- | --- | --- |
| Role 1 | `FrameSource` | Role 2 | Ephemeral frame, timestamp, source/capture status, permission/stale state; no UI dependency |
| Role 1 | `AudienceEventSource` | Role 2 | Normalised chat/activity event with Twitch payload removed |
| Role 1 | `StreamerProfileReader` | Role 1 orchestrator for Roles 2/3 | Validated saved preferences, restrictions, game context, and version |
| Role 2 | `IntelligenceProvider` | Role 1 orchestrator | Gameplay/audience snapshots with provenance, confidence, freshness, and `unknown` |
| Role 2 | `AudiencePointerAggregate` | Role 1 orchestrator | Ephemeral, source-labelled topic evidence with opaque participant/message deduplication keys; Role 1 retains only counts, time window, confidence, and non-personal signal references |
| Role 2 | `CandidateProvider` | Role 1 orchestrator | Exactly three candidates passed to Role 3 with traceable context and provider/algorithmic status |
| Role 3 | `QuestEngine` | Role 1 orchestrator | Pure command/state decision boundary returning events, state, allowed actions, and typed rejection |
| Role 1 | `StreamerViewModel` + `StreamerCommand` | Role 4 | Streamer-safe state plus commands accepted by the orchestrator |
| Role 1 | `ViewerViewModel` + `ViewerCommand` | Role 5 | Capability-filtered participation state plus vote/reaction commands |
| Role 1 | `OverlayViewModel` | Role 5 | Read-only inactive/voting/active/progress/result/reconnect presentation state |
| Role 4 | Design-system public entry point | Role 5 | Versioned tokens and base components without Role 5 importing private Role 4 modules |

Twitch `1`/`2`/`3` messages are parsed and authenticated by Role 1's Twitch adapter into the same normalised viewer-command path. Role 5 owns the instructions and counted-status presentation, not parsing or vote authority.

## Canonical envelope and errors

Every cross-role command/event/state message includes, where applicable:

```text
contractVersion
sessionId
questCycleId
messageId or commandId
revision or expectedRevision
occurredAt and receivedAt
source and method
actor/identity class
correlationId
```

- Time is expressed as UTC timestamps or epoch milliseconds. Countdown view models expose authoritative `startsAt`/`endsAt`; clients derive display time and never own the result.
- Commands are idempotent by `commandId` and use `expectedRevision` when changing authoritative state.
- Errors are typed and safe to display or map: validation, unauthenticated, forbidden, stale revision, duplicate, unavailable capability, expired, rate limited, dependency unavailable, and internal.
- Provider/Twitch/Supabase payloads and raw UI component state never enter canonical domain contracts.

## Realtime, persistence, and recovery rules

- Supabase stores the authoritative session/cycle revision; realtime messages notify clients but do not replace the database source of truth.
- A state-changing operation loads the current revision, lets Role 3 decide when required, and persists the new state/events atomically before broadcasting.
- Duplicate commands/votes return the existing accepted result rather than applying twice.
- Out-of-order or stale updates are discarded by revision.
- Reconnecting clients fetch the latest authorised snapshot first and then subscribe; event replay is optional for the MVP and must not be assumed by UIs.
- Token expiry, revoked access, Supabase write failure, network loss, and partial broadcast failure have explicit health/error states.
- Broadcaster/moderator commands, viewer commands, system analysis, and read-only overlay access use separate permission classes.
- Raw frames are not persisted. Raw chat is preferably processed in memory; if retained for debugging, Role 1 implements automated deletion within the accepted 24-hour maximum.
- Audience-pointer participant deduplication keys and message fingerprints are process-local inputs only. They never enter authoritative state, command receipts, realtime snapshots, session history, viewer projections, or OBS projections.

## Shared files and dependency coordination

Role 1 maintains and deconflicts shared composition and collision-prone files; any contributor may edit them:

- `src/app/` route/layout/provider entry points and the single app-level global-style import.
- `package.json`, `package-lock.json`, TypeScript/Next/Vitest/ESLint configuration, and shared path aliases.
- `.env.example`, server-side environment validation, Vercel configuration, and secure headers.
- Supabase schema/migrations, RLS policies, seeds, and deployment instructions.
- `tests/integration/` and canonical contract examples/tests under `src/core/`.

Responsibility-specific modules expose documented public entry points from their mapped directories. Route files stay thin and mount those modules. A contributor that needs a dependency records the package, version, purpose, client/server impact, size/runtime risk, and fallback, then checks active branches, deconflicts the shared package/lockfile edit with affected contributors, and notifies Role 1. Prior permission or Role 1 approval is not required; documented deconfliction before merge is.

Design-system code stays under `src/design-system/`, and Role 4 is its responsibility lead. Any contributor may edit it. Role 1 only mounts the app-level import, and viewer product code consumes the public design-system entry point rather than copying or privately importing its internals.

## Contract fixtures and test ladder

Role 1 publishes versioned valid and invalid examples for every public seam. Test fixtures are labelled and never presented as live evidence.

Required ladder:

1. Schema tests for accepted, unknown, stale, invalid, and version-mismatch messages.
2. Producer contract tests showing each role emits canonical examples.
3. Consumer contract tests showing the next role accepts canonical examples without importing producer internals.
4. Role 2 output -> Role 3 validation/lifecycle integration.
5. Role 3 decision -> Role 1 atomic persistence/realtime integration.
6. Role 1 view models -> Role 4/5 commands and rendering states.
7. Multi-browser streamer/two-viewer voting, reconnect, duplicate, and countdown test.
8. Real OBS frame and real Twitch test-channel golden workflow plus failure matrix.

Every wave merges the smallest passing vertical slice. The team does not wait until all five roles declare completion before connecting them.

## Risk-first work that starts immediately

These checks run during the first boundary wave, even if their full implementations belong to later phases:

- Twitch account/2FA, developer console access, app/Extension registration attempt, and Local/Hosted Test route feasibility.
- OBS Virtual Camera visibility in the target browser, permission recovery, real-frame sampling, and overlay-recursion avoidance.
- Supabase Free realtime round trip across two browser clients plus RLS feasibility.
- Vercel preview deployment and server/client secret separation.
- Role 2/3 free-provider comparison and a confirmed no-credential algorithmic/deterministic route.

A failed spike creates a Role 1-owned recovery decision immediately; it is not deferred to final integration.

## Game-support capability tiers

ChatXPT remains usable for action-game streams without pretending every HUD is understood equally.

| Tier | MVP behaviour | Claim allowed |
| --- | --- | --- |
| Universal visual | Motion/activity, quiet/downtime, scene/transition, and broad pacing signals | Works across supported browser-visible action gameplay with confidence/unknown handling |
| Calibrated HUD | Configured regions/templates/parsers for selected owned demo games | Specific health, score, timer, kill-feed, or team facts only when that adapter proves them |
| Native telemetry | Future official game integration | Not implemented in this MVP |

Role 2 keeps game/HUD calibration inside extraction adapters and publishes capabilities with every snapshot. Role 3 uses only evidenced facts. Roles 4/5 show unavailable/unknown capability states without presenting them as errors or invented data.

## Binding requirements for Role 2's Role 4/5 plans

The two UI plans are separate deliverables but one synchronised system. Both must include:

- The exact plan phase/pass, P0/P1/excluded scope, date, and integration-wave exit.
- Required route/embedding mount outcome and Role 1 deconfliction contact; any contributor may edit `src/app/`, while role-specific logic remains outside the thin route shell.
- Input view models, emitted commands, typed errors, capabilities, and public entry point.
- A complete state/fixture catalogue: loading, empty, ready, unknown, permission denied, disconnected, stale, provider unavailable, fallback, reconnecting, and terminal states relevant to that surface.
- Which data is authoritative, derived for presentation, fixture-only, or not implemented.
- Contract tests plus screenshots/recordings and actual interaction evidence.
- Twitch iframe/viewport, hosted fallback, mobile, accessibility, focus, reduced-motion, and OBS transparency/readability constraints where relevant.
- No AI, extraction, lifecycle, vote resolution, timer authority, permissions, reward calculation, or persistence logic in UI modules.

The plans must also contain one shared dependency table:

- Role 4 publishes minimum design tokens and base-component entry point early; Role 5 begins against the accepted token contract rather than waiting for the complete Studio.
- Role 1 publishes route shells, fixture view models, commands, and a local Extension/overlay harness early.
- Role 3 publishes allowed-action and lifecycle examples early.
- Role 2 publishes intelligence/provider/unknown status examples early.

Role 4/5 feasibility reviews flag missing view models, commands, fixtures, route mounts, or upstream deadlines as early as practical. Contributors may implement the missing cross-role slice in parallel; the review is not an edit gate.

## Integration completion rule

The app is integrated only when the exact same session and quest-cycle revision is observable across the orchestrator, streamer UI, two viewer clients, and OBS overlay, and every displayed action/result can be traced to a canonical command/event. Separate screenshots of five working modules are not integration evidence.
