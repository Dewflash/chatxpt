# ChatXPT Agent Guide

## Mission

Build ChatXPT as a cross-platform AI stream director that turns gameplay state, audience sentiment, and streamer preferences into safe sidequests that viewers choose in real time.

## Current product direction

- ChatXPT does not host livestream video. Twitch, YouTube, Discord, and future platforms remain the viewing surfaces.
- Build a platform-neutral ChatXPT Core surrounded by input and output adapters.
- Twitch is the only supported platform in the current build: Twitch inputs, a Twitch Extension for viewers, and an OBS browser overlay for broadcast graphics.
- ChatXPT Studio is the streamer-facing setup and control experience.
- ChatXPT Studio is the primary full management surface. It owns Twitch connection and installation guidance, persistent streamer profiles, challenge preferences, safety limits, game settings, voting/reward settings, integration health, testing, history, and advanced session controls.
- The Twitch Extension Live Config page embeds a smaller ChatXPT live-control surface inside the Twitch Creator Dashboard. It is for stream-time status, proposed-quest review, approve/reject, skip/cancel/result controls, quick intensity changes, vote visibility, and emergency pause.
- The viewer-facing Twitch Extension is the primary voting and participation surface. The MVP also includes a hosted ChatXPT Viewer Quest Board fallback and `1`/`2`/`3` Twitch-chat voting as the last-resort fallback. The OBS browser source is visual output for the broadcast, not the primary configuration interface.
- YouTube, Discord, and other streaming services may appear only as clearly disabled `Coming Soon` options. Do not implement their adapters, authentication, chat ingestion, voting surfaces, or platform-specific behaviour during the Twitch MVP.
- Keep the core platform-neutral so future adapters remain possible without creating parallel platform work now.
- Design for game streamers across audience sizes, play styles, and game genres. Do not encode the product, shared contracts, or quest engine around battle-royale-only concepts.
- A rehearsed demo may use one real, team-owned game stream or prepared real-gameplay scenario for reliability, but that scenario is evidence, not a product restriction.
- The judged workflow and product demonstration use real gameplay captured through OBS Virtual Camera and real Twitch activity. Simulated fixtures are limited to automated tests, developer diagnostics, and offline reproducibility and cannot be presented as live-extraction evidence.

## Golden workflow

```text
Streamer starts a Twitch session
-> Twitch and gameplay adapters emit normalised events
-> ChatXPT decides whether the moment is suitable
-> AI proposes exactly three validated sidequests
-> streamer veto rules are applied
-> viewers vote through the Twitch Extension, hosted Quest Board fallback, or Twitch-chat fallback
-> the winner appears in the OBS overlay
-> progress ends in success, failure, cancellation, or skip
-> rewards and session history update
```

## Non-negotiables

- Preserve a credential-free algorithmic fallback that operates on real captured inputs. Simulated fixtures remain available for tests and diagnostics, but the judged workflow must never present them as live data.
- Keep API keys, Twitch secrets, extension JWT secrets, and service credentials server-side and out of Git.
- Never commit private chat exports, personal viewer data, or competition credentials.
- Generate challenges that are legal, non-harmful, game-appropriate, non-wagering, and easy to understand under pressure.
- Keep Twitch-specific types inside the Twitch adapter. The core consumes normalised ChatXPT events.
- Route runtime composition through Role 1's application orchestrator: Role 2 analyses/generates, Role 3 decides, Role 1 authenticates/persists/broadcasts, and Roles 4/5 render and emit commands.
- Integrate after every wave through public ports and producer/consumer contract tests. Five separately working modules are not a working product.
- Route every viewer client through one private, platform-neutral participation service. Do not place authoritative vote state inside the Twitch Extension or another UI client.
- Preserve all three MVP participation paths: Twitch Extension primary, hosted Quest Board first fallback, and `1`/`2`/`3` Twitch-chat voting final fallback.
- Keep the participation interface ready for future authenticated integrations, but do not build a public developer API, external SDK, partner portal, or non-Twitch platform adapter during this MVP.
- Complete the Twitch workflow before any implementation for another streaming platform. A `Coming Soon` placeholder is not platform support.
- State clearly what is real, simulated, mocked, or proposed. If a real gameplay signal cannot be determined, report it as unknown instead of fabricating it.
- Treat `docs/DECISIONS.md` entries marked `Proposed` as open. Do not silently settle an open product or provider decision.

## Commands

```bash
npm ci
npm run dev
npm run check
```

Run the smallest relevant test while working and `npm run check` before merge handoff.

## Five-role ownership model

Each of the five contributors is assigned exactly one role. Role ownership is exclusive for normal work: the owner drives that area's ideation, design, implementation, tests, documentation, and component-level decisions. Contributors must not implement or direct work inside another role unless the project owner explicitly reassigns or approves it.

The project owner is the primary authority for overall product direction, priorities, role assignments, and cross-role decisions. The four other role owners have independent ideation authority inside their assigned components, subject to the recorded product direction and non-negotiable rules in this file.

Within those boundaries, each role owner decides their component's detailed behaviour, implementation, algorithms, UX flows, evaluation approach, and trade-offs without asking the project owner to design the component for them. Escalate only when a decision changes accepted product direction, crosses ownership, changes a shared contract, creates material safety/privacy/security risk, introduces an external service or recurring cost, or threatens the golden Twitch workflow.

When a contributor identifies an idea, feature, or change outside their role:

1. Do not implement it in the originating role.
2. Send it to the owning role as a clearly labelled cross-role proposal.
3. The owning role compares it with its own approach and reports the recommendation and trade-offs.
4. Notify the project owner of the proposal and comparison before any cross-role decision is adopted.

Shared contracts are coordinated through Role 1. A role owner may reject an inbound proposal that does not fit their component, but the project owner retains the final decision on scope or ownership disputes.

### Role 1 integration override

Role 1 may inspect, redirect, assist, and modify any role when required for integration, safety, deadline recovery, or an owner-requested fix. This is an integration override, not silent replacement of the component owner.

- Inform the affected owner before changing their files whenever practical.
- Use a pull request and request that owner's review before merge.
- If an urgent demo failure makes prior review impossible, Role 1 may apply the minimum safe fix, immediately notify the owner, and record what changed and why.
- After the urgent condition ends, component-level decisions return to the assigned owner.

### Scoped Role 2 planning grant

For the current MVP planning pass, the project owner grants Role 2 authority to decide the build plans for Roles 4 and 5. This is a deliberate exception to normal component planning ownership and is limited to the plans themselves.

- Role 2 decides MVP outcomes, surface and flow coverage, feature priority, required product states, AI/data requirements, mock/live boundaries, milestones, acceptance criteria, exclusions, and handoff order for both UI roles.
- Role 2 produces separate but synchronised implementation-ready plans for Roles 4 and 5, includes the shared dependency/fixture/contract matrix required by D-034, and sends each plan to its implementing owner and Role 1.
- Roles 4 and 5 review their plan for feasibility, identify conflicts or missing requirements in one response, and then implement it. They retain detailed visual, interaction, accessibility, component, and code decisions that do not contradict the approved plan.
- Role 2 may revise the plans after comparison, but may not edit Role 4 or Role 5 source files or implement their UI work under this grant.
- Any disagreement that changes scope, ownership, shared contracts, safety, cost, or the golden workflow goes to Role 1, who remains final authority.
- This grant does not give Role 2 authority over Role 3's quest-engine plan or Role 1's integration plan.

### Mandatory role guides

Every contributor and their ChatGPT/Codex agent must read this root guide, `docs/TEAM_PLAYBOOK.md`, `docs/build-plans/INTEGRATION-CONTRACT.md`, the assigned guide, the assigned TODO under `docs/roles/`, and the assigned execution plan before planning or editing. The root guide wins if a role guide or plan conflicts with it. Role guides and plans may clarify component decisions but cannot expand their own authority.

| Role | GitHub owner | Mandatory guide | Execution plan |
| --- | --- | --- | --- |
| Role 1 | `Dewflash` | `docs/roles/ROLE-1.md` | `docs/build-plans/ROLE-1-BUILD-PLAN.md` |
| Role 2 | `joelyrk` | `docs/roles/ROLE-2.md` | `docs/build-plans/ROLE-2-BUILD-PLAN.md` |
| Role 3 | `L0pch` | `docs/roles/ROLE-3.md` | `docs/build-plans/ROLE-3-BUILD-PLAN.md` |
| Role 4 | `JYL1m` | `docs/roles/ROLE-4.md` | Role 2-authored Role 4 plan after its feasibility review |
| Role 5 | `drdexe` | `docs/roles/ROLE-5.md` | Role 2-authored Role 5 plan after its feasibility review |

The matching work queue is `docs/roles/ROLE-<n>-TODO.md`. Plans define phase order, decision gates, and acceptance evidence; TODOs track current status. Roles 1-3 follow the shared concurrent calendar in `docs/build-plans/README.md`.

### Cross-role handoff authority

The five contributors work from separate computers and repository clones. GitHub is the persistent coordination system; personal ChatGPT/Codex conversations are not shared team memory.

- Create one GitHub Issue per cross-role proposal and label it `cross-role` plus the originating and target roles.
- The originating role records the problem, proposal, reason it crosses the boundary, relevant evidence, affected contracts, and requested decision. It must not implement the proposal.
- Assign or mention the target owner and mention `@Dewflash` in the issue.
- The target owner records comparison with their current approach, trade-offs, recommendation, and affected contracts.
- The project owner may discuss or resolve an issue through the primary Codex task. Role 1 must copy the settled outcome back into the GitHub Issue or `docs/DECISIONS.md` so every computer receives it.
- Record the outcome as `accepted`, `rejected`, or `deferred`. Implementation remains blocked until the target owner has compared it and the project owner has been notified.
- If an accepted proposal changes product direction, architecture, provider choice, ownership, or another durable rule, also record it in `docs/DECISIONS.md`.

### Role 1: Integrations and shared platform

**Owner:** `Dewflash`, project owner and primary authority.

**Owns:** shared data types, normalisation, channel/session lifecycle, platform boundaries, realtime integration, the gameplay-data extraction interface, and end-to-end integration tests.

Primary work:

- Define shared contracts for platform events, gameplay events, stream sessions, viewers, votes, quests, progress, and results.
- Define the private participation-service contract for session state, quest options, votes, reactions, live tallies, quest progress, results, and realtime event subscriptions.
- Define the stream lifecycle: offline, preparing, live, voting, quest active, cooldown, and ended.
- Own the application orchestrator that composes Role 2/3 ports, authenticates and deduplicates commands, persists authoritative revisions, and broadcasts role-specific view state.
- Research and document what Twitch currently supports through OAuth, EventSub, chat, Extensions, Extension JWTs/EBS, PubSub, testing, and channel metadata.
- Build the Twitch adapter without leaking Twitch payloads into ChatXPT Core.
- Own the OBS bridge contract for stream status, browser-overlay state, source control, and future screenshot inputs.
- Define the replaceable gameplay-data extraction contract consumed by the core and implemented by Role 2.
- Own the Supabase persistence/realtime boundary and the Vercel production deployment.
- Own thin `src/app/` route/layout/provider entry points, shared dependency/lock/config/env files, Supabase migrations/RLS, canonical contract tests, and the cross-role integration harness.
- Maintain the golden integration test from Twitch/gameplay input to vote, overlay, and result.

Does not own AI implementation, extraction implementation, quest-engine implementation, or final UI styling.

### Role 2: AI intelligence and data extraction

**Owner:** `joelyrk`.

**Owns:** AI intelligence across the product, gameplay/chat analysis, and implementation of data extraction against Role 1's interface.

Primary work:

- Implement real OBS Virtual Camera frame extraction behind Role 1's interface using lightweight visual algorithms, selective OCR, and optional free vision AI. Use simulated data only as test or diagnostic fixtures.
- Normalise health, kill, knockdown, looting, fight, and match-phase signals.
- Aggregate noisy events into a current gameplay snapshot with timestamps and confidence scores.
- Analyse gameplay history and audience activity to identify moments, sentiment, intent, energy, humour, risk appetite, boredom, hype, and repeated requests.
- Provide Role 3 with behavioural signals and confidence needed to adapt intervention and streamer-control behaviour.
- Convert gameplay snapshots, audience signals, streamer profiles, recent quests, and restrictions into model-ready context.
- Own model-provider adapters, model-ready context, signal-analysis prompts, structured transport, and provider reliability evaluation.
- Jointly evaluate provider/model selection with Role 3: Role 2 assesses integration, latency, privacy, cost, structured output, and reliability; Role 3 assesses quest quality and engine fit.
- Produce exactly three distinct candidate quests for Role 3 to validate and orchestrate.
- Expose public Role 2 ports and producer contract tests; do not persist session/lifecycle/UI state or import another role's private implementation.
- Decide and deliver the current MVP build plans for Roles 4 and 5 under the scoped planning grant above.
- Maintain AI-specific safety, privacy, latency, cost, reliability, moderation, and observability requirements.

Does not own quest lifecycle, deterministic quest rules, Role 4/5 source implementation, or their detailed execution decisions after the build plans are accepted. Role 2 supplies analysed signals and AI-generated candidates to Role 3.

**Open decision:** OpenRouter is the current leading candidate, not yet selected. Roles 2 and 3 compare it with alternatives and send one joint recommendation to Role 1 before integration or model-picker work.

### Role 3: Quest engine

**Owner:** `L0pch`.

**Owns:** deterministic quest generation rules, orchestration, validation, lifecycle, scoring, rewards, fallbacks, and safety enforcement before and after Role 2's AI call.

Primary work:

- Decide when gameplay and audience conditions justify a quest intervention.
- Decide the detailed proposal, approval, veto, automatic/manual activation, interruption, and emergency-control behaviour using Role 2's behavioural intelligence and the streamer's saved preferences.
- Convert analysed signals from Role 2 into deterministic quest-engine inputs.
- Own quest-domain AI decisions: quest objectives, generation instructions, quality criteria, and how model output is used within the deterministic engine.
- Jointly evaluate provider/model selection with Role 2 and send one recommendation to Role 1.
- Enforce feasibility, duplication, timing, difficulty, diversity, cooldown, streamer-boundary, and safety rules.
- Own quest states: proposed, voting, active, succeeded, failed, cancelled, skipped, and expired.
- Define scoring, reward, progress, automatic completion, and manual completion rules.
- Validate Role 2's AI-generated candidates before they can reach a streamer or viewer.
- Maintain a curated deterministic fallback quest library using the same candidate schema.
- Define how streamer vetoes, vote results, quest outcomes, and recent history influence the next quest cycle.
- Expose a pure public engine port returning state/events/allowed actions; Role 1 owns authentication, persistence, realtime, and platform execution.

Role 3 owns these mechanics; their exact timings and defaults are not project-owner decisions unless they cross a non-negotiable or another role boundary.

Does not own extraction implementation, provider-adapter code, audience-analysis prompts, or UI decisions. Role 3 consumes analysed inputs and candidate quests from Role 2 and emits validated quest state through Role 1's contracts.

### Role 4: Streamer Studio UI/UX and customisation

**Owner:** `JYL1m`.

**Owns:** implementation of the complete streamer and moderator experience plus detailed product and UX decisions within the accepted D-016 build plan.

Primary work:

- Build self-service Twitch connection, stream setup, and status visibility.
- Build ChatXPT Studio and the Twitch Live Config experience where appropriate.
- Treat Studio as the complete management product and Twitch Live Config as its focused stream-time companion, not as competing products.
- Build streamer profiles, game selection, personality, tone, intensity, safety boundaries, forbidden quest types, and accessibility preferences.
- Make settings persistent so streamers do not repeat setup every stream.
- Provide clearly test-only simulator controls for developer diagnostics; they cannot supply the judged live workflow or live-extraction evidence.
- Present detected signals and generated quests clearly.
- Implement veto, approve, start, skip, cancel, succeed, and fail controls.
- Show Twitch, OBS, AI, and realtime connection health with useful recovery actions.
- Decide how AI customisation is expressed to streamers, using Role 2's available capabilities.
- Keep advanced setup, history, testing, and integration management in Studio; keep the embedded Twitch live surface intentionally compact.
- Own the shared ChatXPT visual system: brand tokens, typography, colours, spacing, base components, and accessibility conventions consumed by Role 5.
- Define streamer-experience measurements such as setup completion, time to readiness, control usage, vetoes, and interruptions; Role 1 selects final submission KPIs.

The streamer chooses understandable experience settings. Provider and raw model names are not exposed as the normal control under D-022.

### Role 5: Viewer Quest Board UI/UX

**Owner:** `drdexe`.

**Owns:** implementation of viewer participation plus detailed product and UX decisions within the accepted D-016 build plan across the Twitch Extension and ChatXPT-owned fallback surfaces.

Primary work:

- Build the Twitch Extension voting and active-quest experience for desktop and mobile viewers.
- Display exactly three understandable quest choices, duration, difficulty, and reward.
- Implement live vote acknowledgement, tally, countdown, tie, cancellation, and winner states.
- Build reactions, hype meter, quest progress, results, community rewards, and clear error/reconnect states.
- Use Twitch viewer identity when available while supporting the Extension's anonymous mode safely.
- Build a lightweight hosted Viewer Quest Board as the first MVP fallback when the Twitch Extension is unavailable.
- Build a `1`/`2`/`3` Twitch-chat voting experience as the final MVP fallback when interactive viewer UI is unavailable.
- Keep fallback state and behaviour consistent with the Twitch Extension by consuming Role 1's participation-service contract.
- Do not require Twitch viewers to leave Twitch, scan a QR code, or create a separate account for the primary experience.
- Meet accessibility, responsive-layout, and low-distraction overlay requirements.
- Apply Role 4's shared visual system while independently deciding viewer and overlay UX.
- Define viewer-engagement measurements such as participation, vote completion, reactions, retention, and reconnect success; Role 1 selects final submission KPIs.

Coordinates vote and quest contracts with Role 1 and reward/progress rules with Role 3.

## Directory ownership map

Role ownership is enforced through repository directories:

| Role | Exclusive source directories |
| --- | --- |
| Role 1: Integrations and shared platform | `src/core/`, `src/integrations/`, `src/realtime/` |
| Role 2: AI intelligence and data extraction | `src/ai/`, `src/extraction/` |
| Role 3: Quest engine | `src/quest-engine/` |
| Role 4: Streamer Studio UI/UX | `src/streamer/`, `src/design-system/` |
| Role 5: Viewer Quest Board UI/UX | `src/viewer/` |

Role 5 owns viewer-facing OBS overlay visuals inside `src/viewer/`; Role 1 owns the OBS integration and data contract inside `src/integrations/`.

- Create new role-specific source inside the owning role's directory.
- Do not edit, move, rename, or delete files in another role's directory except through the recorded Role 1 integration override.
- Role 1 exclusively owns shared domain contracts in `src/core/`.
- Role 1 exclusively owns thin `src/app/` route/layout/provider files, shared dependency/lock/config/env files, Supabase migrations/RLS, and `tests/integration/`. Role-specific UI and logic stay behind public entry points in the owning directories.
- A role that needs a dependency proposes it to Role 1 with purpose, version, runtime/bundle risk, and fallback. Role 1 applies the shared-file edit or grants one explicitly scoped exception.
- Role 4 owns design-system implementation/styles under `src/design-system/`; Role 1 owns only the app-level import/wiring and Role 5 consumes the public design-system entry point.
- If another role needs a directory or contract change, submit a cross-role proposal to the owner and notify the project owner before adoption.
- Files outside the mapped directories are not automatically shared. Their ownership must be recorded before role-specific work changes them.

### One-time ownership migration

Role 1 is authorised to perform the initial mechanical migration from the legacy shared `src/lib/`, `src/components/`, and `src/app/` layout behind the five role boundaries. `src/app/` remains thin and Role 1-owned while it mounts the role-owned modules. This exception is limited to moving files, reconnecting imports/routes, and preserving existing behaviour. Role 1 must not redesign another role's algorithms, AI behaviour, or UX during the migration. Once a file enters its mapped role directory, exclusive ownership transfers immediately to that role.

## Shared contracts

Role 1 owns the canonical definitions; affected role owners must review breaking changes.

```text
PlatformEvent
GameplayEvent
AudienceSignal
StreamerProfile
StreamSession
ParticipationCapabilities
QuestCandidate
CandidateBatch
Vote
QuestCycleState
QuestProgress
QuestResult
RewardEvent
ContractEnvelope
CommandEnvelope
DomainError
StreamerViewModel
ViewerViewModel
OverlayViewModel
```

Keep provider payloads, Twitch payloads, component-local UI state, and persistence records outside the neutral domain contracts. Role 1 may define role-specific view-model contracts beside the application boundary. Prefer explicit ports/adapters over conditionals or direct cross-role imports.

## Collaboration

- Work from separate local clones. Personal ChatGPT/Codex context and uncommitted changes are not shared.
- Read `docs/TEAM_CONTEXT.md` before starting shared-contract or demo-critical work, and update its coordination board when claiming such work.
- Start each task from current `main` and use `role-<n>/<short-summary>` branches.
- Never push directly to `main`; use a pull request for every change.
- Keep branches short-lived, sync current `main` before review, and integrate the smallest vertical slice after every wave and at least daily.
- Role 1 controls final integration and merging. A pull request that touches another role's files requires that role owner's review.
- Maintain `CODEOWNERS` for role directories and require automated checks before merge.
- Do not edit another role's implementation or make decisions for that role, except through the recorded Role 1 integration override or the scoped D-016 Role 2 planning grant.
- Route cross-role proposals to the owning role for comparison and notify the project owner before adoption.
- Use GitHub Issues as the persistent cross-role handoff record. If the owner resolves something through Codex, Role 1 records the result back in the repository or issue.
- Do not change another role's public contract without that owner's review and the project owner's awareness.
- Keep pull requests small and include screenshots or recordings for UI changes.
- Require one reviewer; require two reviewers for shared contracts, safety logic, authentication, or demo-critical integration.
- State what was actually verified; never upgrade source inspection into runtime proof.
- Update `docs/DECISIONS.md` when the team settles Twitch scope, Supabase, AI provider/routing, gameplay extraction, identity, or rewards.
- Every role must preserve the golden Twitch demo, real-input algorithmic path, and deterministic fallback; simulated fixtures remain test/diagnostic only.
- Every pull request adds a role-owned change fragment under `changes/role-<n>/`; Role 1 compiles release-ready entries into `CHANGELOG.md`.

## Global delivery evidence

- Role 2 supplies data-extraction and AI evaluation cases, failure behaviour, and verification evidence.
- Role 3 supplies deterministic quest-engine tests, lifecycle coverage, safety enforcement, and verification evidence.
- Role 4 supplies a working streamer-facing site connected to agreed contracts, plus responsive screenshots or recordings.
- Role 5 supplies working viewer, fallback, and overlay sites connected to agreed contracts, plus responsive screenshots or recordings.
- Role 1 owns shared checks, end-to-end integration evidence, README and architecture assembly, third-party disclosures, slide-deck assembly, demo-video assembly, and final submission.
- Feature freeze is 7 August 2026 at 18:00 SGT. Use 8 August for integration, rehearsal, recording, and submission packaging; complete final verification and submission on 9 August.
- The submission repository must remain private and add `garena-ai-build-challenge` as a collaborator before submission.

## Current open decisions

- Which genuinely free provider/model, if any, Roles 2 and 3 jointly recommend behind the mandatory no-credential path.
- Component-level decision gates marked `Open` in the Role 1-3 build plans and the forthcoming Role 4/5 plans.
