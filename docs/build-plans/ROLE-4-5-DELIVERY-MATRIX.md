# Role 4/5 Shared UI Delivery Matrix

**Plan owner:** Role 2 (`joelyrk`)

**Implementers:** Role 4 (`JYL1m`) and Role 5 (`drdexe`)

**Status:** Accepted after Role 4 and Role 5 consolidated feasibility reviews; no scope revision was required

**Approved Role 2 decisions:** D2-01, D2-02, D2-03, and D2-03A on 3 August 2026

**Acceptance record:** Role 4's review was accepted through issue #15 and PR #30 on 4 August 2026. Role 2 [accepted Role 5's review and settled UX baseline](https://github.com/Dewflash/chatxpt/issues/16#issuecomment-5189664413) on 5 August 2026. All reported upstream gaps remain assigned to UI-X01 through UI-X10 with fixture, disabled, or unavailable interim paths; neither UI role gains backend or lifecycle authority.

This matrix is authoritative for the dependencies shared by `ROLE-4-BUILD-PLAN.md` and `ROLE-5-BUILD-PLAN.md`. The two plans remain standalone implementation guides. This file prevents their route, fixture, contract, and deadline assumptions from drifting.

## Execution rule

- Each role implements its own phases strictly in order. A phase starts only after the previous phase's exit evidence is recorded.
- Role 4 and Role 5 may work concurrently. Sequential phases inside one plan do not require the other role to finish its entire plan.
- A missing upstream seam is a named blocker or fixture boundary, not permission to implement backend, AI, quest, permission, timer, persistence, or fallback-selection logic in a UI module.
- Role 4 publishes the minimum design-system handoff during its Phase 1. Role 5 begins its Phase 1 consumption after that handoff and does not wait for the complete Studio.
- Fixtures are for tests, diagnostics, and offline reproducibility only. They are never presented as live Twitch, extraction, AI, realtime, or multi-device evidence.

## Synchronised delivery calendar

All deadlines use Singapore time and inherit the integration exits in `docs/build-plans/README.md`.

| Deadline | Role 4 exit | Role 5 exit | Shared integration exit |
| --- | --- | --- | --- |
| 3 Aug | Consolidated feasibility review returned | Consolidated feasibility review returned | Role 2 revises once, records plan baseline, and notifies Role 1 |
| 4 Aug, 12:00 | Minimum `@/design-system` handoff published | Public prop/fixture work may begin before noon; design-system consumption begins after the handoff | Role 5 is unblocked without waiting for complete Studio |
| 4 Aug, 18:00 | Public streamer entry and minimum design-system contract pass consumer checks | Public viewer/overlay entries consume the accepted design-system contract and pass consumer checks | Boundary wave is reviewable against canonical fixtures on current `main` |
| 5 Aug, 18:00 | Studio setup, profile/preferences, readiness, and health work against accepted seams | Twitch viewer voting and active-quest flow work against accepted seams | Each UI subsystem is demonstrable independently without invented authority |
| 6 Aug, 18:00 | Studio live controls and Twitch Config/Live Config are connected | Hosted board, chat instructions, and OBS overlay are connected | Real Role 2/3 state can traverse the Role 1 harness into both UI roles |
| 7 Aug, 12:00 | Setup-to-live-control path is integrated | Extension/fallback/overlay vote-to-result path is integrated | One streamer, two viewers, and OBS display the same session/cycle revision |
| 7 Aug, 18:00 | P0 evidence checkpoint; only approved P1 work that cannot destabilise P0 may remain | P0 evidence checkpoint; only approved P1 work that cannot destabilise P0 may remain | Target for complete P0 integration and evidence; only the project owner may call a freeze |
| 8 Aug | Support Role 1 rehearsal/evidence fixes | Support Role 1 rehearsal/evidence fixes | Golden workflow, failure matrix, recording, and disclosure |

## Shared dependency and handoff table

| Dependency | Producer | Consumer | Required by | Current planning status | Allowed interim path |
| --- | --- | --- | --- | --- | --- |
| Canonical `1.0.0` role view/command/error schemas and fixture baseline | Role 1 | Roles 4/5 | Phase 1 | Implemented on `main` | Consume `@/core`/role public entries only |
| Memory persistence, sanitised role snapshots, reconnect subscriber, and permission classes | Role 1 | Roles 4/5 through thin wiring | Phase 1 integration | Implemented foundation; browser command client/harness pending | Canonical fixture wrappers; no direct persistence |
| Config/Live Config/viewer/hosted/OBS local harness, UI verification stack, and authorised command dispatcher (UI-X05) | Role 1 | Roles 4/5 | Phase 1 exit | Required request | Render-only components against fixture callbacks; no role independently adds shared test dependencies |
| Minimum tokens/base components from `@/design-system` | Role 4 | Role 5 | 4 Aug, 12:00 | Required early handoff | Role 5 may define public props/fixtures first, but does not copy temporary tokens |
| Streamer setup/profile/session seams (UI-X01–UI-X03) | Roles 1/3 | Role 4 | Phase 2 | Required requests | Disabled/fixture-labelled adapters only; no competing canonical command |
| Intelligence/provider/unknown examples (UI-X09) | Role 2 | Role 4 and evidence consumers | Phase 2 | Planned in R2-P03/R2-P03A | Existing minimal unknown-safe Core fixture |
| Quest lifecycle/action/tie/reward examples (UI-X06) | Role 3 through Role 1 | Roles 4/5 | R4 Phase 3; R5 Phase 2 | Planned in R3-P02 through R3-P14 | Canonical shape fixtures without asserting unsettled mechanics |
| Hosted-room discovery/access and chat announcement/acknowledgement seams (UI-X07/UI-X08) | Role 1 | Role 5 | Phase 3 | Required requests | Present unavailable/fixture-only state; do not parse/send chat or infer access inside Role 5 |
| Private per-viewer vote receipt, points, and reconnect state (UI-X10) | Role 1 | Role 5 | Phase 2 | Required request | Command-result fixture may demonstrate immediate acknowledgement; shared snapshot must not be treated as personal recovery state |
| Twitch Local/Hosted Test shells and identity/JWT mapping | Role 1 | Roles 4/5 | Phase 3/integration | Planned in R1-P07/R1-P08 | Local fixture harness, explicitly not Twitch evidence |
| OBS capture setup and secure browser-overlay read mount | Role 1 | Role 4 setup and Role 5 overlay | Phase 3/integration | Planned in R1-P09 | Fixture overlay plus documented unverified state |
| Shared preview deployment and real multi-client snapshot path | Role 1 | Roles 4/5 | Phase 4 | Supabase source foundation implemented; cloud/Vercel evidence pending | Credential-free memory runtime, labelled accordingly |
| Session history/summary view (UI-X04) | Role 1 | Role 4 | Phase 5 P1 | Optional request | Omit or label unavailable; never derive authoritative history in UI |

## Public modules and Role 1 mount requests

These are requested mounts. Role 1 owns every file under `src/app/`, Twitch Extension registration/packaging, authentication, and secure route wiring.

| Surface | Owning role/public entry | Requested Role 1 mount | Input | Output | Plan phase |
| --- | --- | --- | --- | --- | --- |
| ChatXPT Studio | Role 4, `@/streamer` | `/studio` | Streamer-safe setup/session view plus `StreamerViewModel` | Authorised setup/profile/session and quest commands through a Role 1 client | R4 Phase 2 |
| Developer Test Lab | Role 4, `@/streamer` | `/studio/test-lab` | Explicit diagnostic fixtures or authorised capture status | Tester-initiated diagnostic actions only; never a live-data substitute | R4 Phase 2/P1 refinement |
| Twitch Config | Role 4, `@/streamer` | Twitch Extension Config Path backed by a thin Role 1 entry | Install/configuration-safe view | Authorised Twitch configuration actions | R4 Phase 3 |
| Twitch Live Config | Role 4, `@/streamer` | Twitch Extension Live Config Path backed by a thin Role 1 entry | `StreamerViewModel` plus actor capability | `StreamerQuestCommand` and approved quick-setting commands | R4 Phase 3 |
| Twitch viewer Extension | Role 5, `@/viewer` | Twitch Extension Viewer Path backed by a thin Role 1 entry | `ViewerViewModel` and Twitch context/identity mapped by Role 1 | `ViewerVoteCommand` and `ViewerReactionCommand` | R5 Phase 2 |
| Hosted Quest Board | Role 5, `@/viewer` | `/quest-board/[roomCode]` plus Role 1-authorised direct-link/share data | `ViewerViewModel`, room/access/share result | Same canonical viewer commands | R5 Phase 3 |
| Twitch-chat fallback instructions | Role 5, `@/viewer` | Copy/template module consumed by Role 1's Twitch adapter and mounted in safe UI surfaces | Participation mode/capability plus counted-status response | No chat parsing or sending; Role 1 maps real chat to viewer commands and owns outbound delivery | R5 Phase 3 |
| OBS browser overlay | Role 5, `@/viewer` | `/overlay` using a Role 1-issued session-bound read grant | `OverlayViewModel` | None; strictly read-only | R5 Phase 3 |

Exact Extension view types and asset paths remain Role 1 decision D1-08. OBS capture/session behaviour remains D1-09. Secure hosted/overlay/per-viewer grant transport is tracked by UI-X08/UI-X10 and the accepted D-041 permission classes. The requested UI module boundaries must remain stable if a thin mount path changes.

## Accepted contracts to consume

| Contract | Current source | Consumer | Authoritative fields/behaviour |
| --- | --- | --- | --- |
| `StreamerViewModel` | `@/core`, exposed through `@/streamer` | Role 4 | Session, persisted profile, service health, gameplay/audience snapshots, and quest cycle at one revision |
| `StreamerQuestCommand` | `@/core`, exposed through `@/streamer` | Role 4 | Approve, reject, start, pause, cancel, skip, succeed, fail, and emergency-pause requests with actor, ID, and expected revision |
| `ViewerViewModel` | `@/core`, exposed through `@/viewer` | Role 5 | Shared participation mode/capabilities, vote/reaction permissions, hype, connection, and quest cycle; personal vote/points fields require the authorised UI-X10 delivery path |
| `ViewerVoteCommand` | `@/core`, exposed through `@/viewer` | Role 5 | One candidate choice with actor, command ID, issued time, and expected revision |
| `ViewerReactionCommand` | `@/core`, exposed through `@/viewer` | Role 5 | One bounded reaction request; server remains authoritative |
| `OverlayViewModel` | `@/core`, exposed through `@/viewer` | Role 5 | Read-only session, hype, quest cycle, authoritative timestamps, and connection state |
| `QuestCycleState` | Nested in all three views | Roles 4/5 | Status, exactly three options when relevant, allowed streamer actions, tallies, active candidate, absolute times, progress, and result |
| `ServiceHealth` | `@/core`/`@/realtime` | Roles 4/5 | Ready, degraded, unavailable, permission-denied, or misconfigured with retryability |
| `DomainError` | `@/core`/`@/realtime` | Roles 4/5 | Typed safe failures; clients do not reinterpret them as engine decisions |
| `SupabaseSnapshotSubscriber` | `@/realtime` | Role 1 thin client wiring for Roles 4/5 | Subscribe first, fetch latest authorised snapshot, discard malformed/out-of-order revisions, refresh token, and report health |

## Required upstream seam requests

These are contract requirements discovered during planning, not accepted schema changes. The owning role must compare them with its implementation and record the outcome before the dependent phase exits.

| Request ID | Owner | Required capability | Why existing contract is insufficient | Required by |
| --- | --- | --- | --- | --- |
| [UI-X01 / #17](https://github.com/Dewflash/chatxpt/issues/17) | Role 1 | Streamer setup/readiness view for Twitch connection/installation, OBS Virtual Camera selection/permission/capture, session readiness, and diagnostic/live labels | `StreamerViewModel.services` gives health but not the self-service setup data or safe actions | R4 Phase 2 |
| [UI-X02 / #18](https://github.com/Dewflash/chatxpt/issues/18) | Role 1 | Browser-safe authorised client for profile updates, session start/end, Twitch setup, capture setup, and quest-command dispatch, returning typed result/error and current revision | Only quest commands are canonical today; UIs must not call Supabase or integration internals | R4 Phases 2-3 |
| [UI-X03 / #19](https://github.com/Dewflash/chatxpt/issues/19) | Roles 1 and 3 | Accepted settings contract for voting/reward preferences and quick intensity changes, including which changes are legal mid-session | Current profile has general experience/restriction fields but no accepted voting/reward settings or update command | R4 Phases 2-3 |
| [UI-X04 / #20](https://github.com/Dewflash/chatxpt/issues/20) | Role 1 | Streamer session-history/summary read model with retention-safe quest outcomes and aggregate engagement | No history view exists in `StreamerViewModel` | R4 Phase 5 (P1) |
| [UI-X05 / #21](https://github.com/Dewflash/chatxpt/issues/21) | Role 1 | Local Extension/Config/Live Config/hosted-board/overlay harness with canonical role snapshots, command dispatcher, auth classes, token-expiry controls, and one approved component/browser test and screenshot path | Role-owned UI modules cannot implement route, identity, permission, realtime composition, or collision-prone shared test configuration | R4 Phase 1 and R5 Phase 1 |
| [UI-X06 / #22](https://github.com/Dewflash/chatxpt/issues/22) | Role 3 through Role 1 | Canonical examples for every quest state, available action, tie/zero-vote resolution, interruption, terminal result, progress method, and reward state | Current schemas define shapes but Role 3's mechanics and examples remain open | R4 Phase 3 and R5 Phases 2-3 |
| [UI-X07 / #23](https://github.com/Dewflash/chatxpt/issues/23) | Role 1 | Twitch-chat fallback poll-open/final-result delivery plus a bounded counted/rejected/late acknowledgement policy through a platform-neutral template/presentation seam | Role 5 owns understandable copy, but cannot parse or send chat, infer acceptance, or promise individual acknowledgement without a real Twitch delivery path | R5 Phase 3 |
| [UI-X08 / #24](https://github.com/Dewflash/chatxpt/issues/24) | Role 1 | Hosted-board room lookup/access result, authorised direct link, copy/share data, optional streamer QR payload, and anonymous/authenticated grant flow without direct table access | `ViewerViewModel` begins after access and does not explain how viewers discover the fallback or how room-entry failures recover | R5 Phase 3 |
| [UI-X09 / #25](https://github.com/Dewflash/chatxpt/issues/25) | Role 2 | Canonical intelligence examples for known, low-confidence, unknown, stale, capture denied, provider available, algorithmic, and fallback states | Current Core fixtures contain only a minimal unknown-safe case | R4 Phase 2 and UI evidence |
| [UI-X10 / #26](https://github.com/Dewflash/chatxpt/issues/26) | Role 1 | Private per-viewer command receipt/read model for accepted choice and session points, including authenticated/anonymous reconnect behaviour | Shared viewer broadcasts correctly remove identity, personal points, and accepted choice; Role 5 otherwise cannot restore or safely display personal acknowledgement | R5 Phase 2 |

Any request that changes `src/core/` requires a `cross-role` issue and Role 1 coordination before implementation. Until accepted, UI owners may create component-level adapters and explicitly labelled fixtures matching the last accepted public contract, but may not create competing canonical types.

## Authoritative, derived, fixture-only, and excluded data

| Class | Examples | UI rule |
| --- | --- | --- |
| Authoritative | Session/cycle revision, capabilities, participation mode, allowed actions, tallies, active candidate, progress, result, shared hype, `startsAt`, `endsAt`, health; personal accepted vote/points only from UI-X10 | Render the latest validated authorised view; never recompute, overwrite, or obtain personal fields from a shared broadcast |
| Presentation-derived | Remaining-time display from server timestamps, percentage labels, confidence bands, responsive layout, local focus/expanded state | May be calculated locally, but cannot trigger lifecycle, winner, expiry, reward, or permission decisions |
| Fixture-only | Loading harness, simulated failure injection, synthetic quest cycles, diagnostic capture examples | Visibly label as test/diagnostic; never include in live evidence |
| Not implemented | Provider/model picker, non-Twitch adapters, public SDK/API, persistent cross-stream economy, client-side winner/tie/reward logic | Do not render as working; disabled `Coming Soon` is allowed only where accepted |

## Shared typed-error presentation

| Error code | Required UI response |
| --- | --- |
| `validation` | Preserve safe user input where possible and explain the invalid field/action; do not retry unchanged data |
| `unauthenticated` | Request reauthentication or offer an allowed anonymous/fallback path |
| `forbidden` | Remove/disable the unavailable action after refreshing authority; never retry as another actor |
| `stale-revision` | Fetch the latest snapshot, explain that state changed, and require a fresh deliberate action |
| `duplicate` | Show the existing accepted result/acknowledgement when supplied; never apply optimistic state twice |
| `unavailable-capability` | Explain the unavailable surface and follow the authoritative participation fallback mode |
| `expired` | Show the authoritative late/ended state and stop accepting the expired action locally |
| `rate-limited` | Preserve state, disable repeated submission temporarily, and expose retry guidance |
| `dependency-unavailable` | Keep the latest safe snapshot, show degraded/disconnected health, and offer retry/reconnect |
| `internal` | Show a non-sensitive generic failure and correlation/reference information when available |

## Canonical UI fixture catalogue

Role 1 owns canonical fixtures under `@/core/testing`. UI owners may keep render-specific wrappers in their own directories. Every fixture remains `evidenceClass: "fixture"` and uses internally consistent session/cycle revisions.

### Role 4 fixtures

| Fixture ID | Required state | Data classification |
| --- | --- | --- |
| `r4.loading.no-snapshot.v1` | Initial load/skeleton before an authorised snapshot | Presentation-only wrapper |
| `r4.session.offline-empty.v1` | No active session; returning profile may exist | Canonical view request |
| `r4.setup.ready.v1` | Twitch, OBS, realtime, and AI readiness available | Requires UI-X01 |
| `r4.setup.permission-denied.v1` | OBS/capture permission denied with recovery action | Requires UI-X01 |
| `r4.setup.misconfigured.v1` | Twitch or OBS setup incomplete | Requires UI-X01 |
| `r4.intelligence.known-live.v1` | Fresh real gameplay/audience observations with confidence/provenance | UI-X09 |
| `r4.intelligence.unknown.v1` | Unsupported/low-confidence facts shown honestly | UI-X09 |
| `r4.intelligence.stale.v1` | Previous observation expired/stale | UI-X09 |
| `r4.generation.ai-provider.v1` | Candidate generation reports free-provider method | Canonical candidate generation metadata |
| `r4.generation.algorithmic.v1` | Credential-free algorithms generated candidates | Canonical candidate generation metadata |
| `r4.generation.fallback.v1` | Provider unavailable and deterministic fallback is visible | Canonical candidate generation metadata plus health |
| `r4.quest.proposed.v1` | Exactly three options and authoritative actions | UI-X06 |
| `r4.quest.voting.v1` | Vote progress and permitted streamer actions | UI-X06 |
| `r4.quest.active.v1` | Active quest, timestamps, progress, and allowed actions | UI-X06 |
| `r4.quest.terminal-set.v1` | Succeeded, failed, cancelled, skipped, and expired variants | UI-X06 |
| `r4.realtime.reconnecting.v1` | Latest safe snapshot retained while reconnecting | Canonical health wrapper |
| `r4.error.command-set.v1` | Stale, duplicate, forbidden, expired, and dependency-unavailable variants | Canonical `DomainError` wrappers |
| `r4.session.ended.v1` | Ended stream with retained result summary | Canonical view; P1 history uses UI-X04 |

### Role 5 fixtures

| Fixture ID | Required state | Data classification |
| --- | --- | --- |
| `r5.loading.no-snapshot.v1` | Initial authorised load | Presentation-only wrapper |
| `r5.session.offline.v1` | Broadcaster offline/ended | Canonical view |
| `r5.mode.extension-ready.v1` | Twitch Extension primary mode | Canonical view |
| `r5.mode.hosted-ready.v1` | Hosted board fallback | Canonical view |
| `r5.mode.chat-ready.v1` | Twitch-chat fallback with `1`/`2`/`3` instructions | Canonical view plus UI-X07 |
| `r5.mode.unavailable.v1` | No participation capability | Canonical view |
| `r5.identity.authenticated.v1` | Twitch viewer identity available | Canonical view |
| `r5.identity.anonymous.v1` | Safe anonymous participation | Canonical view |
| `r5.vote.open.v1` | Exactly three options, tallies, authoritative end time | UI-X06 |
| `r5.vote.accepted.v1` | The authorised viewer's choice is acknowledged | Requires UI-X10 or its accepted command-result path; never source from the shared broadcast |
| `r5.viewer.personal-restored.v1` | The authorised viewer's accepted choice and points return after reconnect without exposing another viewer | Requires UI-X10 |
| `r5.vote.duplicate-late-set.v1` | Duplicate and expired/late responses | `DomainError` wrappers |
| `r5.vote.tie-zero-set.v1` | Tie and zero-vote variants without client resolution | UI-X06 |
| `r5.quest.winner.v1` | Authoritative winner/activation transition | UI-X06 |
| `r5.quest.active-progress-set.v1` | Automatic, manual, and unknown progress variants | UI-X06 |
| `r5.quest.terminal-set.v1` | Succeeded, failed, cancelled, skipped, and expired variants | UI-X06 |
| `r5.engagement.points-hype.v1` | Session points and community hype | Canonical view |
| `r5.realtime.reconnecting.v1` | Reconnecting while retaining latest safe revision | Canonical health wrapper |
| `r5.realtime.permission-expired.v1` | Token expired/revoked; reauth or fallback required | Role 1 access result plus health |
| `r5.board.room-error-set.v1` | Invalid, expired, unavailable, and forbidden room entry | UI-X08 |
| `r5.chat.acknowledgement-set.v1` | Counted, rejected, duplicate, and late chat vote presentation | UI-X07 |
| `r5.overlay.state-set.v1` | Inactive, voting, active, progress, terminal, and reconnect variants | Canonical `OverlayViewModel` fixtures |

## Early Role 4 design-system handoff

Role 4 Phase 1 publishes a stable `@/design-system` entry point before completing Studio. Role 4 retains all detailed visual decisions. The minimum consumable contract must include:

- Semantic colour, typography, spacing, radius, elevation, focus, and motion/reduced-motion tokens.
- Base button/icon-button, field/label, card/panel, status badge, progress, notice, and visually-hidden primitives needed by both roles.
- Light/dark/Twitch-hosted theme adaptation without using Twitch marks as ChatXPT branding.
- Keyboard focus, contrast, target-size, and reduced-motion conventions.
- An additive-change rule: breaking token/component changes require Role 5 review after the handoff.

Role 5 consumes only the public entry point and never copies or edits `src/design-system/` internals. If the final component list needs a shared dependency, Role 4 proposes it to Role 1 before editing `package.json`.

## Shared UI verification and evidence path

Role 1 selects and installs one compatible component-interaction test path plus one real-browser screenshot/end-to-end path under UI-X05. The preferred minimal direction is a DOM-capable React testing setup for fast component behaviour and Playwright for browser, responsive, accessibility, and screenshot evidence. Role 1 confirms exact packages/versions and owns shared configuration; Roles 4/5 do not independently modify the lockfile.

Every captured artifact is entered in a Role 1-owned evidence manifest with surface, viewport/device, session/cycle revision where relevant, capture date, and one of: real Twitch/OBS/cloud, memory-backed integration, fixture-only, or unverified. A file or screenshot without that label is not judged evidence.

## Shared evidence checklist

- Consumer contract tests parse the same canonical fixture IDs and reject invalid/stale/version-mismatched input.
- UI interaction evidence proves commands are emitted with fresh expected revisions and unique command IDs; it does not claim the UI applied the result authoritatively.
- Screenshots cover desktop, narrow/mobile, Twitch-hosted constraints, reduced motion, high contrast, loading, empty, unknown, permission, disconnected, stale, fallback, reconnect, and terminal states.
- Role 5 records a real one-streamer/two-viewer same-revision vote/reconnect run and an OBS transparency/readability run through Role 1's harness.
- Role 4 records setup-to-readiness, saved-profile return, live command, denied/stale command, and emergency-control runs through Role 1's harness.
- Every evidence item states whether it used live input, a real deployed service, the credential-free memory runtime, or fixtures.
