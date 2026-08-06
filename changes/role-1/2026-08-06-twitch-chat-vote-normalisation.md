## Role 1 - Twitch chat vote normalisation

- Added a Twitch adapter seam that converts bare `1`/`2`/`3` chat messages into canonical `viewer.vote` commands with `sourceMode: twitch-chat`.
- Added opaque hashed actor, voter, command, and correlation identifiers so raw Twitch user/message IDs stay inside the Twitch adapter boundary.
- Returned the matching verified actor record for Role 1's server authorizer, preserving command idempotency and preventing the adapter from owning winners, tallies, lifecycle, rewards, or vote resolution.
- Added a fingerprint-checked verified actor store so chat-derived verification cannot be reused for a changed command with the same command ID.
- Added a reusable submission seam that normalises chat, records verification, and submits the command to the authoritative executor while passing through ignored and rejected outcomes unchanged.
- Added acknowledgement-intent mapping for counted, duplicate, late, rejected, and ignored chat messages before outbound delivery is attempted.
- Connected acknowledgement intent to the outbound Twitch-chat delivery seam so ignored chat sends nothing, delivered acknowledgements can report counted/duplicate/rejected/late, and unavailable delivery cannot claim a vote status.
- Added a composed Twitch chat message handler that performs normalisation, authoritative submission, and bounded acknowledgement delivery for one incoming chat message without giving the adapter tally or lifecycle authority.
- Ignored non-vote chat and messages without trusted Twitch user identity instead of treating general chat as failed votes.
- Verified accepted chat votes against the server authorizer, authoritative orchestrator commit/tally handling, one-message handler delivery, duplicate Twitch message idempotency, duplicate-vote acknowledgement of the original accepted candidate, ignored non-vote chat without execution or delivery, stale-revision late acknowledgement, unavailable acknowledgement delivery overclaim protection, missing-identity handling, and tamper-resistant verification lookup with focused integration tests.
