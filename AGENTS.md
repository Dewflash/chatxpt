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

`npm run check` also runs `npm run check:boundaries`. A role-owned module may import canonical Core and its allowed public dependencies, but may not import another role's private files. Tests may consume the explicit `@/core/testing` fixture entrypoint; product code may not.

## Five-role responsibility model

Each contributor has one coordination home and each role has a responsibility lead. These labels assign accountability, subject-matter context, TODO/evidence maintenance, and normal review routing; they are not file-edit permissions. Any contributor may inspect, edit, test, document, or implement work in any role directory without prior approval, reassignment, a cross-role issue, or a target-owner comparison.

Open contribution does not erase the product architecture. Code still belongs in the directory that represents its runtime responsibility, modules still integrate through public seams, and product code still may not import another module's private files. A contributor working across roles must understand the relevant role guide and plan, disclose every cross-role file changed, run the affected producer/consumer tests, and preserve rather than overwrite concurrent work.

The project owner remains the primary authority for overall product direction, priorities, accepted architecture, safety, and external cost. Role 1 coordinates integration order when branches overlap, but does not hold an exclusive merge gate. Responsibility leads remain advisers for their areas, but they cannot block implementation, pushing a branch, opening a pull request, direct integration, or merge merely because another role made the change.

Under D-076, any contributor with repository write or merge permission may merge a pull request or land a deliberate integration commit without required branch protection, CODEOWNERS, or independent-review approval. Pull requests remain the normal coordination record, and advisory review is encouraged for risky work, but it is not a merge gate. Before landing work, the contributor must inspect the diff, sync or deconflict current `main` and overlapping branches, run the relevant checks or document why they were not run, update required TODO/change/evidence records, and stop only for unresolved material safety, security, privacy, data-loss, external-cost, or broken golden-workflow risk. Role identity, a missing responsibility-lead response, Role 1 availability, absent branch protection, or absent review approval is not a merge blocker.

When work crosses role responsibilities:

1. Inspect current `main`, open branches/pull requests, and `docs/TEAM_CONTEXT.md` for overlap.
2. Notify the relevant responsibility lead and Role 1 promptly; use a `cross-role` issue when a durable coordination record is useful, not as a permission gate.
3. Implement the change in the directory that owns that runtime responsibility and keep public contracts explicit.
4. List the cross-role files, intent, tests, and unresolved semantic choices in the pull request.
5. Sync and deconflict before integration. Role 1 actively helps reconcile overlapping branches and decides integration order when needed.

### Role 1 integration and deconfliction duty

Role 1 may inspect, redirect, assist, and modify any role as part of ordinary integration work. Role 1 also owns active merge support: identify overlapping branches, explain conflicting intent, preserve both contributors' valid work, coordinate the resolution, rerun affected checks, and land the smallest coherent sequence.

- Notify affected contributors promptly; notification is coordination, not permission.
- Request the responsibility lead's review when practical, but do not leave another contributor idle while waiting.
- Provide integration and conflict-resolution help without becoming the mandatory approver or exclusive merger.
- Never resolve a conflict by discarding another branch's work without explaining the decision and recording the surviving behaviour.
- A failing check, unresolved semantic conflict, safety/privacy/security issue, or broken golden workflow may delay integration. Role ownership alone may not.

### Scoped Role 2 planning grant

For the current MVP planning pass, Role 2 is responsible for maintaining the build plans for Roles 4 and 5. This is a planning responsibility, not an edit-permission grant.

- Role 2 decides MVP outcomes, surface and flow coverage, feature priority, required product states, AI/data requirements, mock/live boundaries, milestones, acceptance criteria, exclusions, and handoff order for both UI roles.
- Role 2 produces separate but synchronised implementation-ready plans for Roles 4 and 5, includes the shared dependency/fixture/contract matrix required by D-034, and sends each plan to its implementing owner and Role 1.
- Roles 4 and 5 review their plan for feasibility, identify conflicts or missing requirements in one response, and then implement it. They retain detailed visual, interaction, accessibility, component, and code decisions that do not contradict the approved plan.
- Role 2 may revise the plans after comparison and may contribute to Role 4 or Role 5 source under the open-contribution rules above.
- Any disagreement that changes scope, shared contracts, safety, cost, or the golden workflow goes to Role 1, who remains final authority.
- Role 3 remains responsible for the quest-engine plan and Role 1 remains responsible for the integration plan; contributors may still help implement them.

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

### Temporary first-pull welcome

For every role, the first successful pull/sync in a repository clone triggers the one-time onboarding procedure in `docs/FIRST-PULL-WELCOME.md` when the local Git key `chatxpt.welcome-v1` is absent. Show the five-role map, only that contributor's broad decision areas, and their normal first-pass entry. Roles 4/5 also receive the vibecoding procedure. Do not dump every role's full question catalogue, ask the owner to answer everything immediately, or repeat the welcome after recording the local marker. This temporary layer does not replace mandatory files, current TODO selection, or phase gates.

### Guided execution mode for Roles 4 and 5

Roles 4 and 5 use a beginner-safe Codex workflow. If either owner says only `I am Role 4. What do I need to do?`, `I am Role 5. What do I need to do?`, or words to that effect, their Codex must not ask them to identify a task, phase, branch, file, dependency, test command, or integration owner.

The agent must instead:

1. Read the mandatory files and the role-owned execution record under `docs/roles/ROLE-<n>-EXECUTION.md`.
2. Inspect Git state without discarding work. Pull `main` only when the tree is clean, then explain relevant incoming changes in plain language.
3. Select the first `READY` item in the role TODO and map it to the current plan phase. If the plan still needs feasibility review, perform it promptly; this does not prohibit parallel source work under D-071.
4. State one bounded pass as `We will ...`; name its user-visible outcome, affected responsibility areas/files, dependencies, and acceptance evidence.
5. For every user-visible pass, run a short design-coaching gate. Use the plan's questions as starter examples, then inspect the actual surface and generate the most relevant questions about user goal, organisation and hierarchy, layout and responsiveness, interaction feedback, error/recovery UX, visual tone, motion, accessibility, and trust. Ask only choices that materially affect this pass, explain them without jargon, give a recommendation and consequence, and accept `Approve all recommendations` as a complete response. The plan tables are neither an exhaustive questionnaire nor fixed wording.
6. Make routine technical choices independently from repository evidence. Do not ask the owner to choose file structure, branch names, test tools, command syntax, contract ownership, or other normal implementation details.
7. After the owner answers, record the decisions in the role execution record and continue through the current bounded pass without asking for repeated permission for ordinary in-scope edits and tests. Never cross into the next phase before the current exit is accepted.
8. Stop and escalate only for a material product-scope change, safety/privacy/security, external cost/service choice, destructive action, missing credentials, or a genuine blocker that cannot be handled safely. A shared-contract edit is allowed, but it must be coordinated, tested on both sides, and deconflicted with Role 1.
9. If another role's module is required, notify its responsibility lead and Role 1, then either implement the smallest coherent cross-role slice or keep the UI on the accepted fixture/disabled path. Use a `cross-role` issue when it improves coordination; do not make the novice owner design another module's solution.
10. At the end, run the required checks, capture UI evidence, update the role TODO/execution record/change fragment, review the diff in plain language, and ask one final question: whether to commit, push, open a pull request, or land the integration under D-076.

The agent should minimise questions, not owner authority or design thinking. Role 4 still decides its visual and streamer interaction choices; Role 5 still decides its viewer and overlay interaction choices. Codex actively helps the owner consider relevant alternatives instead of merely reading a preset list. When a non-visual pass genuinely creates no owner decision, the agent explains the UX implications it checked and proceeds.

### Cross-role coordination records

The five contributors work from separate computers and repository clones. GitHub is the persistent coordination system; personal ChatGPT/Codex conversations are not shared team memory.

- Create a GitHub Issue for a substantial cross-role proposal when the team needs a durable comparison or unresolved decision; label it `cross-role` plus the originating and target roles.
- The contributor records the problem, proposal, relevant evidence, affected contracts, implementation status, and requested input. Implementation may proceed in parallel when it preserves accepted architecture and safety.
- Assign or mention the target owner and mention `@Dewflash` in the issue.
- The target owner records comparison with their current approach, trade-offs, recommendation, and affected contracts.
- The project owner may discuss or resolve an issue through the primary Codex task. Role 1 must copy the settled outcome back into the GitHub Issue or `docs/DECISIONS.md` so every computer receives it.
- Record the outcome as `accepted`, `rejected`, or `deferred`. A missing target-owner or Role 1 response is not an implementation, push, or merge blocker. The contributor landing the work resolves documented overlap and escalates only a material product/safety conflict that cannot be settled from repository authority.
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
- Evaluate the approved OpenAI `gpt-5.6-terra` path with Role 3: Role 2 assesses integration, latency, privacy, cost, structured output, and reliability; Role 3 assesses quest quality and engine fit. D-072 settles adoption, but runtime evidence remains required.
- Produce exactly three distinct candidate quests for Role 3 to validate and orchestrate.
- Expose public Role 2 ports and producer contract tests; do not persist session/lifecycle/UI state or import another role's private implementation.
- Decide and deliver the current MVP build plans for Roles 4 and 5 under the scoped planning grant above.
- Maintain AI-specific safety, privacy, latency, cost, reliability, moderation, and observability requirements.

Does not own quest lifecycle, deterministic quest rules, Role 4/5 source implementation, or their detailed execution decisions after the build plans are accepted. Role 2 supplies analysed signals and AI-generated candidates to Role 3.

**Accepted provider boundary:** D-072 permits server-side OpenAI `gpt-5.6-terra` for the judged MVP under its credential, credit, privacy, timeout, validation, and fallback limits. Provider availability is not required for the golden workflow, and provider/model pickers remain out of scope.

### Role 3: Quest engine

**Owner:** `L0pch`.

**Owns:** deterministic quest generation rules, orchestration, validation, lifecycle, scoring, rewards, fallbacks, and safety enforcement before and after Role 2's AI call.

Primary work:

- Decide when gameplay and audience conditions justify a quest intervention.
- Decide the detailed proposal, approval, veto, automatic/manual activation, interruption, and emergency-control behaviour using Role 2's behavioural intelligence and the streamer's saved preferences.
- Convert analysed signals from Role 2 into deterministic quest-engine inputs.
- Own quest-domain AI decisions: quest objectives, generation instructions, quality criteria, and how model output is used within the deterministic engine.
- Evaluate the approved OpenAI `gpt-5.6-terra` output with Role 2 against the provider-quality rubric; Role 3's deterministic validator and replacement library remain authoritative regardless of provider status.
- Enforce feasibility, duplication, timing, difficulty, diversity, cooldown, streamer-boundary, and safety rules.
- Own quest states: proposed, voting, active, succeeded, failed, cancelled, skipped, and expired.
- Define scoring, reward, progress, automatic completion, and manual completion rules.
- Validate Role 2's AI-generated candidates before they can reach a streamer or viewer.
- Maintain a curated deterministic fallback quest library using the same candidate schema.
- Define how streamer vetoes, vote results, quest outcomes, and recent history influence the next quest cycle.
- Expose a pure public engine port returning state/events/allowed actions; Role 1 owns authentication, persistence, realtime, and platform execution.

Role 3 leads these mechanics; their exact timings and defaults are not project-owner decisions unless they cross a non-negotiable or accepted module/product boundary.

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

## Directory responsibility map

Directories describe the responsibility of the code they contain, not who has permission to edit them:

| Role | Primary source directories |
| --- | --- |
| Role 1: Integrations and shared platform | `src/core/`, `src/integrations/`, `src/realtime/` |
| Role 2: AI intelligence and data extraction | `src/ai/`, `src/extraction/` |
| Role 3: Quest engine | `src/quest-engine/` |
| Role 4: Streamer Studio UI/UX | `src/streamer/`, `src/design-system/` |
| Role 5: Viewer Quest Board UI/UX | `src/viewer/` |

Role 5 owns viewer-facing OBS overlay visuals inside `src/viewer/`; Role 1 owns the OBS integration and data contract inside `src/integrations/`.

- Create new responsibility-specific source inside the corresponding directory, regardless of which contributor implements it.
- Any contributor may edit, move, rename, or delete files in another role's directory within an agreed task. Review concurrent work first and disclose the scope in the pull request.
- Role 1 maintains shared domain contracts in `src/core/`; any contributor may change them with affected producer/consumer tests and prompt Role 1 notification.
- Role 1 maintains thin `src/app/` route/layout/provider files, shared dependency/lock/config/env files, Supabase migrations/RLS, and `tests/integration/`. Any contributor may edit them, but must sync and deconflict collision-prone changes before merge. Notify Role 1 and use its integration help when overlap exists; Role 1 approval is not a gate. Role-specific UI and logic still stay behind public entry points.
- A contributor adding a dependency records its purpose, version, runtime/bundle risk, and fallback, then coordinates the shared-file edit with Role 1 so concurrent lockfile changes are reconciled.
- Role 4 owns design-system implementation/styles under `src/design-system/`; Role 1 owns only the app-level import/wiring and Role 5 consumes the public design-system entry point.
- Cross-role directory or contract changes may proceed after checking for overlap and notifying the relevant leads; an issue is optional unless a durable unresolved decision needs tracking.
- Files outside the map are treated as shared/collision-prone. Contributors may change them, but must identify responsibility and coordinate overlaps before merge.

### One-time ownership migration

Role 1 coordinates the initial mechanical migration from the legacy shared `src/lib/`, `src/components/`, and `src/app/` layout behind the five module boundaries. Other contributors may help. `src/app/` remains thin while it mounts the responsibility-specific modules. Migration work is limited to moving files, reconnecting imports/routes, and preserving existing behaviour unless the pull request explicitly scopes a redesign. Once a file enters its mapped role directory, that directory's public-seam and architecture rules apply.

## Shared contracts

Role 1 maintains the canonical definitions. Any contributor may implement a contract change; breaking changes require prompt affected-role notification, producer and consumer tests, migration notes, and documented deconfliction before merge. Role 1 assists but is not the required approver.

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
- Start each task from current `main` and use `role-<n>/<short-summary>` branches by default.
- Pull requests are the normal coordination record. Direct pushes to `main` are allowed only as deliberate, deconflicted integration actions by contributors with repository permission under D-076.
- Keep branches short-lived, sync current `main` before review, and integrate the smallest vertical slice after every wave and at least daily.
- Any contributor with repository write or merge permission may merge or directly land deconflicted work. Role 1 coordinates integration and overlapping landing order by default but is not the mandatory approver or exclusive merger.
- `CODEOWNERS`, branch protection, and required reviews are not repository-policy gates. Responsibility routing lives in this guide, role guides, TODOs, build plans, issues, and pull request notes.
- Contributors may edit any role's implementation. Preserve the destination module's accepted responsibilities, document significant judgement, and invite its lead to review.
- Notify relevant leads and Role 1 of substantial cross-role work; use issues for durable coordination, not permission.
- Use GitHub Issues as the persistent cross-role handoff record. If the owner resolves something through Codex, Role 1 records the result back in the repository or issue.
- Public-contract changes require affected producer/consumer tests and project-owner awareness before merge; no responsibility lead has a role-based veto over implementation or push.
- Keep pull requests small and include screenshots or recordings for UI changes.
- Request advisory review when it would improve shared contracts, safety logic, authentication, or demo-critical integration, but do not treat missing review as a merge blocker. Automated checks should run when relevant; if they cannot run, document the reason and the remaining risk before landing. Deconfliction and unresolved material-risk gates remain mandatory.
- State what was actually verified; never upgrade source inspection into runtime proof.
- Record every runtime run, screenshot, recording, evaluation, or inspection used as project evidence in `docs/evidence/manifest.json`; the evidence class, actual input, immutable source revision, command/interaction, artifact reference, reviewer, and limitations must pass `npm run check:evidence`.
- Update `docs/DECISIONS.md` when the team settles Twitch scope, Supabase, AI provider/routing, gameplay extraction, identity, or rewards.
- Every role must preserve the golden Twitch demo, real-input algorithmic path, and deterministic fallback; simulated fixtures remain test/diagnostic only.
- Every pull request adds a role-owned change fragment under `changes/role-<n>/`; Role 1 compiles release-ready entries into `CHANGELOG.md`.

## Global delivery evidence

- Role 2 supplies data-extraction and AI evaluation cases, failure behaviour, and verification evidence.
- Role 3 supplies deterministic quest-engine tests, lifecycle coverage, safety enforcement, and verification evidence.
- Role 4 supplies a working streamer-facing site connected to agreed contracts, plus responsive screenshots or recordings.
- Role 5 supplies working viewer, fallback, and overlay sites connected to agreed contracts, plus responsive screenshots or recordings.
- Role 1 owns shared checks, end-to-end integration evidence, README and architecture assembly, and third-party disclosures. Slide-deck assembly, demo-video assembly, and final narrative work begin only after the project owner explicitly declares the product ready for that phase.
- There is no automatic contract cutoff or feature-freeze date. Dated plan milestones are delivery targets, not a freeze command; only the project owner may declare the freeze. The submission deadline remains 9 August 2026, so integration and evidence work continue with deadline risk reported honestly until that call.
- The submission repository must remain private and add `garena-ai-build-challenge` as a collaborator before submission.

## Current open decisions

- Component-level decision gates marked `Open` in the Role 1-3 build plans and the Role 4/5 plans. D-072 closes provider/model adoption; credential/credit availability and real provider evidence remain execution dependencies, not product-decision gates.
