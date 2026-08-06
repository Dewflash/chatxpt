# Extraction public entrypoint

Role 2 owns real-frame and audience extraction behind the canonical types exported by `index.ts`. Capabilities, provenance, confidence, freshness, and `unknown` remain explicit at this boundary.

`GameplayExtractionPipeline` adapts Role 1's ephemeral `FrameSource` into canonical gameplay snapshots. `AudienceExtractionPipeline` adapts normalised `AudienceEventSource` events into canonical audience snapshots. Implementations, sampling, OCR, calibration, and aggregation remain private to Role 2.

The current R2-P03/P03A boundary includes observation fusion, snapshot builders, bounded browser-canvas pixel sampling, a game-neutral frame-difference measurement stream, and selective-region OCR experiment plumbing. The measurement stream consumes the canonical `FrameSource`, copies only a capped downsample, and releases every ephemeral frame before yielding. It deliberately does not classify action, quiet, or transitions until D2-07 through D2-10 are settled.

Tests use explicitly synthetic pixel arrays and an injected fake OCR adapter. No OCR engine, calibrated HUD fact, chat analyser, authorised gameplay asset, or real browser/OBS run is included yet, so this pass makes no live extraction or OCR-accuracy claim.
