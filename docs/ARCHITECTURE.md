# ChatXPT Architecture

## Accepted MVP shape

ChatXPT is one game-neutral Next.js/TypeScript product with a platform-neutral core and replaceable input/output adapters. It does not host livestream video. Twitch remains the viewing platform; ChatXPT adds analysis, quest orchestration, participation, and broadcast visuals.

Twitch is the only implemented platform for the MVP. YouTube, Discord, and other services may appear only as disabled `Coming Soon` capabilities.

## Surfaces

- **ChatXPT Studio:** complete streamer setup, persistent profile/preferences, OBS Virtual Camera selection, connection health, testing, history, and advanced session controls.
- **Twitch Live Config:** compact stream-time status, quest review/actions, intensity, voting visibility, and emergency controls inside Twitch.
- **Twitch Extension:** primary viewer voting, active quest, progress, reactions, hype, results, and session points.
- **Hosted Viewer Quest Board:** first participation fallback when Extension interaction is unavailable.
- **Twitch-chat voting:** final `1`/`2`/`3` fallback.
- **OBS Browser Source:** broadcast-only quest overlay; it is not the main configuration or voting surface.

## Data flow

```text
Twitch adapter                         OBS Virtual Camera
chat + identity + session events       ephemeral raw-game frames
              \                         /
               v                       v
             normalised Role 1 input contracts
                           |
                           v
          Role 2 extraction + audience intelligence
      visual algorithms + selective OCR + optional free AI
                           |
        real observations + confidence + provenance + unknown
                           |
            streamer profile and saved restrictions
                           |
                           v
             Role 2 candidate generation adapter
               exactly 3 structured candidates
                           |
                           v
              Role 1 application orchestrator
                           |
                           v
               Role 3 pure deterministic engine
  intervention -> validation/replacement -> voting -> activation
        -> progress -> result/reward -> cooldown/history
                           |
                           v
      Role 1 atomic persistence + participation/realtime
                           |
          +----------------+------------------+
          |                |                  |
    streamer UI      viewer surfaces      OBS overlay
```

## Ownership and boundaries

- `src/core/`, `src/integrations/`, and `src/realtime/`: Role 1 contracts, platform adapters, session lifecycle, participation, persistence, and integration.
- `src/extraction/` and `src/ai/`: Role 2 real-frame/chat intelligence, context, provider adapters, and candidate output.
- `src/quest-engine/`: Role 3 deterministic intervention, validation, fallback, lifecycle, voting resolution, progress, results, and rewards.
- `src/streamer/` and `src/design-system/`: Role 4 streamer surfaces and shared visual system.
- `src/viewer/`: Role 5 viewer, fallback, and overlay experiences.

Twitch, OBS, provider, Supabase, and UI payloads terminate at their adapters. Canonical contracts contain platform-neutral facts plus source, method, timestamp, confidence, freshness, and `unknown` provenance.

All cross-role calls use the public ports and canonical envelopes in `docs/build-plans/INTEGRATION-CONTRACT.md`. Role 1's application orchestrator is the only runtime layer that composes Role 2/3, authenticates commands, persists revisions, and broadcasts role-specific view models.

## Realtime and persistence

Supabase Free is the accepted authoritative MVP store/realtime layer. The Role 1 foundation uses relational session identity, lifecycle, uniqueness, revision, and foreign-key constraints around versioned JSONB canonical payloads. It stores profiles, sessions, quest cycles/candidate batches, accepted command receipts, accepted participation facts, quest events, lifecycle operations, short-lived realtime access grants, and role-sanitised reconnect snapshots. Raw chat is not stored by this foundation.

State changes use command IDs, expected/current revisions, server timestamps, typed errors, atomic persistence before broadcast, and reconnect snapshots. Realtime notifications do not replace the persisted source of truth.

Only ChatXPT's server key may write product tables or call state-changing RPCs. Browser, Twitch Extension, and OBS clients submit commands through Role 1 services; they never write authoritative Supabase rows. All exposed tables have RLS enabled and direct `anon`/`authenticated` table privileges revoked.

The database persists a general viewer snapshot with viewer identity, personal points, and accepted vote choice removed. Streamer, viewer, and overlay snapshots broadcast on separate private topics only after the snapshot transaction commits. A Supabase-authenticated principal needs a short-lived server-issued session/view grant to join one topic; clients cannot publish to it. Reconnecting clients subscribe first, fetch their latest authorised snapshot, and ignore duplicate or older revisions.

One broadcaster may have one preparing/live ChatXPT session. Preparing sessions expire after two inactive hours. Live duration has no fixed maximum while broadcaster heartbeats continue; a disconnect starts one non-extending ten-minute reconnect grace, which a returning heartbeat clears. Manual end, confirmed Twitch offline, or grace expiry closes access without deleting session history.

Credential-free local work uses the same application ports with in-memory state and permissions. This is a functional developer fallback, not shared-cloud or multi-browser evidence. Vercel hosting and the real Supabase Free project activation remain separately evidenced deployment work.

All viewer clients use one private participation service. No UI owns authoritative vote, lifecycle, scoring, or reward rules.

Hosted-board entry and Twitch-chat fallback delivery use the server-owned seams
in `docs/architecture/VIEWER-FALLBACK-SEAMS.md`. Safe share URLs carry only the
room code; a server exchange issues the short-lived HTTP-only viewer grant.
Chat messages are reported delivered only after Twitch confirms the send.

## Gameplay capture and extraction

For the MVP, the streamer configures OBS Virtual Camera to expose the raw game source to ChatXPT Studio. Role 1 owns permission, media, capture-session, and frame-delivery boundaries. Role 2 consumes ephemeral frames and uses lightweight visual algorithms, selective OCR, temporal confirmation, and optional free vision AI.

The system is game-neutral through tiered support. Universal algorithms recognise broad action/quiet/transition signals across action games. Calibrated adapters may recognise specific HUD facts only for configured games with adequate evidence and confidence. Official telemetry is future work. Missing, unsupported, or unreliable facts are `unknown`; they are never fabricated.

A developer Test Lab may analyse team-owned or explicitly authorised gameplay, including the same content streamed through a team-controlled Twitch channel. It is not a feature for silently analysing arbitrary third-party streams.

## AI and deterministic fallback

Roles 2 and 3 jointly recommend a free provider/model. Role 2 owns provider transport, signal context, reliability, and candidate generation. Role 3 owns quest objectives, quality, deterministic validation, replacement, and lifecycle use.

Provider failure must not stop the workflow:

1. Role 2 runs credential-free algorithms against the same real gameplay/chat inputs and still emits exactly three candidates.
2. Role 3 rejects unsafe, impossible, repetitive, or unsupported candidates and replaces them from its deterministic, unknown-safe fallback library.
3. Surfaces show provider/algorithmic/fallback state without claiming unavailable facts.

No paid model usage is authorised for the MVP.

## Safety, privacy, and evidence

- Streamer restrictions are enforced deterministically before a quest reaches viewers.
- Quests must be legal, non-harmful, game-appropriate, non-wagering, and understandable under pressure.
- Raw frames are ephemeral. The current foundation processes raw Twitch chat in memory and does not create a raw-chat table; any later Role 2 request for short-lived debugging retention still requires Role 1 approval and automatic deletion within the accepted 24-hour maximum.
- Twitch identity is used when available; anonymous participation remains supported.
- Points and hype are session-scoped and non-monetary.
- Simulated fixtures are limited to tests, diagnostics, and offline reproduction. Live claims require real captured gameplay and real Twitch activity.

## Current migration state

The repository began as a local control-room/overlay prototype using synthetic inputs, optional OpenAI generation, local storage, and `BroadcastChannel`. That path may remain temporarily reachable while Role 1 performs the mechanical migration, but it is fixture/diagnostic behaviour and not the accepted MVP architecture or judged evidence.
