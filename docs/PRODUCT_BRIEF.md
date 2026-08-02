# ChatXPT Product Brief

## Problem

Livestream chat is high-volume but low-agency. Viewers react, joke, and spam suggestions, yet those signals rarely become structured participation. Streamers must choose between following chat and concentrating on gameplay.

## Product promise

ChatXPT is an AI-powered livestream engagement engine that turns real gameplay moments, audience behaviour, and persistent streamer preferences into safe, short sidequests. Viewers choose the next challenge, the streamer retains appropriate control, and the broadcast makes the shared outcome visible.

ChatXPT does not replace Twitch or host video. The streamer installs and connects ChatXPT, uses ChatXPT Studio for full setup, receives compact controls in Twitch, and sends automatic quest visuals to OBS. Viewers participate directly through the Twitch Extension, with a hosted Quest Board and Twitch-chat voting as fallbacks.

## Target users

- Game streamers across audience sizes, play styles, skill levels, and action-game genres.
- Viewers who want meaningful influence rather than passive chat spam.
- Streamer teams or moderators who need clear, safe live controls.

The shared product is game-neutral. A reliable real game may be chosen for the demonstration without narrowing the architecture to that title or genre.

## Core inputs

1. **Gameplay intelligence:** real OBS-captured visual activity, transitions, and reliable HUD facts, each timestamped with confidence and provenance; unavailable facts remain `unknown`.
2. **Audience intelligence:** real Twitch chat energy, boredom, hype, humour, risk appetite, intent, repeated requests, and safety/moderation signals.
3. **Streamer profile:** play style, personality, tone, creativity, intensity, accessibility, game context, and forbidden challenge types saved across streams.

## Core loop

1. The connected streamer begins a Twitch session and ChatXPT receives real authorised inputs.
2. Role 2 intelligence identifies the moment and produces exactly three structured candidate quests.
3. Role 3 deterministically validates, rejects/replaces, times, and exposes the permitted streamer behaviour.
4. Viewers vote on exactly three safe options through the best available participation surface.
5. The winning quest appears in Twitch/Studio and the OBS overlay with countdown, progress, and session reward.
6. The engine reaches success, failure, cancellation, skip, or expiry and uses the result in later quest cycles.

## Differentiation

ChatXPT is not merely a poll or a generic chatbot. It closes the loop between what is happening in the game, how the audience is behaving, how the streamer wants to perform, and what the community does next. The reusable value is the intelligence and deterministic orchestration layer, not a single Twitch UI.

## MVP success criteria

- A judge understands the value and core loop in under 30 seconds.
- A streamer completes one-time Twitch/OBS setup, saves preferences, and starts a later session without repeating full setup.
- Real gameplay captured through OBS Virtual Camera and real Twitch activity drive candidate generation; missing observations are honestly `unknown`.
- Exactly three validated, game-neutral options reach one streamer and two viewer clients with consistent realtime state.
- Voting, activation, OBS display, progress, terminal result, session points, and hype complete end to end.
- A free AI contribution is evidenced when available; provider failure continues through algorithms on real inputs and deterministic quest fallback.
- Twitch Extension, hosted Viewer Quest Board, and Twitch-chat voting capabilities/fallbacks are represented honestly.
- No secret, paid model dependency, fabricated live signal, or persistent monetary economy is required.

## Current Twitch proof

- Real Twitch application and Extension in Local or Hosted Test.
- Allowlisted team-controlled broadcaster and viewer accounts; public Extension approval is not required.
- Real chat where Twitch permits it.
- OBS Virtual Camera for input and OBS Browser Source for output.
- Supabase Free for shared state and Vercel for deployment.

## Explicitly deferred

- Public Twitch Extension review/marketplace launch.
- YouTube, Discord, TikTok, or other platform adapters beyond disabled `Coming Soon` capabilities.
- Public developer API, SDK, partner portal, billing, and persistent cross-stream reward economy.
- Arbitrary third-party stream analysis without broadcaster installation/authorisation.
- Game-specific telemetry partnerships, OBS WebSocket automation, or a local desktop companion.
- Production-scale moderation, analytics, and multi-region infrastructure.
