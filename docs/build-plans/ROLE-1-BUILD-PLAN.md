# Role 1 Build Plan: Platform, Integration, Leadership, and QA

**Owner:** `Dewflash`

**Authority:** Project owner and final integration authority

**Primary directories:** `src/core/`, `src/integrations/`, `src/realtime/`

## Mission

Make all five roles productive in parallel, connect their work into one real Twitch workflow, continuously inspect and test the product, assign newly discovered work, and deliver the verified submission.

Role 1 is not limited to writing integration code. It is the continuing product-owner, technical-lead, integration, triage, and QA function for the team.

## Definition of done

Role 1 is complete when:

- Role-owned directories and imports are stable.
- Canonical game-neutral contracts connect every role without Twitch or provider payload leakage.
- The Role 1 application orchestrator is the sole composition, persistence, revision, and broadcast authority.
- Producer/consumer contract tests and the integration ladder pass from role boundaries through real clients.
- Supabase Free provides shared persistence/realtime and local algorithmic fallback remains available.
- Vercel preview and production environments are configured without leaked secrets.
- A real Twitch app/Extension works in Local or Hosted Test with real chat where possible.
- OBS Virtual Camera supplies real gameplay frames and OBS Browser Source displays the quest overlay.
- Role 2 intelligence drives Role 3, Role 3 drives authoritative quest state, and Roles 4/5 render that state.
- Two viewers can participate in the same session and see consistent results.
- The judged run uses real gameplay and real Twitch activity; uncertain signals become `unknown`.
- Checks, evidence, disclosures, deck, video, repository access, and final submission are complete.

## Continuous lead loop

Run this loop throughout every phase:

1. Pull and inspect current `main`, open PRs, TODOs, and the coordination board.
2. Test the newest integrated golden path before starting new integration work.
3. Triage failures into the correct role instead of silently absorbing all fixes.
4. Accept or reject shared-contract proposals quickly so Roles 2-5 remain unblocked.
5. Assign newly discovered work with an owner, acceptance signal, priority, and deadline.
6. Integrate the smallest current vertical slice on `main`; do not wait for every role to finish.
7. Review cross-role changes, enforce real/mock disclosure, and merge safe work.
8. Record durable decisions and update project status.

## Phase 1: Establish parallel-safe foundations

### Role 1 decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D1-01 | Final legacy-file mapping into the five owned source directories | Open | — |
| D1-02 | Minimum fields and versioning strategy for contract version one | Resolved by D-031/D-035 | Version `1.0.0`; required canonical envelope/revision/provenance/error fields from the integration contract; producer and consumer tests accompany changes. |
| D1-03 | Which existing prototype behaviours must remain temporarily reachable during migration | Open | — |
| D1-03A | Public entry points, shared-file ownership, and dependency-request procedure | Resolved by D-032 | Role 1 owns collision-prone composition files; Roles 2-5 export public entries and request shared dependencies through Role 1 unless granted a scoped edit. |

### R1-P01 — Publish authoritative plans

**Outcome:** Roles 1-3 receive detailed concurrent build plans and decision gates.

**Status:** Complete in PR #4; authority/onboarding links are wired and the full repository check passes.

**Work:**

- Publish this shared framework and the three role plans.
- Wire them into onboarding, CODEOWNERS, role guides, TODOs, and team context.
- Preserve all decisions from the owner grill.

**Acceptance:** Plans are linked from repository authority; affected owners are required reviewers; checks pass.

### R1-P02 — Thin contracts and application-orchestrator skeleton

**Outcome:** Roles 2 and 3 integrate without waiting for the full platform.

**Status:** Completed — versioned schemas, public ports, non-live fixtures, role-entrypoint consumer tests, and the injected orchestrator skeleton are implemented. Fixture integration tests cover candidate input, pure engine output, authoritative stamping, idempotency, stale and concurrent revisions, authorization, persistence-before-broadcast, and recovery after broadcast failure.

**Canonical contracts:**

- `PlatformEvent`
- `GameplayFrameObservation`
- `GameplayEvent`
- `GameplaySnapshot`
- `AudienceSignal`
- `AudienceSnapshot`
- `StreamerProfile`
- `StreamSession`
- `ParticipationCapabilities`
- `QuestCandidate`
- `CandidateBatch`
- `QuestCycleState`
- `Vote`
- `QuestProgress`
- `QuestResult`
- `RewardEvent`
- `SignalProvenance` with real source, algorithm/AI method, confidence, timestamp, and `unknown`
- `ContractEnvelope`, `CommandEnvelope`, `DomainError`, and `HealthStatus`
- `FrameSource`, `AudienceEventSource`, `IntelligenceProvider`, `CandidateProvider`, and `QuestEngine` ports
- `StreamerViewModel`, `ViewerViewModel`, `OverlayViewModel`, and role-specific command unions

**Work:**

- Publish Zod schemas, TypeScript types, version fields, public ports, and valid/invalid examples in `src/core/`.
- Include producer and consumer contract fixtures/tests for all five roles without importing their implementations.
- Scaffold the Role 1 application orchestrator: compose ports, authenticate/authorise commands, enforce idempotency/revisions, call Role 3, persist, and broadcast.
- Require canonical IDs, absolute timestamps, revision/expected-revision, correlation, provenance, typed errors, and `unknown` semantics from `INTEGRATION-CONTRACT.md`.
- Keep OBS, Twitch, Supabase, provider, and UI payloads behind adapters.
- Review Role 2/3 proposals in one short response round.

**Acceptance:** Producing and consuming examples compile together; invalid/version-mismatch cases fail predictably; no role imports another role's private files; the orchestrator skeleton can run a fixture intelligence -> engine -> persisted/broadcast state cycle.

### R1-P03 — Public-entry scaffolding and mechanical ownership migration

**Outcome:** Existing behaviour moves behind the new contracts without redesigning another owner's component.

**Status:** In progress — additive public entrypoints, cross-role compatibility tests, an executable dependency-boundary guard, and a factual legacy inventory are implemented without behavior changes. D1-01 and D1-03 remain open, so no ambiguous legacy file has moved.

**Work:**

- Map legacy `src/lib/`, `src/components/`, and `src/app/` responsibilities before moving files.
- Create each role directory and documented public entry point.
- Keep `src/app/` routes/layout/providers thin and Role 1-owned; they mount Role 4/5 public modules.
- Move or wrap code into `src/core/`, `src/integrations/`, `src/realtime/`, `src/ai/`, `src/extraction/`, `src/quest-engine/`, `src/streamer/`, `src/design-system/`, and `src/viewer/`.
- Record Role 1 ownership of dependency/lock/config/env/route/migration files and the scoped dependency-request process.
- Preserve the existing prototype until equivalent role-owned paths compile.

**Must not:** Redesign Role 2 algorithms, Role 3 mechanics, or Role 4/5 UX.

**Acceptance:** Existing routes build; imports resolve; CODEOWNERS matches actual paths; public entry points exist; no role must edit another role's source or a collision-prone shared file to start.

### R1-P03A — Day-one external and capture feasibility spikes

**Outcome:** External blockers fail early enough to recover.

**Work:**

- Attempt Twitch account/2FA, developer-console, app/Extension, and Local/Hosted Test setup.
- Prove the target browser can select OBS Virtual Camera, recover permission, sample real frames, and avoid overlay recursion.
- Prove Supabase realtime across two browsers with basic RLS and a clean Vercel preview with safe secret separation.
- Request Role 2/3's initial free-provider/no-credential feasibility result.

**Acceptance:** Each spike has executed evidence, an owner, a pass/fail result, and an immediate recovery decision for every failure. Full later implementations remain in their normal phases.

## Phase 2: Shared infrastructure and deployed preview

### Role 1 decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D1-04 | Minimal Supabase tables, realtime topics, and RLS boundaries | Open | — |
| D1-05 | Development, preview, and production environment separation | Open | — |
| D1-06 | Session creation, expiry, reconnect, and room-code policy | Open | — |
| D1-06A | Revision, command-idempotency, atomic-write, and reconnect-snapshot semantics | Resolved by D-035 | Server timestamps, command IDs, expected/current revisions, idempotency, atomic persistence before broadcast, typed errors, and reconnect snapshots. |
| D1-06B | Broadcaster/moderator/viewer/system/overlay permission matrix and token-expiry behaviour | Open | — |

### R1-P04 — Supabase Free foundation

**Outcome:** Multiple clients share authoritative session, vote, and quest state.

**Work:**

- Create Role 1-controlled project and server-only secrets.
- Implement minimal profiles, sessions, candidates, votes, active quests, progress/results, and aggregate engagement storage.
- Commit reproducible schema migrations, RLS policies, minimal seeds, and environment validation rather than relying on dashboard-only setup.
- Configure revisioned realtime channels and reconnect snapshots.
- Prefer in-memory raw-chat processing; if temporary raw chat is stored, implement automatic deletion within 24 hours.
- Preserve local development transport for diagnostics, not as judged live evidence.

**Acceptance:** Two browser sessions share one room, receive realtime updates, reconnect, and cannot mutate unauthorised state.

### R1-P05 — Vercel preview and environment safety

**Outcome:** Every role can integrate against a current deployed build early.

**Work:**

- Connect the repository to a Role 1-controlled Vercel project.
- Configure preview/production variables and server/client boundaries.
- Document local, preview, and production startup without exposing secrets.

**Acceptance:** A clean preview deployment succeeds; client bundles contain no secrets; the health path distinguishes configured and unavailable services.

### R1-P06 — Application orchestrator and participation service

**Outcome:** Twitch Extension, hosted Quest Board, chat fallback, Studio, and OBS consume one authoritative service.

**Work:**

- Compose Role 1 inputs, Role 2 providers, Role 3's pure engine port, persistence, and realtime publication through the application orchestrator.
- Implement session state, candidate publication, vote acceptance, tally subscriptions, activation, progress, result, and reconnect APIs.
- Authenticate/authorise actor classes, deduplicate command IDs, reject stale expected revisions, and persist new revisions atomically before broadcast.
- Return authoritative snapshots and absolute `startsAt`/`endsAt` timestamps so client clocks never decide outcomes.
- Keep platform identities/adapters outside the core.
- Expose capability flags so unsupported platform features receive the correct fallback.

**Acceptance:** Duplicate commands/votes do not apply twice; stale/out-of-order updates cannot overwrite newer state; token expiry and write/broadcast failure are visible; anonymous fallback works; one revision remains consistent across two viewers and one streamer client.

## Phase 3: Real capture, Twitch, and OBS

### Role 1 decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D1-07 | Twitch OAuth scopes, callback URLs, and test-channel allowlist | Open | — |
| D1-08 | Extension view types and exact Viewer/Config/Live Config routes | Open | — |
| D1-09 | OBS Virtual Camera selection/setup UX and capture-session lifecycle | Open | — |
| D1-10 | Owned gameplay fixture and team-controlled Twitch test-stream procedure | Open | — |

### R1-P07 — Twitch developer readiness

**Outcome:** Role 1 can register and test the Twitch product.

**Work:**

- Create the Role 1-controlled Twitch account and enable 2FA.
- Register the Twitch application and Extension test version.
- Configure callback URLs, test channel, allowlisted viewers, Extension paths, and Local/Hosted Test.
- Document credentials without committing them.

**Acceptance:** The developer console, app, Extension test version, broadcaster account, and viewer account are usable by the team.

### R1-P08 — Twitch adapter

**Outcome:** ChatXPT receives real Twitch identity/chat/session events and exposes test Extension surfaces.

**Work:**

- Implement OAuth and token handling server-side.
- Ingest real chat where permitted and normalise it for Role 2.
- Parse authorised `1`/`2`/`3` chat votes into the canonical viewer-command path without giving the adapter winner authority.
- Implement Extension JWT/EBS boundary and channel/session mapping.
- Handle token refresh, expiry, revocation, wrong-channel access, and anonymous capability fallback.
- Keep Twitch payloads inside `src/integrations/twitch/`.

**Acceptance:** A real test channel connects; chat arrives with timestamps/provenance; viewer identity is used when available; anonymous fallback remains usable.

### R1-P09 — OBS Virtual Camera capture contract and overlay output

**Outcome:** Real gameplay enters ChatXPT and quest state returns to OBS.

**Work:**

- Define the browser media/capture-session interface consumed by Role 2.
- Let Studio select OBS Virtual Camera and expose frames without persisting raw video.
- Require a raw-game source/scene to avoid analysing the ChatXPT overlay recursively.
- Implement the OBS Browser Source URL, data/reconnect contract, secure read capability, and setup instructions; Role 5 implements the overlay visuals from `OverlayViewModel`.

**Acceptance:** Team-owned real gameplay captured in OBS appears in the extraction interface; frames are ephemeral; Role 2 can analyse them; the winning quest appears in OBS.

### R1-P10 — Controlled visual-analysis Test Lab

**Outcome:** The team can reproduce extraction behaviour and prove Twitch-delivered-video analysis safely.

**Work:**

- Provide a controlled hosted fixture using team-owned/authorised real gameplay.
- Provide tester-initiated Twitch-tab capture for the same gameplay streamed through the team-controlled channel.
- Record expected real events separately for evaluation; never feed answers into the extractor.
- Exclude arbitrary third-party streams and stored raw frames.

**Acceptance:** The same owned scenario runs locally and through Twitch; captured observations are comparable; permissions and ephemeral-frame handling are visible.

## Phase 4: Integrate all roles

### Role 1 decision gate

| ID | Owner decision | Status | Recorded answer |
| --- | --- | --- | --- |
| D1-11 | Contract-change cutoff before feature freeze | Open | — |
| D1-12 | Minimum acceptable real extraction, quest, and participation evidence | Open | — |
| D1-13 | Final golden real-gameplay scenario and demo narrative | Open | — |

### R1-P11 — Role 2 to Role 3 integration

**Outcome:** Real frames and real chat produce three validated options without manual state fabrication.

**Work:**

- Connect Role 1 capture/chat inputs to Role 2.
- Connect Role 2 candidate batches to Role 3.
- Connect Role 3 state/events to the Role 1 orchestrator, atomic persistence, and participation service.
- Preserve source, method, confidence, provider, fallback, and unknown metadata.
- Run the producer/consumer contract tests at every boundary before accepting the live composition.

**Acceptance:** One real input run reaches a complete quest cycle; free-model unavailability triggers algorithmic/deterministic behaviour without fabricated signals.

### R1-P12 — Streamer and viewer integration

**Outcome:** Roles 4 and 5 consume accepted contracts without reimplementing business logic.

**Work:**

- Integrate Studio and Live Config controls.
- Integrate Twitch Extension, hosted fallback, chat fallback, and OBS visuals.
- Route UI-discovered contract gaps to the correct owner.
- Verify loading, error, unknown, unavailable, reconnect, and fallback states.

**Acceptance:** One streamer and two viewers complete the workflow across real clients with consistent state.

### R1-P13 — Golden workflow and failure matrix

**Outcome:** The complete judged workflow is repeatable and honestly evidenced.

**Required runs:**

- Real gameplay + real Twitch chat + free AI available.
- Real gameplay + free AI unavailable + algorithmic intelligence + deterministic quest fallback.
- OCR/vision cannot identify a requested value and reports `unknown`.
- Viewer reconnect and duplicate vote.
- Simultaneous/stale streamer commands, out-of-order realtime delivery, clock skew, and duplicate command IDs.
- Twitch/Extension token expiry plus Supabase write or broadcast failure.
- Streamer veto/cancel/skip and all terminal outcomes selected by Role 3.
- OBS overlay reconnect.

**Acceptance:** The same session/cycle revision and authoritative timestamps appear in Studio, two viewer clients, persistence, and OBS; results, limitations, screenshots/recordings, commands, and failures are recorded; no simulated run is presented as live evidence.

## Phase 5: Freeze and submit

### R1-P14 — Release evidence and submission

**Outcome:** Judges receive a truthful, reproducible submission.

**Work:**

- Enforce feature freeze and accept only demo-critical fixes afterward.
- Compile changelog fragments.
- Finalise README, architecture, prompts/agent configuration, third-party disclosures, privacy/limitations, and clean-clone instructions.
- Assemble the maximum 15-slide PDF and maximum five-minute video.
- Add `garena-ai-build-challenge` to the private repository and prepare the immutable Drive package.

**Acceptance:** Clean-clone verification passes; deployed links work; deck/video meet limits; repository access and submission package are confirmed.

## Escalation and reassignment

Role 1 may create or redirect work whenever integration/testing reveals a gap. Every assignment must name the owning role, reason, priority, acceptance signal, deadline, and affected contract. Role 1 uses the recorded override for urgent fixes but returns component decisions to the owner afterward.
