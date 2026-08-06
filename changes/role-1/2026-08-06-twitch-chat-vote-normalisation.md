## Role 1 - Twitch chat vote normalisation

- Added a Twitch adapter seam that converts bare `1`/`2`/`3` chat messages into canonical `viewer.vote` commands with `sourceMode: twitch-chat`.
- Added opaque hashed actor, voter, command, and correlation identifiers so raw Twitch user/message IDs stay inside the Twitch adapter boundary.
- Returned the matching verified actor record for Role 1's server authorizer, preserving command idempotency and preventing the adapter from owning winners, tallies, lifecycle, rewards, or vote resolution.
- Added a fingerprint-checked verified actor store so chat-derived verification cannot be reused for a changed command with the same command ID.
- Added a reusable submission seam that normalises chat, records verification, and submits the command to the authoritative executor while passing through ignored and rejected outcomes unchanged.
- Ignored non-vote chat and messages without trusted Twitch user identity instead of treating general chat as failed votes.
- Verified accepted chat votes against the server authorizer, authoritative orchestrator commit/tally handling, duplicate Twitch message idempotency, ignored non-vote chat without execution, stale-revision rejection pass-through, missing-identity handling, and tamper-resistant verification lookup with focused integration tests.
