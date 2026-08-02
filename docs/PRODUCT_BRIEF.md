# ChatXPT Product Brief

## Problem

Livestream chat is often high-volume but low-agency. Viewers react, joke, and spam suggestions, yet those signals rarely become structured participation. Streamers must choose between following chat and concentrating on gameplay.

## Product promise

ChatXPT turns the current game moment and audience mood into safe, short, entertaining sidequests. Viewers vote, the streamer receives one clear challenge, and the overlay makes participation visible.

ChatXPT does not host livestream video. It is a reusable, game-neutral product around a platform-neutral core; Twitch is the only platform adapter in scope for the current MVP.

## Core inputs

1. **Gameplay state:** health, match phase, recent kills, squad status, combat/loot state, and loadout.
2. **Viewer sentiment:** energy, boredom, hype, humor, appetite for risk, and repeated requests.
3. **Streamer profile:** play style, intensity preference, content tone, accessibility needs, and forbidden challenge types.

## Core loop

1. A meaningful game or audience moment triggers generation.
2. The engine proposes exactly three distinct quests.
3. Deterministic validation rejects unsafe, infeasible, or duplicate output; Role 3's accepted mechanics determine explicit approval, automatic proposal, and streamer veto behaviour.
4. Viewers vote within a short window.
5. The winner appears in the overlay with timer, status, and points.
6. The quest ends in success, failure, cancellation, skip, or expiry and updates non-monetary rewards and session history.

## MVP surfaces

- **ChatXPT Studio:** full streamer setup, preferences, safety limits, testing, integration health, history, and advanced session controls.
- **Twitch Live Config:** compact stream-time controls embedded in the Twitch Creator Dashboard.
- **Twitch Extension:** primary viewer voting and participation surface.
- **Hosted Viewer Quest Board:** first fallback when the Extension is unavailable.
- **Twitch-chat voting:** final `1`/`2`/`3` fallback.
- **OBS browser overlay:** broadcast visuals for voting, active quests, progress, and results.

## MVP success criteria

- A judge understands the loop in under 30 seconds.
- The full loop completes without external credentials.
- Generated quests visibly use all three input categories.
- Twitch-first and hosted fallback clients consume one authoritative, platform-neutral participation state.
- Overlay state updates in a separate browser or OBS surface.
- Failure of live AI degrades to a useful mock result.
- Failure of shared realtime infrastructure degrades to the credential-free local path.
- The demo shows why this is more engaging than an ordinary poll.
- Every demonstrated capability is labelled as real, simulated, mocked, fallback, or proposed.

## Explicitly deferred

- Production-grade game telemetry integrations
- YouTube, Discord, TikTok, and other non-Twitch platform integrations
- Public developer API, external SDK, and partner portal
- Multi-tenant billing and enterprise account administration
- Broad production-grade computer vision across multiple games
- Real monetary rewards or wagering
