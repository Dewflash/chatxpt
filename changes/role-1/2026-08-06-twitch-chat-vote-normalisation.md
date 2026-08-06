## Role 1 - Twitch chat vote normalisation

- Added a Twitch adapter seam that converts bare `1`/`2`/`3` chat messages into canonical `viewer.vote` commands with `sourceMode: twitch-chat`.
- Added opaque hashed actor, voter, command, and correlation identifiers so raw Twitch user/message IDs stay inside the Twitch adapter boundary.
- Returned the matching verified actor record for Role 1's server authorizer, preserving command idempotency and preventing the adapter from owning winners, tallies, lifecycle, rewards, or vote resolution.
- Ignored non-vote chat and messages without trusted Twitch user identity instead of treating general chat as failed votes.
- Verified accepted chat votes against the server authorizer, duplicate Twitch message idempotency, ignored non-vote chat, and missing-identity handling with focused integration tests.
