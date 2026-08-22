# Integrations public entrypoint

Role 1 owns this directory. Twitch and OBS adapters publish only the normalised contracts exported by `index.ts`; raw platform payloads and frame details stay private to their adapter.

The entrypoint is additive foundation. It does not claim that Twitch authentication, real OBS capture, or any live adapter is executed until the evidence manifest records a real run.

`chat-fallback.ts` provides the UI-X07 chat fallback presentation policy.
`twitch/chat-votes.ts` maps only exact `1`/`2`/`3` messages into canonical
commands, and `twitch/eventsub.ts` verifies Twitch's HMAC over the exact raw
webhook body before extracting a bounded chat event. The server pseudonymizes
the raw chatter ID per ChatXPT session and sends the vote through the same
private ledger and orchestrator as every other viewer surface. Ordinary chat is
ignored by this voting boundary; raw Twitch IDs and message text are not
persisted here. Poll-open/result formatters remain ready for a later outbound
sender. Per-vote replies are intentionally disabled to avoid chat spam, so
viewers watch the broadcast overlay for the result.

## OBS browser capture

`obs/browser-frame-source.ts` provides the browser-side `FrameSource` adapter for an authorised OBS Virtual Camera stream. Studio can request/select the OBS camera, wrap the resulting `MediaStream`, and pass canonical ephemeral frames to Role 2 without persisting raw video. When browsers initially hide camera labels, the adapter may request provisional video permission only to reveal device labels; it always stops that stream and then requires an exact OBS device. It fails instead of silently analysing a built-in webcam. Typed failure reasons distinguish blocked permission, missing OBS devices, unavailable devices, and unsupported browser capture. The missing-device recovery tells streamers to restart a browser that was already open when OBS registered its virtual-camera filter.

`/diagnostics/gameplay-extraction` composes this public adapter with Role 2's multi-game analyzer at a burst-capable 100 ms source interval. Without a session id it remains a local diagnostic. Opened from Studio, it exchanges the server-only gameplay setup key for a short-lived grant and sends only canonical normalized snapshots to the authoritative ingress; the grant authority refreshes the cycle, revision, and evidence class used to stamp later frames. The setup key and bearer grant remain in component memory and raw camera frames never enter a request or persistence record. On 22 August 2026, OBS 32.2.2 on Windows supplied real team-owned Minecraft output through the exact OBS Virtual Camera device to Chrome; the diagnostic analyzed more than 187 frames while retaining calibrated HUD facts as unknown. This proves the ephemeral browser frame seam and universal analyzer ran against real OBS input. It does not prove the authoritative Studio session ingress, Twitch activity, calibrated-fact accuracy, Supabase Cloud, or OBS Browser Source output.

`/api/gameplay/ingress/grant` exchanges the server-only gameplay setup key for a ten-minute session-scoped capture grant. `/api/gameplay/ingress/snapshot` then accepts only bounded canonical `live` or `diagnostic` snapshots sourced from `obs-virtual-camera`; it never accepts raw frames or fixture evidence. Grants are bound to the active session and broadcaster, snapshots must match the current cycle/revision/evidence class, stale timestamps fail closed, duplicate retry is idempotent, and new samples are bounded to the supported 10 FPS burst cadence. The endpoint reports current authority so the capture client can recover after a quest revision changes.

## OBS browser source output

`obs/browser-source.ts` provides the read-only OBS Browser Source descriptor. Studio exchanges the server-only overlay setup key for a 12-hour, session-and-broadcaster-bound HMAC grant and a transparent `/obs-overlay` URL. The non-secret session id is a query parameter; the opaque access token is held in the URL fragment so browsers do not send it in the page request or normal access logs. The overlay client sends that capability only in the `Authorization` header to `/api/obs/overlay/state`, which projects the latest authoritative `OverlayViewModel` and emits no commands. URLs require HTTPS outside localhost, default to 1920×1080, and redact the fragment token for logs/docs. The token must not be committed, shown in screenshots, or reused for streamer/viewer commands. The legacy `/overlay` route remains a clearly separate prototype/diagnostic surface until migration cleanup.
