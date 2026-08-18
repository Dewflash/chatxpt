# Role 5 Feasibility Review: Viewer Participation and OBS Visuals

**Reviewer:** Role 5 (`drdexe`)

**Target reviewers:** @joelyrk (Role 2 plan owner) and @Dewflash (Role 1 project owner)

**Date:** 3 August 2026

**Plan reviewed:** `docs/build-plans/ROLE-5-BUILD-PLAN.md` and `docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md`; reconciled with merged PR #27 and PR #29 on 3 August 2026

**Review status:** Accepted and reconciled through issue #16. D-071 now supersedes the role-based source-implementation gate from this historical review.

**Coordination issue:** [#16 Role 5 feasibility review and plan acceptance](https://github.com/Dewflash/chatxpt/issues/16)

## Consolidated response

### Reconciliation with current main

The first review was authored from commit `dba25f4`, before PR #27 added the adaptive Role 5 design gates and complete UI-X matrix. Current main now defines D5-01 through D5-04 as viewer feeling, vote interaction, celebration intensity, and visual references. Those UX decisions remain open in `ROLE-5-EXECUTION.md`; the earlier technical recommendations must not overwrite them.

Role 1 preserved the technically valid recommendations below under distinct feasibility IDs while resolving PR #28's merge conflict. Role 2 still owns the accept/revise comparison, and Role 5 still owns the current tailored UX answers.

### Preserved Role 5 feasibility recommendations

| ID | Preserved Role 5 recommendation | Current disposition |
| --- | --- | --- |
| F5-01 | Export `TwitchViewerPanel`, `HostedQuestBoard`, `TwitchChatVoteInstructions`, and read-only `QuestOverlay`; keep the overlay command-free with conservative safe areas and reduced motion. | Preserved as a Role 5 component proposal for Role 2 comparison. Exact public names remain Role 5-owned; Role 1 owns mounts. |
| F5-02 | Never update tallies optimistically; await authoritative command results, retain the latest safe shared snapshot while reconnecting, and prefer immediate private command acknowledgement plus an authorised reconnect fetch over a new private realtime topic unless evidence requires one. | Non-optimistic authority is accepted by existing rules. The private recovery transport remains Role 1 decision UI-X10/#26. |
| F5-03 | Reuse canonical state/commands for the hosted fallback, with direct links, eight-character room codes, anonymous access, optional QR, and Role 1-authoritative chat acknowledgement. | Preserved and aligned with D-040/D-041 plus UI-X07/#23 and UI-X08/#24; delivery remains Role 1 work. |
| F5-04 | Add no new P0 runtime dependency; if telemetry is later approved, keep it session-scoped and limited to surface load, command result, reconnect result, and reaction result without raw chat or personal identifiers. | No dependency request is accepted for this pass. Telemetry remains a Role 1 KPI/privacy decision and is not implemented. |

### Feasible as currently phased

Conditionally yes. PR #27 corrected the plan structure and tracks every known upstream seam. UI exits still depend on the required capabilities, but source work does not wait on another role: any contributor may implement missing vote, lifecycle, access, identity, fallback, timer, reward, or persistence behaviour in its proper module. UI code must not invent that authority.

### Conflicts or missing requirements

1. The former `R5-007` P0/P1 mismatch is resolved on current main as R5-007A (P0 functional baseline) and R5-007B (P1 polish).
2. The merged Core fixture set proves only a minimal idle viewer/overlay boundary. It does not yet supply the Role 5 catalogue required by Phases 1 through 3.
3. The fixture-gallery requirement must preserve the boundary rule that product code does not import `@/core/testing`. Role 5 will keep canonical fixture imports in test/diagnostic-only modules or accept fixture values through dependency-injected harness props supplied by Role 1.
4. The plan requires a community hype meter, but the current view exposes an unbounded non-negative integer. Role 1 must either publish an authoritative scale/level or confirm that P0 presents the value without converting it into a percentage.
5. The plan requires basic reactions, but the current contract exposes only `canReact` and a free-form reaction command. Role 1 must publish the accepted reaction choices/limits or confirm a stable server-accepted catalogue before Phase 2 exits.

### Contract, command, and view gaps

#### UI-X05 — Role 1, required for Phase 1 exit

Publish a browser-safe authorised command dispatcher and local harness for the Twitch viewer, hosted board, chat-instruction state, and OBS overlay. It must supply canonical snapshots, mapped actor/identity context, fresh expected revisions, typed command results/errors, token-expiry controls, and reconnect behaviour. Role 5 will emit commands and render results; it will not authenticate, authorise, persist, subscribe, or refresh tokens.

#### UI-X06 — Role 3 through Role 1, required for Phase 2

Publish canonical examples and an unambiguous authoritative representation for:

- open voting with exactly three options;
- acknowledged vote, duplicate vote, and late vote;
- tie and zero-vote resolution without Role 5 calculating the outcome;
- winner/activation and interruption;
- automatic, manual, and unknown progress;
- succeeded, failed, cancelled, skipped, and expired results;
- session-scoped reward and hype effects.

`activeCandidateId`, tallies, timestamps, progress, and terminal results already cover much of the shape. Tie and zero-vote presentation still need an accepted server-owned state/example so the UI does not infer the resolution rule.

#### UI-X07 — Role 1, required for Phase 3

Publish a platform-neutral Twitch-chat presentation result containing aggregate availability and counted, rejected, duplicate, late, and unavailable acknowledgement states. Role 5 will display instructions and acknowledgement only; it will not listen to or parse chat.

#### UI-X08 — Role 1, required for Phase 3

Publish the hosted-room lookup/access result and anonymous/authenticated grant flow, including loading, invalid, expired, forbidden, unavailable, and recoverable states. `ViewerViewModel` begins after access and cannot represent these entry failures by itself.

#### UI-X10 — Role 1, required for Phase 2

Publish a session-scoped authorised private viewer receipt/read model and reconnect path for authenticated and anonymous viewers. The shared viewer snapshot is correctly sanitised and therefore cannot recover `acceptedCandidateId`, personal session points, or another private command result.

Role 5 recommends immediate typed command results for fast acknowledgement plus an authorised per-viewer fetch during initial load/reconnect. Shared realtime continues carrying sanitised tallies, quest state, and community hype. A private per-viewer realtime channel adds avoidable MVP permission, subscription, and cleanup complexity and should be selected only if Role 1 demonstrates that command response plus authorised fetch cannot meet the recovery requirement. Until UI-X10 is accepted, Role 5 will use immediate command-result fixtures and will not claim personal reconnect recovery.

#### Identity, recovery, reaction, and hype clarifications — Role 1

Confirm the presentation mapping for authenticated, anonymous, unauthenticated/expired, permission-denied, disconnected, and reconnecting clients. Confirm the bounded reaction catalogue and community-hype scale or label-only fallback. These may be browser-client/harness types rather than new canonical domain fields if Role 1 can supply them without weakening the shared contract.

### Route, Extension, hosted-board, and OBS harness gaps

Role 1 still needs to provide thin secure mounts for:

- the Twitch Extension Viewer Path;
- `/quest-board/[roomCode]`;
- the chat-fallback presentation placement;
- `/overlay` with a session-bound read grant;
- a local fixture-only gallery/harness with identity, command-result, stale-revision, token-expiry, disconnect, and reconnect controls.
- an authorised private viewer receipt/fetch path for initial load and reconnect, separate from the sanitised shared viewer topic.

The existing `/overlay` route mounts the legacy local-storage/`BroadcastChannel` component. It is not the accepted Role 5 overlay mount or realtime evidence. Role 5 will export a read-only overlay module from `@/viewer`; Role 1 remains responsible for replacing the route wiring and supplying authorised snapshots.

### Design-system handoff sufficient

No, not yet. `@/design-system` is currently an intentionally empty public entrypoint.

Role 4's minimum handoff will be sufficient when it exports semantic colour, type, spacing, radius, elevation, focus, and motion tokens plus accessible button, icon-button, card/panel, status badge, progress, notice, and visually-hidden primitives. It must also define Twitch-hosted theme behaviour, 44-pixel-or-larger targets, visible focus, contrast, and reduced-motion conventions. Role 5 will consume the public entrypoint and will not copy or edit Role 4 internals.

### Dependency requests and no-package fallback

No P0 runtime dependency is requested. Role 5 will prefer the existing React, React DOM, TypeScript, and Vitest stack to protect the Twitch Extension load budget.

Initial consumer tests can use schema parsing, pure view helpers, and React server rendering. Interactive mouse, touch, keyboard, focus, and reconnect evidence can run through Role 1's browser harness. If automated DOM interaction tests become necessary, Role 5 will submit a separate dev-only dependency request to Role 1 with an exact lock-compatible version and bundle-isolation evidence. No dependency or lockfile will be edited by Role 5.

### Performance, accessibility, and viewport risks

- Design for the compact 318-by-496-pixel panel target and fluid mobile portrait/landscape layouts without horizontal scrolling.
- Keep primary touch targets at least 44 pixels and the vote action reachable under long titles, translated copy, and browser zoom.
- Keep the initial Extension package within the current 1 MB mobile policy and target useful loading within three seconds on the stated constrained network. Avoid a new runtime dependency until Role 1 can measure the packaged asset.
- Avoid nested iframes, inline-script assumptions, and unapproved HTTPS/WSS endpoints; Role 1 owns CSP, allowlists, Extension Helper, and authentication wiring.
- Use stable focus, labelled controls, restrained live regions, contrast-safe non-colour status cues, and reduced-motion alternatives. Realtime tally changes must not steal focus or create repeated screen-reader noise.
- Keep the OBS overlay transparent, read-only, legible at 1280x720 and 1920x1080, inside safe areas, and understandable without personal identity, personal points, provider detail, or technical recovery text.
- Display remaining time from authoritative absolute timestamps only. The client may update presentation, but it must never close voting, expire a quest, select a winner, or emit a result because its local clock reached zero.

### Implementation risks and smallest recovery

| Risk | Owner | Required by | Smallest safe recovery |
| --- | --- | --- | --- |
| Role 4 design-system handoff is late | Role 4 | Phase 1 render exit | Continue prop/API and test-fixture work only; do not copy temporary visual tokens. Escalate before the Phase 1 exit. |
| UI-X05 dispatcher/harness is late | Role 1 | Phase 1 exit | Demonstrate render-only shells with injected fixture callbacks and label them fixture-only; do not claim interactive integration. |
| UI-X06 mechanics/examples are late | Role 3 through Role 1 | Phase 2 | Render only accepted states; show unknown/unavailable for unresolved states and do not derive tie, winner, expiry, progress, or reward rules. |
| Hosted access or chat acknowledgement is late | Role 1 | Phase 3 | Render explicit unavailable states; do not add direct database access, room authority, Twitch chat parsing, or fake acknowledgement. |
| UI-X10 private viewer recovery is late | Role 1 | Phase 2 | Use immediate command-result fixtures only; do not claim that accepted choice or personal points survive reconnect. |
| Twitch Local/Hosted Test is unavailable | Role 1 | Phase 4 | Preserve fixture and memory-backed evidence as diagnostics, report Twitch evidence as unverified, and escalate immediately for demo recovery. |
| Secure OBS mount is late | Role 1 | Phase 3/4 | Verify the Role 5 component against fixture `OverlayViewModel` states only and report the real Browser Source run as unverified. |
| Extension bundle exceeds the policy budget | Roles 1 and 5 | Phase 4 | Remove nonessential animation/assets and retain the primary vote/active/result path; do not weaken accessibility or authoritative-state handling. |

### Requested plan revision status after PR #27

| Original request | Current status |
| --- | --- |
| Split basic P0 engagement/reconnect from P1 polish | Resolved by R5-007A/R5-007B on main. |
| Record UI-X05 through UI-X10 owners, phases, and issues | Resolved in the shared delivery matrix and issues #21-#26. |
| Keep `@/core/testing` imports test/diagnostic-only and inject mounted fixtures | Resolved in the shared delivery matrix. |
| Publish tie and zero-vote representation/examples | Still pending Role 3 through Role 1 in UI-X06/#22. |
| Publish bounded reactions and an authoritative hype scale or label-only fallback | Still pending Role 3/Role 1 comparison; Role 5 must not invent either. |
| Accept the private viewer recovery approach | Still pending Role 1 in UI-X10/#26; F5-02 preserves Role 5's recommendation. |

## Role 5 implementation baseline after acceptance

Role 5 proposes these public render modules from `@/viewer`:

- `TwitchViewerPanel`
- `HostedQuestBoard`
- `TwitchChatVoteInstructions`
- `QuestOverlay`

Detailed prop names remain a Role 5 implementation decision, but the boundary will accept validated Role 1 view/access/transport state and typed dispatch callbacks. The overlay will expose no command callback. Role 5 will preserve server authority, retain the latest safe shared revision while reconnecting, recover private viewer state only through Role 1's accepted receipt path, reject older snapshots for presentation, avoid optimistic tallies, and derive only display time, labels, layout, focus, and local expanded/collapsed state.

The former Role 2 response gate is satisfied and, under D-071, is not a future permission gate. Viewer code stays inside `src/viewer/` and consumes shared visuals through `@/design-system`; any contributor may implement either module while preserving its public seam.

## Evidence classification

- **Actually inspected:** merged source contracts, public entrypoints, current Core fixtures, Role 5 plan/TODO, shared UI matrix, existing app/overlay wiring, and package scripts/dependencies.
- **Actually executed:** clean/in-sync Git checks, `git diff --check`, and the full repository `npm run check` pipeline recorded in the Role 5 change fragment.
- **Fixture-only:** current canonical idle viewer and overlay examples.
- **Not verified:** Role 5 rendering, browser interaction, Twitch Extension, hosted board, chat acknowledgement, multi-client realtime, and OBS Browser Source operation.
