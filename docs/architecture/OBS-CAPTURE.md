# OBS Virtual Camera capture spine

## Purpose

Role 1 supplies real browser-visible gameplay frames to Role 2 through the platform-neutral `FrameSource` port. Role 1 owns browser permission, device selection, media-track lifecycle, timestamps, provenance, and resource release. Role 2 owns motion analysis, OCR, visual intelligence, confidence, and gameplay facts.

This boundary does not use fake gameplay events. If the browser cannot obtain a current frame, no frame is created and downstream gameplay facts remain unknown.

## Local diagnostic

1. Install and open OBS Studio.
2. Create a dedicated scene containing the game capture only.
3. Do not place the ChatXPT Browser Source overlay in the Virtual Camera scene. This prevents recursive analysis of ChatXPT's own output.
4. Start OBS Virtual Camera.
5. Enable the local-only route and start ChatXPT:

   ```bash
   CHATXPT_ENABLE_CAPTURE_DIAGNOSTIC=true npm run dev
   ```

6. Open `http://127.0.0.1:3000/diagnostics/obs-capture` in the target browser.
7. Grant camera permission, select the identified OBS Virtual Camera, confirm the raw-game scene, and start capture.

The route returns `404` in production even if the environment flag is present. It is a real-input diagnostic, not the final Role 4 Studio experience.

## Runtime guarantees

- Permission and start actions are user initiated.
- The diagnostic refuses ordinary webcams and accepts only a label identified as OBS Virtual Camera.
- Frames carry canonical source `obs-virtual-camera`, capture/receive timestamps, dimensions, session/correlation IDs, revision, and `live` or `diagnostic` evidence class.
- Frame pixels remain in an ephemeral `ImageBitmap`; the adapter does not encode, upload, log, cache, or persist raw frames.
- Consumers call `release()` after each frame. The operation is idempotent and closes the bitmap.
- Aborting iteration pauses the hidden video element, removes its stream, stops every media track, and reports `ended`.
- Permission denial and unavailable devices throw a typed `ObsCaptureError` and publish the matching capture status.
- A connected source without current video becomes `stale`; it does not emit a synthetic replacement frame.

## Role 2 handoff

Role 1 injects the canonical `FrameSource` port into Role 2 through the application composition boundary; Role 2 does not import the private OBS adapter. A yielded item is a real ephemeral image plus a validated `GameplayFrameObservation`. Role 2 must release it promptly and must derive only facts supported by its own algorithms, calibration, confidence, and capability declaration.

The current pass does not implement or claim:

- activity, OCR, health, kills, score, looting, combat, or match-phase analysis;
- the final Studio capture setup UX;
- OBS Browser Source output or overlay reconnect;
- a live Twitch golden workflow;
- real-device evidence until OBS Virtual Camera is installed, running, selected, and visually inspected in the target browser.
