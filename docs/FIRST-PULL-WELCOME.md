# ChatXPT First-Pull Welcome

**Status:** Temporary team-onboarding message

**Owner:** Role 1 (`Dewflash`)

This message is shown once in each contributor's repository clone. It gives a new teammate enough context to begin without making them read every future decision at once. Role 1 may remove it after all five contributors confirm they have received the welcome and started their normal role workflow.

## One-time trigger

When a contributor first says `git pull`, asks Codex to sync the repository, or begins their first ChatXPT work session:

1. Determine their assigned role from their message or the owner table below. Ask which role they are only if it genuinely cannot be determined.
2. Protect uncommitted work and perform the safe pull/sync procedure in `docs/TEAM_PLAYBOOK.md`.
3. Check the local clone marker with `git config --local --get chatxpt.welcome-v1`.
4. If the marker is absent, read this complete file and show the tailored welcome described below.
5. After showing it, record the role locally with `git config --local chatxpt.welcome-v1 role-<n>`. This marker is local to that clone and is never committed.
6. Continue into the normal current-pass briefing. The welcome does not replace the role plan, decision gate, or TODO.

If the repository cannot be pulled safely, explain and preserve the work first. Do not record the marker until the welcome is actually shown.

## What Codex shows

Keep the displayed welcome readable:

1. Show the five-role delegation map.
2. Explain the contributor's own mission, boundaries, and broad decision areas.
3. Do not dump the other four roles' full question catalogues.
4. Tell them they will answer only a small current-pass batch, not everything below immediately.
5. For Role 4 or Role 5, also show the vibecoding procedure.
6. End by selecting the first ready TODO and explaining the first pass.

## Five-role delegation map

| Role | Owner | Responsibility |
| --- | --- | --- |
| Role 1 | `Dewflash` | Integration lead and final authority: shared contracts, sessions/realtime, Twitch, OBS, Supabase, deployment, evidence, and cross-role integration. |
| Role 2 | `joelyrk` | AI intelligence and data extraction: real-frame analysis, selective OCR, audience analysis, confidence/unknown handling, provider integration, and three candidate quests. |
| Role 3 | `L0pch` | Deterministic quest engine: intervention, validation, safety, exactly-three assembly, lifecycle, voting rules, progress, outcomes, rewards, cooldown, and fallback quests. |
| Role 4 | `JYL1m` | Streamer UI/UX and shared visual system: Studio, setup, profiles, customisation, readiness, streamer controls, Twitch Config/Live Config, and shared design components. |
| Role 5 | `drdexe` | Viewer UI/UX and broadcast presentation: Twitch voting, hosted board, chat instructions, reactions, hype/points presentation, quest results, reconnect UX, and OBS overlay. |

Stay inside the assigned role. If another role is needed, Codex creates or updates a cross-role issue, identifies the target owner, notifies Role 1, and preserves an accepted fixture/disabled boundary. The originating role does not implement the other role's work.

## Role 1 welcome and decision map

You lead integration and may use the recorded integration override when necessary, while informing and requesting review from affected owners.

Across your passes, Codex will help you decide:

- Canonical contracts, versioning, public ports, and compatibility policy.
- Session lifecycle, revisions, idempotency, reconnect, persistence, and broadcasting.
- Broadcaster, moderator, viewer, system, and OBS capabilities.
- Browser-safe UI gateways, private viewer state, and fallback-delivery seams.
- Supabase schema/RLS/realtime and credential-free local behaviour.
- Twitch OAuth, EventSub/chat, Extension surfaces, identity/JWT, and testing setup.
- OBS Virtual Camera capture and secure browser-overlay delivery.
- Deployment, environment separation, secrets, and service-cost approvals.
- Cross-role integration order, contract tests, failure recovery, and feature freeze.
- Real-versus-fixture evidence, KPIs, demo narrative, and submission readiness.

You do not need to pre-decide Role 2 algorithms, Role 3 mechanics, or Role 4/5 detailed UX. Those owners bring recommendations through the accepted boundaries.

## Role 2 welcome and decision map

You own the path from real gameplay/chat inputs to trustworthy intelligence and three structured candidate quests. You do not own Twitch/OBS integration, quest lifecycle, persistence, or UI.

Across your passes, Codex will help you decide:

- Separation of extraction, audience analysis, provider integration, and candidate generation.
- Public Role 2 ports versus private implementation.
- Universal action-game signals versus calibrated game/HUD adapters.
- Frame cadence, adaptive sampling, preprocessing, and resource limits.
- Selective OCR regions, engine, temporal confirmation, and contradiction handling.
- Confidence, freshness, staleness, provenance, partial observations, and `unknown` thresholds.
- Real team-owned gameplay scenarios and annotation/evaluation method.
- Audience taxonomy, aggregation windows, spam, sarcasm, humour, repeated requests, and low-volume chat.
- Rule-based versus model-assisted analysis and raw-chat privacy/retention.
- Model-ready context, signal priority, recent history, and streamer restrictions.
- OpenRouter/alternative evaluation for free use, structured output, latency, reliability, and privacy.
- Retry, malformed/refusal/outage behaviour and the credential-free algorithmic path.
- Candidate metadata, evaluation thresholds, limitations, and demo-readiness evidence.

You answer only the current phase's small decision batch. Provider adoption is a joint Role 2/3 recommendation brought to Role 1.

## Role 3 welcome and decision map

You are the final deterministic quest authority. AI may suggest, but your engine decides what can be shown, voted on, activated, completed, rewarded, or rejected. You do not own extraction, provider adapters, Twitch/OBS, persistence, or UI.

Across your passes, Codex will help you decide:

- State-machine/reducer architecture, public engine port, domain representations, and typed errors.
- Injected time, seeded randomness, repeatability, revisions, and command idempotency.
- Intervention signals, scoring, confidence, freshness, quiet periods, and cooldowns.
- Streamer approval, veto, automatic/manual activation, emergency pause, and gameplay changes.
- Validation order, hard rejects, warnings, repair versus replacement, and rejection reasons.
- Safety, restrictions, feasibility under unknown facts, clarity, duration, difficulty, diversity, and repetition.
- Fallback-library taxonomy, selection, seeding, history sensitivity, and exactly-three assembly.
- Voting duration, vote changes, minimum participation, ties, zero votes, and winning-option replacement.
- Progress detection, manual confirmation, success/failure/cancellation/skip/expiry semantics.
- Session points, community hype, history effects, future difficulty, and intervention timing.
- Quest-domain AI objectives, model-output use, evaluation cases, and failure evidence.

You answer only the current phase's small decision batch. Provider adoption is a joint Role 2/3 recommendation brought to Role 1.

## Role 4 welcome and decision map

You own how streamers and moderators experience ChatXPT and how the shared visual system looks and behaves. You do not need to design backend contracts, authentication, AI algorithms, quest mechanics, or Git procedure.

Across your passes, Codex will coach you through:

- First-time versus returning-streamer journeys.
- Studio navigation, hierarchy, page organisation, setup, and readiness.
- Profile/customisation grouping for game, style, intensity, safety, restrictions, and accessibility.
- Understandable AI confidence, fallback, unknown, and recovery presentation.
- Proposed-quest comparison and streamer/moderator controls.
- Which actions are primary, secondary, immediate, or confirmation-protected.
- Studio versus Twitch Config versus compact Live Config responsibilities.
- Visual tone, colours, typography, spacing, cards, panels, badges, ribbons, and progress.
- Layout, information density, responsive/narrow behaviour, and long content.
- Button feedback, motion, transitions, reduced motion, keyboard use, contrast, and touch targets.
- Loading, empty, stale, permission, disconnected, error, reconnect, and diagnostic states.
- Shared tokens/components and the earliest stable design-system handoff to Role 5.

These are design areas, not a fixed questionnaire. Codex inspects the current surface and asks only the few questions that will improve that pass.

## Role 5 welcome and decision map

You own how viewers vote, follow quests, react, recover from failures, and see the broadcast overlay. You consume Role 4's shared visual system and do not own voting authority, quest mechanics, Twitch ingestion, persistence, or permissions.

Across your passes, Codex will coach you through:

- What a viewer must understand within the first few seconds.
- Three-option comparison, card selection, vote confirmation, pending, and accepted feedback.
- Countdown, tally prominence, tie/zero-vote, winner, active quest, progress, and result hierarchy.
- Personal session points versus shared community hype.
- Reaction controls and bounded celebration intensity.
- Anonymous/authenticated clarity and private personal-state presentation.
- Duplicate, late, rejected, unavailable, disconnected, permission-expired, and reconnect behaviour.
- Narrow Twitch/mobile layout versus the wider hosted Viewer Quest Board.
- Hosted-board direct link, room-code entry, optional QR presentation, and recovery.
- Concise `1`/`2`/`3` Twitch-chat fallback instructions.
- OBS overlay size, placement, transparency, safe areas, readability, and low distraction.
- Button feedback, motion, reduced motion, focus, live regions, touch targets, and performance.

These are design areas, not a fixed questionnaire. Codex inspects the current surface and asks only the few questions that will improve that pass.

## Vibecoding procedure for Roles 4 and 5

You contribute product taste and user judgment. Codex handles routine technical execution.

### Start

Say only:

```text
I am Role 4. What do I need to do?
```

or:

```text
I am Role 5. What do I need to do?
```

Codex reads the repository, checks Git, selects the first ready TODO, and explains one bounded pass as:

```text
We will build or review [specific outcome].
The user will be able to [visible result].
This pass touches [owned area].
It depends on [upstream seam].
We will prove it with [tests, interaction, and screenshots].
```

### Design coaching

Before every user-visible pass, Codex inspects the actual surface and asks a small tailored batch. It explains visible alternatives, recommends one, and describes the consequence. The plan's existing questions are seeds rather than fixed wording or an exhaustive checklist.

Role 4/5 decides how the experience should look, feel, read, and behave. Codex translates that into components, Grid/Flexbox, CSS, responsive rules, interaction state, accessibility, and tests.

Useful owner responses can be simple:

- `Approve all recommendations.`
- `This should feel more energetic.`
- `The quest should be more prominent than technical status.`
- `This is too crowded.`
- `Make the winner more obvious without covering the stream.`
- `I like the flow, but the recovery action is unclear.`

### Implementation and review

Codex handles:

- Branching, syncing, files, React/TypeScript, component structure, and styling technique.
- Loading, empty, failure, permission, stale, pending, and reconnect states.
- Responsive behaviour, keyboard/focus, contrast, touch targets, live regions, and reduced motion.
- Clearly labelled fixtures, consumer tests, browser checks, screenshots, and builds.
- TODO, execution record, changelog, cross-role issues, diff explanation, commit, push, and PR preparation.

The owner contributes thoughts:

- During the initial design batch.
- When references, screenshots, colours, or products communicate the desired feeling.
- After the first wireframe/render.
- While reviewing narrow/mobile, failure, empty, and reconnect states.
- During the final screenshot/diff review before approving the PR.

### Pass cycle

```text
Current ready task
-> tailored design/UX coaching
-> owner decisions or approval
-> Codex implementation
-> rendered/tested result
-> owner visual review
-> Codex refinement
-> responsive/accessibility/failure verification
-> final owner approval
-> TODO/execution/changelog update
-> commit, push, and pull request
```

One pass produces one reviewable outcome. Codex does not spread a pass across unrelated screens or cross into another role.
