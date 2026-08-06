# Role 2 real-input evidence runbook

This runbook covers the bounded `role-2/real-input-evidence` pass. It records what must be executed with real inputs and prevents diagnostic structure from being presented as live extraction proof.

## Preconditions

- Start from merged `main`; do not copy Role 1's private OBS implementation into Role 2.
- Role 1 supplies a browser-delivered canonical `FrameSource` from an OBS Virtual Camera raw-game scene with no ChatXPT overlay recursion.
- Use two short team-owned or explicitly authorised gameplay samples with separate human annotations. Keep expected labels out of the production analyser.
- Use only normalised Twitch audience events. Remove viewer identifiers, sanitise message text, retain no raw input in the repository, and complete a privacy review before committing a fixture.
- Use an approved local/browser OCR adapter. D2-09 selects `tesseract.js@7.0.0` as the leading request in [issue #70](https://github.com/Dewflash/chatxpt/issues/70), but installation still requires Role 1 approval and a documented fallback.

## Required runs

1. Capture a quiet sequence that includes a genuine scene or match transition.
2. Capture a separate high-action sequence, preferably with a contrasting HUD or pacing style.
3. Feed both through `streamVisualFrameMeasurements` with `createBrowserCanvasPixelSampler`.
4. Run `runSelectiveOcrExperiment` on one named HUD region. Do not OCR the full frame.
5. Supply timestamped `quiet`, `action`, and `transition` annotations only to `createExtractionEvidenceRun` after measurement.
6. Record unsupported, low-confidence, conflicting, permission-denied, or unavailable facts as explicit unknown observations.
7. Call `assessExtractionEvidenceBundle` with both runs and the privacy-reviewed audience-fixture summary.

The bundle is structurally complete only when it contains two distinct samples, all three annotation labels, selective OCR, processing latency, an honest unknown case, and sanitised audience evidence. It becomes real-evidence-ready only when every input is labelled `live`; diagnostic inputs can never satisfy that final gate.

## Measurements and privacy

The report retains frame identifiers, capture times, frame-difference metrics, processing latency, separate annotation intervals, sanitised OCR status/confidence/parser metadata, and explicit unknown reasons. It never retains RGBA samples, `CanvasImageSource` objects, raw frames, raw OCR text, viewer identifiers, or unsanitised chat.

Record p50/p95 latency and practical resource observations from the executing browser. Note capture resolution, bounded sample size, cadence, browser/device class, CPU or responsiveness observations, permission state, and any dropped/stale frames. Do not infer resource usage that was not measured.

## Current blockers on 6 August 2026

- Role 1's `role-1/obs-capture-spine` is not yet merged into `main`, so the canonical browser `FrameSource` cannot yet be executed from this branch.
- The evidence manifest lists `obs-gameplay-machine` as `owner-action-required`.
- No real OCR engine is currently installed; Role 1's comparison and decision are pending in issue #70.
- The two authorised gameplay samples and sanitised real-chat input have not been supplied.
- D2-07 through D2-11 were approved on 6 August 2026. Their diagnostic implementation cannot produce real-calibrated thresholds until both authorised runs are available.

Until those items are resolved, tests and diagnostic-shaped reports are fixture/diagnostic evidence only.

## Evidence handoff

After the real run, add a privacy-safe artifact and evidence-manifest entry with the immutable commit, exact browser interaction/command, actual input, device/surface, reviewer, limitations, and Role 1 resource IDs. Run:

```text
npm test -- src/extraction/real-input-evidence.test.ts src/extraction/visual-measurements.test.ts src/extraction/selective-ocr.test.ts
npm run test:contracts
npm run check:evidence
npm run check
git diff --check
```

Do not mark R2-P03/P03A complete or call the result live until the executed artifacts and manifest entry pass review.
