# Quest-engine evaluation evidence

This evidence is deterministic component evidence from explicitly labelled fixtures. It is not
live extraction, provider, Twitch, persistence, reconnect-network, or end-to-end workflow proof.

| Scenario | Expected deterministic result | Evidence |
| --- | --- | --- |
| Provider unavailable | Exactly three distinct credential-free fallback candidates; replay with the same seed is identical | `evaluation.test.ts` provider-unavailable case |
| Malformed or unsafe provider output | Every invalid value is rejected with structured audit issues and replaced without weakening validation | `evaluation.test.ts` malformed-provider case |
| Varied game genres | Tactical shooter, racing, strategy, platformer, and unknown profiles each receive three game-neutral fallbacks with no claimed signal evidence | `evaluation.test.ts` genre matrix |
| Reconstructed reconnect snapshot | Replaying the same authoritative snapshot/command is deterministic; a stale expected revision is rejected | `evaluation.test.ts` reconnect case |
| Cancellation | Ordinary cancel and emergency pause both terminate safely but retain distinct reasons and event types | `evaluation.test.ts` cancellation case |

Role 1 still owns command deduplication, persistence, reconnect transport, and authoritative revision
stamping. Issue #42 still blocks authoritative vote close, winner resolution, and activation evidence.
Provider quality and real Role 2 output remain joint Role 2/3 work under R3-004 and R3-P12/P13.
