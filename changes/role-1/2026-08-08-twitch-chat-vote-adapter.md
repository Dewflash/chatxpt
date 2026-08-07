## Role 1

- Added a Twitch chat fallback adapter that maps strict `1`/`2`/`3` chat messages into canonical `viewer.vote` commands with `sourceMode: "twitch-chat"`.
- Preserved ordinary chat as raw-24h-max audience events while chat-vote events store only the aggregate choice, not raw message text.
- Added focused tests for strict parsing, verified viewer identity, deterministic duplicate delivery IDs, and canonical command/event validation.
