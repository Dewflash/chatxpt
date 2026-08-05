# Extraction public entrypoint

Role 2 owns real-frame and audience extraction behind the canonical types exported by `index.ts`. Capabilities, provenance, confidence, freshness, and `unknown` remain explicit at this boundary.

`GameplayExtractionPipeline` adapts Role 1's ephemeral `FrameSource` into canonical gameplay snapshots. `AudienceExtractionPipeline` adapts normalised `AudienceEventSource` events into canonical audience snapshots. Implementations, sampling, OCR, calibration, and aggregation remain private to Role 2.

The current R2-P03 boundary includes observation fusion and snapshot builders that are exercised with fixture-only tests. It does not yet include OCR, visual algorithms, chat analysis, or a live capture implementation and makes no live-data claim.
