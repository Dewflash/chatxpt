# Integrations public entrypoint

Role 1 owns this directory. Twitch and OBS adapters publish only the normalised contracts exported by `index.ts`; raw platform payloads and frame details stay private to their adapter.

The entrypoint is additive foundation. It does not claim that Twitch authentication, OBS capture, or any live adapter is implemented.
