# Viewer public entrypoint

Role 5 owns viewer, hosted fallback, chat-fallback presentation, and read-only OBS overlay modules exported here. They consume authoritative view models and emit typed commands without calculating winners, timers, rewards, permissions, or lifecycle state.

Role 1 created the additive boundary under the recorded integration override. Role 5 now owns the visual, component, accessibility, and interaction decisions inside the public modules while Role 1 retains route, authentication, command, persistence, and realtime composition.

## Current Role 5 boundary

`presentation.ts` reduces validated Core viewer and overlay snapshots to fields that the viewer surfaces may safely render. It deliberately excludes candidate rationale, provider details, signal provenance, and any client-owned winner, expiry, reward, or tally calculation. Missing tallies remain `null` rather than being presented as zero, community hype remains an unscaled authoritative value, and degraded connection state disables commands while retaining the last safe snapshot.

`surfaces.tsx` adds the first Role 5-owned render modules for the Twitch Extension panel, hosted Quest Board, chat fallback instructions, and read-only OBS overlay. They consume only `@/design-system` plus canonical Role 1 view models, and they expose handler props instead of constructing vote/reaction authority internally.

The Twitch viewer keeps local selection separate from authoritative acknowledgement. A pending command locks every option, an accepted private receipt locks and highlights the accepted card, and influential tallies appear only after that receipt or after the cycle becomes active/terminal. The compact Extension layout keeps its confirmation and engagement area reachable while quest cards scroll. Active and terminal states prioritise the authoritative winning quest, progress, result, community hype, and private session points without calculating any of them locally. Typed `DomainError` props supply safe recovery presentation while preserving the selected quest.

Current verification remains fixture/component evidence. Route mounting, real command dispatch, Twitch identity, private realtime recovery, Supabase multi-viewer behaviour, Twitch Extension packaging, and OBS Browser Source proof remain Role 1 integration work. Tests may import `@/core/testing`; product code may not.
