# Integrations public entrypoint

Role 1 owns this directory. Twitch and OBS adapters publish only the normalised contracts exported by `index.ts`; raw platform payloads and frame details stay private to their adapter.

The entrypoint is additive foundation. It does not claim that Twitch authentication, real OBS capture, or any live adapter is executed until the evidence manifest records a real run.

`chat-fallback.ts` provides the UI-X07 chat fallback formatting and receipt
policy used by Role 5 presentation and future Twitch outbound delivery. It maps
the authoritative three visible options to `1`/`2`/`3`, formats poll-open and
final-result announcements, and describes counted/duplicate/rejected/late/
unavailable receipt states. It deliberately does not parse Twitch chat, send
messages, bypass Role 1 vote authority, or promise per-vote chat
acknowledgement spam.

## OBS browser capture

`obs/browser-frame-source.ts` provides the browser-side `FrameSource` adapter for an authorised OBS Virtual Camera stream. Studio can request/select the OBS camera, wrap the resulting `MediaStream`, and pass canonical ephemeral frames to Role 2 without persisting raw video. When browsers initially hide camera labels, the adapter may request provisional video permission only to reveal device labels; it stops that stream and then requires an exact OBS device. It fails instead of silently analysing a built-in webcam.

`/diagnostics/gameplay-extraction` composes this public adapter with Role 2's multi-game analyzer at a burst-capable 100 ms source interval. It is explicitly diagnostic and does not persist frames or feed authoritative quest state. On 14 August 2026, OBS 32.2.1 launched and reported that its macOS Camera Extension activated and Virtual Camera output started; the selected target browser was denied macOS camera permission, so zero frames crossed the browser `FrameSource`. The runtime therefore proves the OBS output boundary started and the page failed safely, but not real frame sampling or extraction accuracy.

## OBS browser source output

`obs/browser-source.ts` provides the read-only OBS Browser Source descriptor. It builds a transparent overlay URL containing only a session id plus an opaque overlay access token, requires HTTPS outside localhost, records the expected 1920x1080 transparent/read-only setup, and provides token redaction for logs/docs. The token is a capability for reading the overlay snapshot only; it must not be committed, shown in screenshots, or reused for streamer/viewer commands.
