# Role 1 To-Do: Integrations and Shared Platform

**Owner:** `Dewflash`

Update this file at the start and end of each Role 1 pass. Do not mark `DONE` without the listed evidence.

Execute these outcomes through `docs/build-plans/ROLE-1-BUILD-PLAN.md`; the plan defines phase order, owner decisions, deadlines, and pass-level evidence.

**Next:** finish R1-026 source verification and continue the remaining viewer/OBS payoff work. R3-009 through R3-013 are merged, and `codex/minecraft-schema-decisions` now source-wires cue conversion, accepted-live-gameplay eligible-cycle proposal requests, public OBS `Up next`, and accepted-gameplay Live Director context refreshes through the shared server runtime. Final tests, real Twitch/OBS/Supabase evidence, and owner acceptance remain open.

**Most recently completed pass:** `role-1/live-director-03-streamer-delivery` mounts private source-separated Live Director controls in Studio, Twitch Live Config, and a Studio-authorised browser pop-out/OBS Custom Dock route. Role 1 now authenticates and commits Role 3 cue actions through a dedicated public port; Role 3's exactly-three conversion is merged and its runtime publication/delivery wiring is the R1-026/R3-014 follow-up.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R1-001 | P0 | DONE | Merge the beginner-safe team foundation. | None | Root/role guides, playbook, GitHub templates, CODEOWNERS, TODOs, changelog workflow, checks, and pushed PR. |
| R1-012 | P0 | DONE | Publish and operationalise the concurrent Role 1-3 build plans. | R1-001; D-017 through D-029 | Three plans define phases, decision gates, deadlines, real-data rules, acceptance evidence, responsibility, onboarding links, and review requests; `npm run check` and `git diff --check` pass. |
| R1-013 | P0 | DONE | Publish the binding cross-role integration contract and close plan-level integration gaps. | R1-012; D-030 through D-036 | Orchestrator/seams, shared-file responsibility, realtime semantics, contract ladder, risk spikes, tiered game support, and synchronised Role 4/5 plan requirements are authoritative; `npm run check` and `git diff --check` pass. |
| R1-002 | P0 | IN PROGRESS | Perform the one-time public-entry responsibility migration. | R1-003 skeleton; open legacy mapping decisions | Public paths, compatibility tests, dependency enforcement, and a factual legacy inventory exist; ambiguous moves remain deferred until D1-01/D1-03 are settled. Any contributor may perform the accepted moves. |
| R1-003 | P0 | DONE | Freeze version 1 contracts, public ports, orchestrator skeleton, and capability model. | R1-001; input from Roles 2-5 | Versioned schemas/ports, non-live fixtures, all-role consumer tests, and the candidate -> engine -> atomic commit -> validated view/broadcast fixture cycle pass, including duplicate, stale, concurrent, denial, and recovery cases. |
| R1-004 | P0 | IN PROGRESS | Create Supabase Free project and minimal revisioned schema/realtime channels. | R1-003; D-037 through D-041 | Committed migrations/RLS/env validation; profiles, sessions, quests, accepted participation, events/results, and sanitised snapshots use atomic revisions, reconnect recovery, server-only writes, and an in-memory fallback. Cloud/two-browser evidence is recorded separately from local execution. |
| R1-005 | P0 | IN PROGRESS | Connect Vercel deployment and safe environment variables. | R1-004 | Server-only deployment health route and local client-bundle secret scan are implemented; outstanding evidence still requires real Vercel preview deployment and configured environment values. |
| R1-006 | P0 | IN PROGRESS | Register Twitch app and Extension test version. | R1-011 | The Twitch developer application `ChatXPT Local Test` and `ChatXPT Sidequests` Extension version `0.0.1` were registered on 22 August 2026. The Extension is in Local Test with `viewer.html`, `config.html`, and `live-config.html` mapped to the HTTPS local server; its client ID and signing secret remain only in ignored local configuration. A real Twitch stream proved OAuth, `stream.online`, signed chat aggregation, and `stream.offline`. Installing the panel on the test channel, Twitch-issued Extension JWT delivery, real in-panel voting, mobile privacy-policy configuration, and Hosted Test remain open. |
| R1-007 | P0 | IN PROGRESS | Run the early OBS capture spike, then define/test capture and Browser Source integration. | R1-003 provisional port | Studio now opens session-bound Gameplay Capture at `/studio/gameplay/capture` and generates a secure read-only `/obs-overlay` descriptor. On 22 August 2026, real OBS Virtual Camera output carrying team-owned Minecraft crossed authenticated gameplay ingress into an authoritative Twitch-mapped Studio session and produced exactly three deterministic fallback quests while unsupported calibrated facts stayed unknown. Capture refreshes short-lived grants, remembers only session-local browser metadata, and does not persist frames. Overlay tokens stay in the URL fragment; the local overlay setup key was rotated after rehearsal. Device reconnect recovery and a recorded OBS Browser Source run remain open. |
| R1-008 | P0 | BLOCKED | Integrate Roles 2-5 after every wave and complete the golden workflow. | R1-003 through R1-007; role deliverables | Same authoritative revision reaches Studio, two viewers, persistence, and OBS; contract ladder plus failure/fallback runs pass. |
| R1-009 | P1 | IN PROGRESS | Maintain GitHub issues, decisions, changelog compilation, integration notes, and repository hygiene. | Ongoing | Every merged or directly landed integration has requested responsibility-lead context where useful, overlap/deconfliction evidence, fragment, verification, and recorded cross-role outcomes. The normal repository gate rejects tracked local/build artifacts, broken local Markdown links, and stale merged verification claims. Role 1 assists but is not the exclusive reviewer or merger under D-076. |
| R1-010 | P1 | BLOCKED | Assemble submission artifacts and invite Garena collaborator. | R1-008 and explicit project-owner product-readiness declaration | Required README/disclosures, deck, video, private repo access, and final checklist. Evidence collection may continue, but final narrative/deck/video assembly does not begin before that declaration. |
| R1-011 | P0 | DONE | Create the Role 1-controlled Twitch account and enable 2FA for developer application and Extension registration. | None | The existing team Twitch account has 2FA enabled, Role 1 can access the developer console, and `ChatXPT Local Test` registration succeeded without committing credentials. |
| R1-014 | P0 | DONE | Make Role 4/5 planning beginner-safe and convert every missing UI dependency into persistent work. | PR #14; D-042/D-043 | PR #27 merged guided mode, adaptive design coaching, role-owned execution records, corrected P0/P1 tasks, feasibility issues #15/#16, UI-X issues #17-#26, owner notification, and green repository checks. Role 1 explicitly waived the pending reviewer requests before merge. |
| R1-015 | P0 | IN PROGRESS | Implement the browser-safe UI gateway, authorised command client, local multi-surface harness, and shared UI verification stack. | R1-003; UI-X01/UI-X02/UI-X05 | The Twitch viewer now mounts Role 5's canonical surface over signed EBS reads/commands; local Studio staging opens a diagnostic Role 3 voting cycle only after a verified Twitch channel arrives. Signed-token integration tests cover refresh, duplicate, concurrent revision recovery, anonymous identity, and wrong-channel denial. A real Local Test and streamer-side canonical gateway remain before completion. |
| R1-016 | P0 | IN PROGRESS | Implement private per-viewer recovery plus hosted-board discovery, Twitch-chat delivery, and authorised viewer reaction seams. | R1-003/R1-004; UI-X07/UI-X08/UI-X10; D1-06D/D1-06E | Twitch and hosted viewers recover only their own accepted vote and non-zero session points through pseudonymous session-scoped keys; hosted room links, signed EventSub chat votes, reactions, and reward awards use the same idempotent authority. Private Supabase push grants are wired with authorised recovery reads. Outbound chat announcements and real Supabase/Twitch multi-client evidence remain open. |
| R1-017 | P0 | DONE | Establish the evidence manifest and real-test resource matrix for every role. | R1-014 / PR #27 merge | PR #32 merged the versioned manifest/schema, privacy and evidence-class validator, validator tests, PR/agent workflow hooks, and assigned broadcaster/two-viewer/OBS/desktop/mobile/recording resources. `docs/evidence/manifest.json` records the R1-017 validation entry, and `npm run check:evidence` plus `npm run test:evidence` pass. |
| R1-018 | P0 | IN PROGRESS | Gather problem-solution-fit, originality, usability, and expected-impact evidence while the build proceeds. | None | At least two relevant conversations or one streamer plus viewer observations, a truthful alternatives comparison, measurable hypotheses, and recorded product changes/limitations support the deck. |
| R1-019 | P0 | BLOCKED | Execute exact submission operations and freeze the immutable package. | R1-008/R1-010 | Team-named Drive folder contains all three deliverables and repository link; access is tested; email is sent to the brief's recipient; post-submission mutation is prohibited and recorded. |
| R1-020 | P0 | DONE | Implement accepted quest runtime seams for #36, #37, #38, recovered #48 scheduler, and #50 progress commands. | D-044 through D-047; accepted #50 command decision | Canonical tick/progress/emergency-clear commands, durable emergency latch, intervention-before-generation coordinator, vote-close scheduler, memory/Supabase due-cycle readers, migration, focused tests, and `npm run check` pass. |
| R1-021 | P0 | IN PROGRESS | Mount authenticated normalised gameplay snapshots into the shared server runtime without per-frame revision churn. | R1-003/R1-004/R1-007; Role 2 extraction public output | Studio authorises short-lived session capture grants without exposing signing keys; memory/Supabase keep one monotonic snapshot per active session; ingestion rejects stale or cross-session/cycle/revision/evidence input; `/studio/gameplay/capture` submits only normalised facts and refreshes authority while running; and the sole orchestrator hydrates matching gameplay with explicit Capture Health. Automated repository checks pass; real browser/OBS evidence remains before final handoff. |
| R1-022 | P0 | DONE | Validate and scope the proposed Live Director expansion, then activate only the retained passes in its implementation plan. | P-015; D-074; research report and evidence matrix | D-075 accepts the narrow P0 loop, two bounded P1 experiments, explicit deferrals/rejections, and the five-pass Role 1 / five-pass Role 3 split. The active plan, queues, Role 3 brief, project queue, and coordination record preserve the unproven-solution-fit boundary. |
| R1-023 | P0 | DONE | `LD-R1-01`: define the canonical Live Director authority, privacy, command, expiry, and three-projection spine. | R1-003; D-075; current contracts | Commit `49383cc` publishes versioned contracts plus known/unknown/stale/conflicting/privacy-denied fixtures; Core/role-consumer/orchestrator tests prove one revision, permission classes, cue expiry, duplicate/stale failure, approved viewer context, and structural absence of private cue/pointer/provider/personal state from viewer and OBS projections. Evidence: `E-20260819-R1-001`. |
| R1-024 | P0 | DONE | `LD-R1-02`: compose declared intent, privacy-safe Chat Pointer aggregates, and source-separated private Live Context. | R1-023; Role 3 R3-009 input shape | Commit `90726e6` plus evidence `E-20260819-R1-002` cover known/unknown/stale/conflict/ambiguity/sparse/single-viewer/spam/deleted-chat/reconnect/permission cases; only privacy-safe aggregates reach authoritative state, ephemeral participant/message keys do not persist, and no audience or streamer intent is fabricated. |
| R1-025 | P0 | DONE | `LD-R1-03`: deliver Session Goal, Live Context, cue actions, existing recommended quests, and private pop-out/OBS Dock through Studio/Live Config. | R1-023/R1-024; Role 3 R3-010 actions | Commit `b71c1ae` adds the authenticated lifecycle port, private routes, source-separated UI, cue controls, dock guide, server/consumer tests, and exact 420/1440 px fixture renders in `E-20260819-R1-003`; stale, permission, loading, offline, reconnect, privacy, and no-overflow boundaries pass without claiming real Twitch/OBS execution. |
| R1-026 | P0 | IN PROGRESS | `LD-R1-04`: preserve Extension Vote/Active/Result and compressed OBS payoff, with minimal Catch-up isolated as a P1 experiment. | R1-023; Role 3 lifecycle/conversion passes | Source wiring now keeps personal receipt/recovery private, preserves hosted/chat fallback paths, routes `turn-into-vote`, accepted-live-gameplay eligible-cycle proposals, accepted-gameplay Live Director context refreshes, and public OBS `Up next` through the shared runtime/projection boundaries without adding OBS private cue/context fields. Final responsive/accessibility/reconnect/terminal fixtures, viewer/OBS payoff proof, and real evidence remain owner-run before `DONE`. |
| R1-027 | P0 | READY | `LD-R1-05`: add the P1 intervention-specific Session Brief and run golden integration plus comparative value evaluation. | R1-023 through R1-026; Role 3 R3-009 through R3-013 | Same revision reaches Studio/Live Config, two viewers, persistence, and OBS across real Minecraft/Twitch/OBS and failure/fallback cases; brief remains aggregate/non-causal; full checks and evidence manifest pass; failed hypotheses are recorded. |

## Current R1-018 evidence

- `codex/role-1-demo-runbook` adds `docs/evidence/GOLDEN_REHEARSAL_RUNBOOK.md`, a privacy-safe rehearsal path for memory-backed and real Twitch/OBS runs.
- `npm run check:demo-runbook` verifies the runbook keeps the required evidence resources, phases, fixture-vs-live warning, unknown-handling rule, authoritative revision gate, and secret/link guardrails.

## Current R1-009 repository consistency evidence

- The normal repository gate now checks tracked artifact hygiene, relative Markdown targets, and stale merged verification claims; the canonical memory-backed runtime smoke has a documented `npm run smoke` entry point.
- PRs #139 and #141 were closed after Git ancestry proved both head branches were already contained in current `main`; PR #144 was closed because its D-060/D-061 decisions are already authoritative on `main`. Their remote branches and history were preserved.
- PR #156 remains a clean, green draft. PR #149 remains open because it contains material Role 2 work, but a clean-clone dry-run merge found 14 conflicts across Role 2 plans, AI/provider code, and multi-game extraction. Rebuild or deliberate reconciliation on current `main` is safer than merging it as-is.

## Current R1-023 Live Director authority evidence

- `49383cc` adds the additive canonical intent, pointer, source-separated Live Context, cue, public-context, intervention-record, command, and projection schemas without changing the `1.0.0` compatibility boundary for existing clients.
- Fixture producer/consumer and orchestrator tests cover known, unknown, stale, conflicting, privacy-denied, permission, expiry, duplicate, stale-revision, and three-projection privacy cases.
- Viewer output contains only the approved public-context object; OBS retains only its existing public quest projection and rejects any Live Director field. The default quest engine rejects the new commands until Role 3's cue lifecycle lands.
- Evidence entry `E-20260819-R1-001` is fixture-only. Real Twitch, OBS, Supabase Cloud, provider, and solution-fit evidence remains unproven.

## Current R1-024 Live Director context evidence

- `90726e6` adds authoritative declared-intent application, an ephemeral Role 2-to-Role 1 `AudiencePointerAggregate` seam, privacy-safe aggregate composition, and source-separated private Live Context without entering the Role 3 quest engine.
- Focused tests cover duplicate/spam deduplication, deleted evidence, single-viewer non-consensus, conflicting/ambiguous/permission-denied and stale pointers, expired intent, future gameplay observations, command permission, one-revision projection, and reconnect recovery.
- Ephemeral participant keys and message fingerprints are process-local deduplication inputs only. They are absent from persisted authoritative state, command receipts, ViewerViewModel, and OverlayViewModel; no raw chat text field exists in the aggregate contract.
- Evidence entry `E-20260819-R1-002` is fixture-only with memory-repository recovery. It does not prove real Twitch chat, the Role 2 real producer, Supabase Cloud, OBS, Role 3 cue lifecycle, or product value.

## Current R1-025 Live Director streamer-delivery evidence

- `b71c1ae` routes broadcaster/moderator cue actions through Role 1's authenticated, deduplicated, revisioned application boundary and Role 3's public pure lifecycle; the general quest engine is no longer asked to interpret cue actions.
- Studio and compact Live Config render Session Goal, Current Objective, `Streamer says`, `ChatXPT detects`, `Chat suggests`, privacy-safe audience counts, explicit unknown/stale/permission states, and only the cue actions supplied by authority. Existing exactly-three quest review remains unchanged.
- `/studio/live-director` reuses the HttpOnly Studio grant for a private browser pop-out or OBS Custom Dock and fails closed without broadcaster authority. It is separate from the read-only public `/obs-overlay`; setup and limitations are in `docs/integrations/LIVE_DIRECTOR_PRIVATE_DOCK.md`.
- Evidence `E-20260819-R1-003` records exact 420 px and 1440 px fixture renders with zero horizontal offenders. No Twitch-issued JWT, real OBS dock/source, Supabase Cloud, real gameplay, provider, accessibility-device, engagement, or solution-fit claim is made.

## Current R1-010/R1-018 disclosure evidence

- `codex/role-1-third-party-disclosures` adds `docs/THIRD_PARTY_DISCLOSURES.md` and links it from the README.
- `tests/integration/disclosures.test.ts` checks the disclosure covers all current runtime/dev package dependencies and preserves explicit Twitch/OBS/cloud/provider/evidence limitations.

## Current R1-016 private viewer recovery pass

- `codex/role-1-viewer-recovery` adds the UI-X10 server-side `ViewerRecoveryReader` seam for session-scoped accepted-vote reconnect.
- Memory and Supabase readers return only the requesting viewer's accepted candidate/source/time plus their persisted non-zero session points; community hype remains shared aggregate state.
- Hosted-board discovery, signed Twitch-chat voting, ordinary-chat aggregate analysis, and authorised reactions/rewards are source-wired. Outbound chat announcements and real Twitch/Supabase multi-client delivery evidence remain open under R1-016.

## Historical finals Twitch viewer override (14 August 2026; superseded by D-071)

- The project owner explicitly authorised Role 1 to apply the D-015 integration override for the demo-critical viewer failure, mount the existing Role 5 public surface, make minimum Role 5-adjacent integration fixes, and proceed without Role 5 review for this pass.
- This pass keeps visual/interaction decisions inside the existing `@/viewer` module. Role 1 changes the thin app mount, Twitch JWT/EBS boundary, channel/session directory, canonical command composition, local diagnostic staging, upload client, tests, and setup documentation.
- This was the rule at the time. D-071 now allows cross-role contribution without an override while retaining Role 5 as the viewer-experience responsibility lead.

## Current R1-016 hosted-board access pass

- `codex/role-1-hosted-access` adds the UI-X08 server-side `HostedBoardAccessService` for room-code lookup, viewer access grants, direct path/share data, and typed invalid/not-found/inactive/unavailable states.
- Memory and Supabase adapters expose a hosted-board session directory backed by the existing session room-code records.
- `codex/role-1-hosted-board-access` adds the thin `/quest-board/[roomCode]` route shell over the accepted hosted-board access service, including the direct viewer path and QR payload display.
- Twitch-chat delivery/acknowledgement (UI-X07) and real multi-client hosted-board evidence remain open under R1-016 after this pass.

## Current R1-016 chat fallback policy pass

- `codex/role-1-chat-fallback-policy` adds the UI-X07 chat fallback formatting and receipt-policy seam for poll-open, final-result, and counted/duplicate/rejected/late/unavailable presentation.
- The seam maps authoritative visible options to `1`/`2`/`3` only when exactly three options are in the voting state.
- Real Twitch outbound sending, rate-limit handling, and live acknowledgement evidence remain open after this template/policy pass.

## Current R1-016 Twitch chat vote adapter pass

- `codex/role-1-twitch-chat-vote-adapter` adds the Role 1-owned strict `1`/`2`/`3` Twitch chat parser for fallback votes.
- Exact numeric chat messages emit canonical `viewer.vote` commands with `sourceMode: "twitch-chat"` and deterministic duplicate-delivery command IDs.
- Ordinary chat remains a raw-24h-max audience event, while chat-vote events retain only aggregate choice data.
- Bounded poll-open, final-result, and acknowledgement templates exist for future outbound Twitch chat delivery.
- Real Twitch inbound chat connection, outbound delivery, rate-limit handling, and live counted acknowledgement evidence remain open.

## Current Role 4 profile settings command pass

- `codex/role-1-profile-settings-current` adds the broadcaster-only `streamer.profile-settings` command for Studio-owned streamer preferences.
- Role 1 persists the profile revision, stamps the unchanged quest-cycle revision for broadcast consistency, and publishes updated role views without invoking Role 3.
- Empty nested patches such as `voting: {}` and `rewards: {}` are rejected so UI no-ops cannot create false revision history.
- `codex/minecraft-schema-decisions` now adds the broadcaster-only `streamer.session-override` command and optional streamer projection for current-stream intensity/creativity overrides; preset-aware propagation and final tests remain open.

## Current Role 4 setup/session command pass

- `codex/role-1-setup-session-current` adds the broadcaster-only `streamer.setup` and `streamer.session` contracts for Studio setup controls.
- Setup action validation is service-specific, so Twitch-only actions cannot validate against OBS, realtime, intelligence, or session controls.
- The diagnostic UI gateway now publishes fixture-only setup/session command examples for Role 4 without claiming real Twitch, OBS, or deployment setup.
- Current ICP-02 source keeps setup/bootstrap sessions in `preparing`, rejects explicit Start while blocking readiness facts remain, and starts only through `SessionLifecycleService.start` after current Gameplay Capture/Twitch readiness passes. The updated focused expectations are pending owner-run tests.

## Current integrated finals implementation pass

- `codex/studio-final-integration` makes `/studio` the canonical entry and
  retains the legacy Control Room at `/diagnostics/control-room`.
- Twitch uses a state-bound OAuth authorization-code flow, server-side token
  validation, channel-game import, and EventSub chat subscription request. The
  signed Studio cookie records verified Twitch authority; the manual form is a
  collapsed diagnostic fallback.
- Studio-authorised Gameplay Capture and OBS setup no longer ask the streamer
  to enter server-only keys. Gameplay and aggregate audience snapshots publish
  through canonical commands, and normal client reads are push-first through
  private Supabase topics with authorised HTTP reconciliation as recovery.
- Viewer rewards are session-scoped and private, shared hype remains shared,
  ordinary chat is aggregated without raw message or Twitch identity retention,
  and the owner-deferred post-stream analytics/history UI is not claimed.
- The full source gate passes 95 test files/753 tests plus production build and
  client-secret scan. Production-browser checks cover all seven pages, recovery,
  key-free OBS setup, equal Game Capture metrics, and mobile/desktop overflow.
  Built-server Twitch Config preflights pass for the exact hosted/Local Test
  origins and reject an untrusted origin. Real Twitch, OBS Virtual Camera,
  Supabase Cloud, provider, two-viewer, and overlay proof remains owner-run.

## Current UI-X06 quest-state fixture pass

- `codex/role-1-ui-x06-fixtures-current` adds canonical fixture quest states and matching role views for Role 4/5 rendering.
- The fixture catalog covers proposed, voting zero-vote, voting tie, active manual/automatic progress, terminal result/reward states, and cooldown.
- The zero-vote fixture keeps `acceptedCandidateId: null`; private viewer receipts are never fabricated from public tallies.

## Current session history read-model pass

- `codex/role-1-session-history-current` adds privacy-safe session history snapshots for terminal quest outcomes and aggregate engagement.
- Memory and Supabase readers derive history from accepted command receipts; they exclude raw chat, viewer identifiers, and private vote receipts.
- Mixed/non-live receipt evidence downgrades the snapshot to `diagnostic` rather than claiming live history.

## Current architecture and codebase guide pass

- `role-1/architecture-codebase-guide` adds `docs/CODEBASE_GUIDE.md`, a source-grounded explanation of the canonical architecture, the retained mounted prototype, end-to-end runtime flow, routes, ownership boundaries, and each major implementation file.
- The guide records only source-inspection evidence. It does not upgrade fixture tests, static SQL, or local compatibility paths into real Twitch, OBS, Supabase Cloud, or Vercel runtime claims.
- `README.md` and `docs/ARCHITECTURE.md` link to the implementation guide so contributors can move from the product overview to the detailed code map.

## Decisions Role 1 still settles or maintains

- Shared contract acceptance and breaking changes
- Supabase schema/realtime boundaries and Vercel deployment
- Twitch/OBS integration scope
- UI client/harness/test-stack choices, per-viewer recovery, hosted discovery, and chat delivery policy
- Cross-role deconfliction, semantic disputes, and integration order
- Submission operations and any later changes to the accepted participation-rate KPI, owner-called freeze authority, or deferred demo-narrative scope
