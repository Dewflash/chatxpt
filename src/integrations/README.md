# Integrations public entrypoint

Role 1 owns this directory. Twitch and OBS adapters publish only the normalised contracts exported by `index.ts`; raw platform payloads and frame details stay private to their adapter.

`BrowserObsFrameSource` is the first real capture adapter. It opens only an explicitly selected browser camera, emits ephemeral `ImageBitmap` frames through the canonical `FrameSource`, publishes permission/ready/stale/unavailable/ended status, and releases tracks and bitmaps on stop. The local diagnostic accepts only a device identified as OBS Virtual Camera and never persists raw pixels.

Role 2 owns every algorithm or AI operation applied to these frames. The adapter does not infer health, kills, score, match phase, or any other gameplay fact.
