# ChatXPT Foundation Handoff — 3 August 2026

**Owner:** Role 1 (`Dewflash`)

**Purpose:** Give all five contributors one truthful merged-main starting point after the foundation pass. Root `AGENTS.md`, the assigned role guide/TODO/build plan, and `docs/build-plans/INTEGRATION-CONTRACT.md` remain authoritative if this summary becomes stale.

## Verified merged baseline

| Outcome | Merged PR | Evidence |
| --- | --- | --- |
| Five-role team authority and beginner-safe workflow | #2 | Owners, guides, TODOs, CODEOWNERS, templates, change fragments |
| Role 2 planning grant for Role 4/5 plans | #3 | Scoped authority without source takeover |
| Concurrent Role 1-3 execution plans | #4 | Phase gates, owner decisions, acceptance evidence |
| Binding cross-role integration contract | #5 | Public seams, dependency direction, integration ladder |
| Canonical contract version `1.0.0` | #6 | Runtime schemas, valid/invalid fixtures, focused tests |
| Public role entrypoints | #7 | Eight public modules and all-role compatibility tests |
| Role 1 orchestrator skeleton | #8 | Candidate -> engine -> atomic revision -> validated views/broadcast fixture cycle |
| Import-boundary guard and legacy inventory | #9 | TypeScript-AST scan plus explicit D1-01/D1-03 migration block |

At this checkpoint, `main` is the sole integration baseline, no pull request is open, the working tree is clean, and the full repository check passes. Feature branches do not override merged `main`.

## What each contributor does next

| Role | Owner | Ready starting point | Owner decisions before behavior work |
| --- | --- | --- | --- |
| Role 1 | `Dewflash` | `src/core/`, `src/integrations/`, `src/realtime/`, `tests/integration/`; continue integration and external feasibility work | D1-01, D1-03, D1-04 through D1-13 as listed in the Role 1 plan |
| Role 2 | `joelyrk` | `src/ai/index.ts`, `src/extraction/index.ts`, canonical fixtures, Role 2 plan; first deliver the separate Role 4/5 plans | The relevant D2 and joint D23 decision batch for each phase |
| Role 3 | `L0pch` | `src/quest-engine/index.ts`, `QuestEngine` port, canonical fixtures, Role 3 plan | The relevant D3 and joint D23 decision batch for each phase |
| Role 4 | `JYL1m` | Reserved `src/streamer/` and intentionally empty `src/design-system/` public paths | Wait for Role 2's plan, return one feasibility review, then decide detailed streamer/design-system UX |
| Role 5 | `drdexe` | Reserved `src/viewer/` public path and canonical viewer/overlay schemas | Wait for Role 2's plan, return one feasibility review, then decide detailed viewer/overlay UX |

Every contributor starts by pulling `main`, reading the mandatory files, answering only their current phase's decision batch in one response, and working in their owned directory. `npm run check` now rejects forbidden private cross-role imports.

## Foundation that is ready to consume

- Public imports: `@/core`, `@/core/testing`, `@/integrations`, `@/realtime`, `@/ai`, `@/extraction`, `@/quest-engine`, `@/streamer`, `@/design-system`, and `@/viewer`.
- Exactly three canonical quest candidates with distinct identifiers/titles and traceable generation metadata.
- Explicit universal/calibrated/native capability tiers, confidence, provenance, freshness, and known/unknown/stale/unavailable observations.
- Typed streamer/viewer/system commands with expected revision, command ID, actor class, correlation, and absolute timestamp.
- Same-session/revision view schemas for streamer, viewer, and read-only overlay consumers.
- An injected orchestration boundary that leaves permission policy, production persistence, Role 2 intelligence, Role 3 mechanics, and Role 4/5 presentation with their proper owners.
- Fixture tests for authorization denial, duplicate replay, reused command ID, stale revision, concurrent commands, malformed engine output, candidate handoff, persistence-before-broadcast, and broadcast-failure recovery.

## Deliberately not implemented

- No Twitch OAuth, Extension JWT/EBS, chat ingestion, channel allowlist, or Extension routes.
- No OBS Virtual Camera device selection, real-frame sampling, Browser Source security, or live overlay transport.
- No Supabase tables, migrations, RLS, realtime channels, production permission matrix, or retention job.
- No Vercel project/environment configuration.
- No production OCR, visual algorithms, audience intelligence, provider adapter, or AI candidate generation.
- No production quest lifecycle, safety validator, voting/tie rules, scoring, rewards, or fallback library.
- No streamer, viewer, Twitch Extension, hosted fallback, or OBS visual implementation.
- No ambiguous legacy file has been moved or deleted.

Those omissions are not forgotten work. They depend on named owner decisions, external accounts/devices, or component plans and therefore were outside the safe decision-free foundation pass.

## Commands every role can trust

```bash
git switch main
git pull --ff-only origin main
npm ci
npm run check
```

Useful focused checks:

```bash
npm run test:contracts
npm run test:integration
npm run test:orchestrator
npm run check:boundaries
```

## Evidence boundary

The merged tests prove schemas, dependency direction, deterministic fixture orchestration, revision/idempotency behavior, build compatibility, and recovery semantics. They do not prove real Twitch, OBS, Supabase, AI, extraction, UI, multi-device, or judged end-to-end behavior. Live claims begin only when those paths are executed with authorised real inputs and recorded separately.
