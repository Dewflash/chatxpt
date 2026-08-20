# User and Tool Testing Framework

Use this framework whenever the owner asks for what to test, what features exist, or how ChatXPT maps user pain points to implemented tools.

## Response Contract

When asked for a test list, return features grouped by user and surface:

1. Streamer / producer
2. Viewer
3. Moderator or live operator
4. OBS / broadcast audience
5. System / integration owner

For each surface, include:

- Pain point
- Suggested ChatXPT tool
- Implemented feature
- How to test
- Expected result
- Evidence level
- Known caveat or blocker

## Evidence Labels

Use these labels exactly:

- `Implemented and locally testable`: source exists and can be exercised locally.
- `Fixture-only`: deterministic fixture or screenshot coverage only.
- `Memory-backed`: local production/runtime smoke using in-memory persistence.
- `Needs real evidence`: implemented or partially implemented, but not proven with real Twitch, OBS, Supabase, Vercel, or multi-device runtime.
- `Not implemented`: do not suggest it as available.

Never describe fixture, diagnostic, or memory-backed behavior as live Twitch, live OBS, Supabase Cloud, Vercel, external-provider, or two-viewer evidence.

## Current Feature Map

| User | Pain point | Suggested tool | Implemented feature | How to test | Evidence level | Caveat |
| --- | --- | --- | --- | --- | --- | --- |
| Streamer / producer | Setting up ChatXPT before a stream is confusing. | ChatXPT Studio | `/studio` canonical Studio surface with session setup, readiness, health, and controls on current `origin/main`. | Start the app, open `/studio`, create or load a session, inspect readiness and available commands. | Implemented and locally testable | Full self-service Twitch OAuth/EventSub automation still needs real external setup evidence. |
| Streamer / producer | Streamers do not want to repeat personality, intensity, voting, and reward setup. | Persistent streamer profile and settings | Profile/settings contracts and UI fields exist for saved experience defaults. | Change settings in Studio or command tests, refresh/reload, verify persisted view model fields. | Implemented and locally testable | Some deeper fields such as game restrictions and accessibility mutations may still need final canonical contract completion. |
| Streamer / producer | Streamer needs compact controls inside Twitch while live. | Twitch Config and Live Config | `/config.html` and `/live-config.html` mount compact signed-broadcaster surfaces. | Run HTTPS dev mode, open Config/Live Config route or Twitch Local Test, verify compact controls render and dispatch canonical commands. | Implemented and locally testable | Real Twitch-hosted delivery and Twitch-issued broadcaster JWT evidence still required. |
| Streamer / producer | Streamer needs to understand what ChatXPT sees before trusting a quest. | Gameplay Capture and Capture Health | Authenticated gameplay ingress, normalized snapshots, Capture Health, Signal Confidence, and game facts vocabulary exist. | Open gameplay capture diagnostic or Studio capture health, grant camera/window permission, verify active/quiet/transition/unknown states. | Needs real evidence | Real OBS Virtual Camera frame evidence is not yet accepted; macOS/browser permission can block the live path. |
| Streamer / producer | AI suggestions can be unsafe, repetitive, or impossible. | Quest review with deterministic validation | Role 3 validates exactly three candidates, applies safety/feasibility/repetition gates, and replaces invalid candidates. | Generate candidates through algorithmic/provider path or fixtures; verify unsafe/malformed/duplicate candidates are rejected or replaced. | Implemented and locally testable | Real provider evidence is still pending; deterministic fallback remains mandatory. |
| Streamer / producer | Streamer wants audience-aware suggestions without reading every chat message. | Live Director private context | Studio/Live Config show declared intent, source-separated Live Context, Chat Pointers, and cue actions. | Open `/diagnostics/live-director`, `/studio`, or `/live-config.html` fixtures and verify source-labelled context and cue controls. | Fixture-only | Live Twitch chat and comparative value evidence are not yet proven. |
| Viewer | Viewers want to influence the stream without leaving Twitch. | Twitch Extension viewer | `/viewer.html` and uploadable Extension assets support select-then-confirm voting, private receipt, recovery, reactions, and active/result states. | Run Twitch Local/Hosted Test or local signed fixture route; vote once, refresh, verify private acknowledgement and first-vote-final behavior. | Needs real evidence | Real Twitch-issued JWT, Extension delivery, and two-viewer proof remain required. |
| Viewer | Twitch Extension may fail or be unavailable. | Hosted Viewer Quest Board | `/quest-board/[roomCode]` mounts the canonical viewer with anonymous HttpOnly authority. | Start a session, open room-code route on desktop/mobile, vote/reconnect, verify shared ledger state. | Implemented and locally testable | Real two-device Supabase/cloud evidence remains required. |
| Viewer | Some viewers only participate through chat. | Twitch chat `1`/`2`/`3` fallback | Signed EventSub chat vote adapter counts exact numeric votes through the same participation ledger. | Send exact `1`, `2`, or `3` messages through EventSub/local route tests; verify duplicate/late/invalid behavior. | Needs real evidence | Real EventSub subscription and live Twitch chat delivery still need recorded proof. |
| Viewer | Viewers need confidence their vote counted privately. | Private recovery and receipt | Viewer recovery returns only that viewer's accepted vote, session points, and acknowledgement state. | Vote, refresh/reconnect as the same viewer, verify no other viewer's private vote appears. | Implemented and locally testable | Multi-device cloud recovery still needs real Supabase evidence. |
| Viewer | Viewers want lightweight engagement beyond voting. | Reactions, hype, and session points | `hype` reactions, community hype, and private session-point presentation exist. | Trigger reaction command, verify public hype changes and private points remain viewer-scoped. | Implemented and locally testable | Persisted non-zero reward evidence and real multi-viewer proof remain open. |
| Moderator / live operator | Someone needs stream-time control without full setup power. | Moderator/live control commands | Broadcaster/moderator permission classes and stream-time commands exist. | Use moderator authority in tests or signed local grant; attempt allowed and disallowed commands. | Implemented and locally testable | Real Twitch moderator identity flow still needs external evidence. |
| OBS / broadcast audience | Broadcast needs a clean visual payoff, not private reasoning. | OBS overlay | `/obs-overlay` renders read-only inactive, voting, active, progress, result, reconnect, and compressed payoff states. | Open `/obs-overlay` with a session-scoped read grant; verify it renders and emits no commands. | Implemented and locally testable | Real OBS Browser Source evidence remains required. |
| OBS / broadcast audience | Broad audience should not see raw chat, user identities, provider detail, or private cue state. | Public overlay projection | Overlay projection excludes private Live Director fields and personal viewer state. | Inspect overlay view model and fixture tests; verify private fields are absent. | Fixture-only | Needs final live OBS recording to prove presentation in broadcast context. |
| System / integration owner | Multiple clients can desync during voting. | Authoritative orchestrator and revisioned command path | Role 1 server runtime authenticates, deduplicates, checks expected revisions, persists before broadcast, and serves role-specific views. | Run integration tests and memory smoke; send stale/duplicate/concurrent commands. | Memory-backed | Supabase Cloud realtime and two-browser evidence remain required. |
| System / integration owner | Demo must survive missing AI credentials or provider failure. | Algorithmic candidate fallback plus Role 3 deterministic fallback | Missing OpenAI key, timeout, refusal, malformed output, or outage falls back to algorithmic/deterministic candidates. | Disable provider config, force malformed/timeout cases, verify exactly three safe candidates still appear. | Implemented and locally testable | Real OpenAI `gpt-5.6-terra` credited call evidence remains pending under D-072. |
| System / integration owner | Game support must be honest across genres. | Multi-game extraction and capability model | Generic, Brawl Stars, and Minecraft profile registry plus universal/capability-aware observations exist. | Run extraction component tests or replay diagnostics; verify unsupported facts remain `unknown`. | Fixture-only | Real vanilla Minecraft OBS calibration and thresholds remain required before live accuracy claims. |

## Test Answer Shape

When producing a live testing checklist, keep it short enough for execution:

```text
User:
Tool:
Pain point:
Feature to test:
Route or command:
Steps:
Expected:
Evidence label:
Do not claim yet:
```

## Current No-Overclaim Rules

- Do not claim full golden workflow until the same authoritative session and quest-cycle revision reaches Studio, two viewers, persistence, and OBS using real Twitch activity and real captured gameplay.
- Do not claim real Twitch Extension readiness until Twitch-issued JWT delivery and Local/Hosted Test runtime are recorded.
- Do not claim real OBS evidence until OBS Browser Source or OBS Virtual Camera execution is recorded.
- Do not claim Supabase/Vercel readiness from memory-backed tests.
- Do not claim calibrated gameplay facts unless the selected game adapter proves them with accepted evidence.
