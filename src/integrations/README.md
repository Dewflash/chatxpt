# Integrations public entrypoint

Role 1 owns this directory. Twitch and OBS adapters publish only the normalised contracts exported by `index.ts`; raw platform payloads and frame details stay private to their adapter.

The entrypoint is additive foundation. It does not claim that Twitch authentication, OBS capture, or any live adapter is implemented.

`chat-fallback.ts` provides the UI-X07 chat fallback formatting and receipt
policy used by Role 5 presentation and future Twitch outbound delivery. It maps
the authoritative three visible options to `1`/`2`/`3`, formats poll-open and
final-result announcements, and describes counted/duplicate/rejected/late/
unavailable receipt states. It deliberately does not parse Twitch chat, send
messages, bypass Role 1 vote authority, or promise per-vote chat
acknowledgement spam.
