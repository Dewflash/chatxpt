# Viewer public entrypoint

Role 5 owns viewer, hosted fallback, chat-fallback presentation, and read-only OBS overlay modules exported here. They consume authoritative view models and emit typed commands without calculating winners, timers, rewards, permissions, or lifecycle state.

Role 1 created this additive boundary under the recorded integration override. No visual, component, navigation, accessibility, or interaction decision is made by this scaffold.

## Current Role 5 boundary

`presentation.ts` reduces validated Core viewer and overlay snapshots to fields that the viewer surfaces may safely render. It deliberately excludes candidate rationale, provider details, signal provenance, and any client-owned winner, expiry, reward, or tally calculation. Missing tallies remain `null` rather than being presented as zero, community hype remains an unscaled authoritative value, and degraded connection state disables commands while retaining the last safe snapshot.

The public presentation boundary does not yet claim rendered Twitch, hosted-board, chat-fallback, or OBS modules. Those components must consume Role 4's public design system and Role 1's browser gateway after their reviewed handoffs merge. Tests may import `@/core/testing`; product code may not.
