# Role 1 To-Do: Integrations and Shared Platform

**Owner:** `Dewflash`

Update this file at the start and end of each Role 1 pass. Do not mark `DONE` without the listed evidence.

Execute these outcomes through `docs/build-plans/ROLE-1-BUILD-PLAN.md`; the plan defines phase order, owner decisions, deadlines, and pass-level evidence.

**Next:** finish R1-015 (browser-safe UI gateway/harness) and keep activating the team-owned Supabase Free preview. Continue coordinating open feasibility handoffs and keep ambiguous legacy moves deferred; AI/extraction, quest mechanics, and detailed UI implementation remain with their owners.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R1-001 | P0 | DONE | Merge the beginner-safe team foundation. | None | Root/role guides, playbook, GitHub templates, CODEOWNERS, TODOs, changelog workflow, checks, and pushed PR. |
| R1-012 | P0 | DONE | Publish and operationalise the concurrent Role 1-3 build plans. | R1-001; D-017 through D-029 | Three plans define phases, decision gates, deadlines, real-data rules, acceptance evidence, ownership, onboarding links, and required reviews; `npm run check` and `git diff --check` pass. |
| R1-013 | P0 | DONE | Publish the binding cross-role integration contract and close plan-level integration gaps. | R1-012; D-030 through D-036 | Orchestrator/seams, shared-file ownership, realtime semantics, contract ladder, risk spikes, tiered game support, and synchronised Role 4/5 plan requirements are authoritative; `npm run check` and `git diff --check` pass. |
| R1-002 | P0 | IN PROGRESS | Perform the one-time public-entry ownership migration. | R1-003 skeleton; open legacy mapping decisions | Public paths, compatibility tests, dependency enforcement, and a factual legacy inventory exist; ambiguous moves remain deferred until D1-01/D1-03 are settled. |
| R1-003 | P0 | DONE | Freeze version 1 contracts, public ports, orchestrator skeleton, and capability model. | R1-001; input from Roles 2-5 | Versioned schemas/ports, non-live fixtures, all-role consumer tests, and the candidate -> engine -> atomic commit -> validated view/broadcast fixture cycle pass, including duplicate, stale, concurrent, denial, and recovery cases. |
| R1-004 | P0 | IN PROGRESS | Create Supabase Free project and minimal revisioned schema/realtime channels. | R1-003; D-037 through D-041 | Committed migrations/RLS/env validation; profiles, sessions, quests, accepted participation, events/results, and sanitised snapshots use atomic revisions, reconnect recovery, server-only writes, and an in-memory fallback. Cloud/two-browser evidence is recorded separately from local execution. |
| R1-005 | P0 | IN PROGRESS | Connect Vercel deployment and safe environment variables. | R1-004 | Server-only deployment health route and local client-bundle secret scan are implemented; outstanding evidence still requires real Vercel preview deployment and configured environment values. |
| R1-006 | P0 | BLOCKED | Register Twitch app and Extension test version. | R1-011 | The viewer path now verifies Twitch Extension JWT signatures/expiry, maps token channels to active sessions, supports opaque and anonymous viewers, and ships a trusted-origin static upload client. Remaining: real developer-console registration evidence, test channel/allowlist, Local or Hosted Test runtime evidence, OAuth/EventSub/chat wiring, and recorded live proof. |
| R1-007 | P0 | IN PROGRESS | Run the early OBS capture spike, then define/test capture and Browser Source integration. | R1-003 provisional port | Browser-side OBS Virtual Camera `FrameSource` adapter and read-only Browser Source descriptor are fixture-tested; outstanding evidence still requires target browser permission, real OBS frame sampling, Role 2 consumption, and Browser Source overlay verification. |
| R1-008 | P0 | BLOCKED | Integrate Roles 2-5 after every wave and complete the golden workflow. | R1-003 through R1-007; role deliverables | Same authoritative revision reaches Studio, two viewers, persistence, and OBS; contract ladder plus failure/fallback runs pass. |
| R1-009 | P1 | READY | Maintain GitHub issues, decisions, changelog compilation, and integration notes. | Ongoing | Every merged PR has owner review, fragment, verification, and recorded cross-role outcomes. |
| R1-010 | P1 | BLOCKED | Assemble submission artifacts and invite Garena collaborator. | R1-008 and explicit project-owner product-readiness declaration | Required README/disclosures, deck, video, private repo access, and final checklist. Evidence collection may continue, but final narrative/deck/video assembly does not begin before that declaration. |
| R1-011 | P0 | READY | Create the Role 1-controlled Twitch account and enable 2FA for developer application and Extension registration. | None | Role 1 can access the Twitch developer console and begin app/Extension setup without committing credentials. |
| R1-014 | P0 | DONE | Make Role 4/5 planning beginner-safe and convert every missing UI dependency into persistent work. | PR #14; D-042/D-043 | PR #27 merged guided mode, adaptive design coaching, role-owned execution records, corrected P0/P1 tasks, feasibility issues #15/#16, UI-X issues #17-#26, owner notification, and green repository checks. Role 1 explicitly waived the pending reviewer requests before merge. |
| R1-015 | P0 | IN PROGRESS | Implement the browser-safe UI gateway, authorised command client, local multi-surface harness, and shared UI verification stack. | R1-003; UI-X01/UI-X02/UI-X05 | The Twitch viewer now mounts Role 5's canonical surface over signed EBS reads/commands; local Studio staging opens a diagnostic Role 3 voting cycle only after a verified Twitch channel arrives. Signed-token integration tests cover refresh, duplicate, concurrent revision recovery, anonymous identity, and wrong-channel denial. A real Local Test and streamer-side canonical gateway remain before completion. |
| R1-016 | P0 | IN PROGRESS | Implement private per-viewer recovery plus hosted-board discovery, Twitch-chat delivery, and authorised viewer reaction seams. | R1-003/R1-004; UI-X07/UI-X08/UI-X10; D1-06D/D1-06E | Twitch Extension viewers now recover only their own accepted vote through a pseudonymous session-scoped key, with tallies omitted before personal acknowledgement and shared snapshots still sanitised. Hosted-board/chat live delivery, reaction command routing, and persisted viewer rewards remain open. |
| R1-017 | P0 | DONE | Establish the evidence manifest and real-test resource matrix for every role. | R1-014 / PR #27 merge | PR #32 merged the versioned manifest/schema, privacy and evidence-class validator, validator tests, PR/agent workflow hooks, and assigned broadcaster/two-viewer/OBS/desktop/mobile/recording resources. `docs/evidence/manifest.json` records the R1-017 validation entry, and `npm run check:evidence` plus `npm run test:evidence` pass. |
| R1-018 | P0 | IN PROGRESS | Gather problem-solution-fit, originality, usability, and expected-impact evidence while the build proceeds. | None | At least two relevant conversations or one streamer plus viewer observations, a truthful alternatives comparison, measurable hypotheses, and recorded product changes/limitations support the deck. |
| R1-019 | P0 | BLOCKED | Execute exact submission operations and freeze the immutable package. | R1-008/R1-010 | Team-named Drive folder contains all three deliverables and repository link; access is tested; email is sent to the brief's recipient; post-submission mutation is prohibited and recorded. |
| R1-020 | P0 | DONE | Implement accepted quest runtime seams for #36, #37, #38, recovered #48 scheduler, and #50 progress commands. | D-044 through D-047; accepted #50 command decision | Canonical tick/progress/emergency-clear commands, durable emergency latch, intervention-before-generation coordinator, vote-close scheduler, memory/Supabase due-cycle readers, migration, focused tests, and `npm run check` pass. |

## Current R1-018 evidence

- `codex/role-1-demo-runbook` adds `docs/evidence/GOLDEN_REHEARSAL_RUNBOOK.md`, a privacy-safe rehearsal path for memory-backed and real Twitch/OBS runs.
- `npm run check:demo-runbook` verifies the runbook keeps the required evidence resources, phases, fixture-vs-live warning, unknown-handling rule, authoritative revision gate, and secret/link guardrails.

## Current R1-010/R1-018 disclosure evidence

- `codex/role-1-third-party-disclosures` adds `docs/THIRD_PARTY_DISCLOSURES.md` and links it from the README.
- `tests/integration/disclosures.test.ts` checks the disclosure covers all current runtime/dev package dependencies and preserves explicit Twitch/OBS/cloud/provider/evidence limitations.

## Current R1-016 private viewer recovery pass

- `codex/role-1-viewer-recovery` adds the UI-X10 server-side `ViewerRecoveryReader` seam for session-scoped accepted-vote reconnect.
- Memory and Supabase readers return only the requesting viewer's accepted candidate/source/time plus `sessionPoints: 0` until the reward read model is persisted.
- Hosted-board discovery (UI-X08) and Twitch-chat delivery/acknowledgement (UI-X07) remain open under R1-016 after this pass.

## Finals Twitch viewer owner override (14 August 2026)

- The project owner explicitly authorised Role 1 to apply the D-015 integration override for the demo-critical viewer failure, mount the existing Role 5 public surface, make minimum Role 5-adjacent integration fixes, and proceed without Role 5 review for this pass.
- This pass keeps visual/interaction decisions inside the existing `@/viewer` module. Role 1 changes the thin app mount, Twitch JWT/EBS boundary, channel/session directory, canonical command composition, local diagnostic staging, upload client, tests, and setup documentation.
- The review waiver is limited to this urgent finals pass; it does not transfer ongoing Role 5 component authority or permit unrelated viewer redesign.

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

## Current Role 4 setup/session command pass

- `codex/role-1-setup-session-current` adds the broadcaster-only `streamer.setup` and `streamer.session` contracts for Studio setup controls.
- Setup action validation is service-specific, so Twitch-only actions cannot validate against OBS, realtime, intelligence, or session controls.
- The diagnostic UI gateway now publishes fixture-only setup/session command examples for Role 4 without claiming real Twitch, OBS, or deployment setup.

## Current UI-X06 quest-state fixture pass

- `codex/role-1-ui-x06-fixtures-current` adds canonical fixture quest states and matching role views for Role 4/5 rendering.
- The fixture catalog covers proposed, voting zero-vote, voting tie, active manual/automatic progress, terminal result/reward states, and cooldown.
- The zero-vote fixture keeps `acceptedCandidateId: null`; private viewer receipts are never fabricated from public tallies.

## Current session history read-model pass

- `codex/role-1-session-history-current` adds privacy-safe session history snapshots for terminal quest outcomes and aggregate engagement.
- Memory and Supabase readers derive history from accepted command receipts; they exclude raw chat, viewer identifiers, and private vote receipts.
- Mixed/non-live receipt evidence downgrades the snapshot to `diagnostic` rather than claiming live history.

## Decisions Role 1 still owns

- Shared contract acceptance and breaking changes
- Supabase schema/realtime boundaries and Vercel deployment
- Twitch/OBS integration scope
- UI client/harness/test-stack choices, per-viewer recovery, hosted discovery, and chat delivery policy
- Integration overrides and cross-role disputes
- Submission operations and any later changes to the accepted participation-rate KPI, owner-called freeze authority, or deferred demo-narrative scope

## Pre-submission future-roadmap considerations

Role 1 should consider these five Garena-relevant future application cases before final submission and deck freeze. These are roadmap/pitch-positioning considerations, not accepted MVP scope or implemented non-Twitch platform support.

1. **Creator Program / Streamer Missions:** position ChatXPT as a live layer for safer, measurable creator missions with vote participation, completion, hype, and reaction metrics.
2. **Free Fire Esports / Co-Stream Engagement:** frame official esports usage as spectator/caster prompts and watch-party engagement, not instructions that interfere with competitive players.
3. **Live Campaign Activations:** explore campaign templates for event themes, approved language, restrictions, and non-monetary reward labels.
4. **Community Events / Offline Activations:** use hosted-board/room-code participation and OBS/projector output as a low-setup event mode.
5. **Safe Community Participation:** highlight deterministic safety, streamer controls, no gambling, no harmful dares, no harassment, and privacy-safe session rewards.

Required slide implication: the final deck must include a future roadmap section stating that ChatXPT can later adapt to esports watch parties, campaign activations, and community events after the Twitch MVP proves the core loop.

## Finals demo migration consideration

Role 1 should follow `docs/submission/FINALS_DEMO_MIGRATION_PLAN.md` before deck/video freeze: make the canonical architecture the official finals story, promote canonical surfaces only after they prove demo parity, and keep the current working local OBS/prototype path rehearsed as a labelled fallback until the live route is chosen.

## Executive-decision TODO: OBS game-state upgrade

This is understood as a revamp and upgrade of the existing OBS/gameplay-intelligence path, not a requirement to throw away the working local OBS demo before finals. The project owner will make the executive decision later on timing and scope.

Primary ownership/context:

- The core implementation belongs to the game data analysis segment: Role 2 extraction/intelligence should own OBS frame interpretation, genre state packs, calibrated adapters, OCR experiments, confidence thresholds, and unknown handling behind the accepted Role 1 frame/source contract.
- Role 1 is involved only where the upgrade changes shared contracts, capability fields, evidence requirements, route wiring, or final submission positioning.
- Role 3 is involved only when new game facts become quest dependencies that affect validation, feasibility, completion, rewards, or safety.
- Role 4/5 are involved only when the streamer, viewer, or overlay surfaces need to display game capability status, selected-game packs, unsupported facts, or fallback/unknown states.
- If this remains a finals slide/roadmap point, it does not require immediate cross-role implementation.

Current understanding:

- Game states differ widely by genre. A racing game has laps, sectors, and position; a MOBA has objectives, lanes, and cooldowns; a shooter has health, ammo, round, and site state; Brawl Stars has mode-specific objective states.
- The legacy mounted demo uses fixed fields in `src/lib/domain.ts`: `game`, `phase`, `health`, `squadStatus`, and `recentEvent`. This remains useful for the current demo but is battle-royale/action-game shaped and does not fit every game cleanly.
- The canonical model in `src/core/contracts/signals.ts` is the better long-term architecture: `GameplaySnapshot`, capabilities, named signals, confidence, provenance, and `known`/`unknown`/`stale`/`unavailable` observations.
- The accepted direction is universal signals first, game-specific fields only when a game adapter proves them.

Built now:

- Generic frame/pixel analysis.
- Broad activity classification.
- Game category selection in the legacy control room.
- Game name/category affecting quest wording.
- Canonical support for game capability tiers.
- Selective OCR plumbing.

Not fully built or proven:

- A real live calibrated adapter that can reliably emit facts such as a Brawl Stars timer or Free Fire health value.
- A full per-genre game-state registry.
- A polished UI for choosing game-specific capability packs.

Recommended upgrade path after the owner decides:

1. Create a game capability registry for games such as `brawl-stars`, `free-fire`, `valorant`, `mario-kart`, and `custom`, where each entry declares supported universal signals, optional HUD regions, supported facts, unsupported facts, and confidence requirements.
2. Add genre state packs for arena action, battle royale, tactical shooter, MOBA, racing, strategy, and platformer.
3. Separate quest context from raw game facts by converting observations into quest-useful states such as `high-pressure`, `downtime`, `transition`, `objective-window`, `recovery-needed`, `audience-hype`, and `audience-boredom`.
4. Keep specific HUD facts optional. Facts such as `health`, `timer`, `score`, `ammo`, and `objective-progress` may be used only when the selected adapter supports them with evidence.
5. Add or preserve a slide section explaining: “Why OBS scanning: game-neutral first, calibrated later.”

Recommended slide wording:

> “The MVP does not pretend to understand every HUD. It reads broad gameplay rhythm generically through OBS, then uses streamer-selected game/category settings to shape safer quests. Future calibrated adapters can add reliable game-specific facts where evidence supports them.”
