# Viewer public entrypoint

Role 5 owns viewer, hosted fallback, chat-fallback presentation, and read-only OBS overlay modules exported here. They consume authoritative view models and emit typed commands without calculating winners, timers, rewards, permissions, or lifecycle state.

Role 1 created this additive boundary under the recorded integration override. No visual, component, navigation, accessibility, or interaction decision is made by this scaffold.

## Current Role 5 boundary

`presentation.ts` reduces validated Core viewer and overlay snapshots to fields that the viewer surfaces may safely render. It deliberately excludes candidate rationale, provider details, signal provenance, and any client-owned winner, expiry, reward, or tally calculation. Missing tallies remain `null` rather than being presented as zero, community hype remains an unscaled authoritative value, and degraded connection state disables commands while retaining the last safe snapshot.

`surfaces.tsx` adds the first Role 5-owned render modules for the Twitch Extension panel, hosted Quest Board, chat fallback instructions, and read-only OBS overlay. They consume only `@/design-system` plus canonical Role 1 view models, and they expose handler props instead of constructing vote/reaction authority internally.

These modules are fixture-rendered only on this branch. Route mounting, Twitch Extension packaging, hosted-board access, realtime dispatch, and OBS Browser Source proof remain Role 1 integration work. Tests may import `@/core/testing`; product code may not.
