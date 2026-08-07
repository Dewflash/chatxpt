# OBS Capture Runbook

Role 1 owns the browser permission, source-selection, capture-session lifecycle, and ephemeral frame-delivery boundary. Role 2 owns analysis of frames after they are exposed through `FrameSource`.

## Setup Policy

D-057 settles the MVP capture path:

```text
Required source:        OBS Virtual Camera
Capture permission:    browser camera permission, same-origin only
Raw scene confirmation: streamer confirms OBS Virtual Camera shows the raw game scene
Overlay exclusion:     streamer confirms the ChatXPT overlay is not part of the captured scene
Nominal cadence:       1000ms
Freshness limit:       3000ms
Minimum frame size:    320x180
Raw frame persistence: never
```

Do not treat face cameras, screen capture, browser-tab capture, or an OBS scene that includes the ChatXPT overlay as ready for the judged workflow.

## Lifecycle States

`resolveObsCaptureSetup` maps a browser setup report into the `obs-capture` setup service:

| State | Meaning | Expected recovery |
| --- | --- | --- |
| `needs-permission` | Camera permission is missing or denied. | Request capture permission and retry source selection. |
| `needs-source` | The selected source is not OBS Virtual Camera. | Select OBS Virtual Camera. |
| `recursion-risk` | Raw game scene or overlay exclusion is not confirmed. | Fix the OBS scene/source so ChatXPT does not analyse its own overlay. |
| `waiting-for-frame` | OBS Virtual Camera is selected but no usable frame has arrived. | Retry or open diagnostics. |
| `stale` | The latest frame is old, not ready, or below minimum size. | Retry sampling or select the source again. |
| `ended` | The browser capture session ended. | Restart capture. |
| `ready` | OBS Virtual Camera is selected and supplying fresh raw-game frames. | Expose frames to Role 2 through `FrameSource`. |

The setup response is configuration/runtime readiness only. It is not live evidence until a real browser-delivered OBS Virtual Camera frame is sampled and recorded in `docs/evidence/manifest.json`.

## Privacy And Evidence

- Raw frames are not persisted.
- Browser device IDs are not stored.
- Source labels are transient setup context and must not be treated as credentials or durable identity.
- Live claims require real OBS Virtual Camera evidence from the assigned OBS/gameplay machine.
- Fixture, diagnostic, and synthetic frame tests must stay labelled as non-live evidence.
