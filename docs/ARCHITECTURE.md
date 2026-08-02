# Architecture

## Prototype shape

ChatXPT is one Next.js application with two presentation surfaces and one generation endpoint.

- **Control room:** edits synthetic gameplay, sentiment, and streamer signals; generates quests; records votes; activates a winner.
- **Overlay:** reads the activated quest and renders a transparent browser-source layout.
- **Generation endpoint:** validates input, attempts optional model generation, and falls back to a deterministic engine.

## Data flow

```text
Control room
  -> POST /api/sidequests
      -> validate request with Zod
      -> OpenAI Responses API when a server key exists
      -> deterministic fallback on missing key or provider failure
  <- three validated sidequests + provider metadata
  -> viewer votes in local UI
  -> activated quest written to localStorage + BroadcastChannel
Overlay
  <- reads initial localStorage state and later broadcast/storage events
```

## Why this architecture

- Demonstrates the complete experience with minimal operational risk.
- Mock generation makes judging and development reproducible.
- Server-only provider code prevents accidental API-key exposure.
- Domain types and adapters leave room for later WebSocket, telemetry, and platform integrations.

## Safety and failure handling

- Streamer boundaries are included in generation context.
- Quests are limited to in-game behavior and entertainment actions.
- Live generation output is runtime-validated.
- Invalid input returns a 400 response.
- Provider errors fall back to deterministic options.
- The producer is the final approval point before activation.

## Likely next adapters

Only add these after a team decision:

- WebSocket session service for viewers and OBS synchronization
- Twitch or YouTube chat sentiment adapter
- Game telemetry or manual hotkey adapter
- Persistent session/event store for analytics
