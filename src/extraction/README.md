# Extraction public entrypoint

Role 2 owns real-frame and audience extraction behind the canonical types exported by `index.ts`. Capabilities, provenance, confidence, freshness, and `unknown` remain explicit at this boundary.

`GameplayExtractionPipeline` adapts Role 1's ephemeral `FrameSource` into canonical gameplay snapshots. `AudienceExtractionPipeline` adapts normalised `AudienceEventSource` events into canonical audience snapshots. Implementations, sampling, OCR, calibration, and aggregation remain private to Role 2.

`createAudienceSignalPipeline` provides the first credential-free audience implementation on main. It consumes normalised audience events, keeps only privacy-safe rolling-window categories, and emits audience energy, intent, repeated-request, chat-vote, and negative-pressure signals. It does not retain raw chat text or claim real Twitch evidence from fixtures.

The current R2-P03/P03A boundary includes observation fusion, snapshot builders, bounded browser-canvas pixel sampling, a game-neutral frame-difference measurement stream, selective-region OCR experiment plumbing, and an evidence-report builder. The measurement stream consumes the canonical `FrameSource`, copies only a capped downsample, and releases every ephemeral frame before yielding. The evidence builder aggregates privacy-safe measurements against separately supplied human annotations and reports missing real-input coverage without persisting raw frames.

`assessExtractionEvidenceAsset` classifies Role 2 gameplay/chat assets before they are used as evidence. It lets team-owned recordings and sanitised chat support real extraction evaluation, keeps synthetic fixtures fixture-only, and only permits live demo claims for privacy-reviewed OBS Virtual Camera input with separated annotations.

D2-07 through D2-11 select two-frame-per-second universal measurement, annotated-sample threshold derivation, confidence 0.75, conflict delta 0.10, three-second expiry, bounded three-frame OCR bursts, local named-crop preprocessing, and two-of-three OCR confirmation. Diagnostic calibration cannot classify live-labelled measurements. The clean Tesseract dependency replacement is tracked in PR #126, and vision AI is excluded from P0 unless a later real trial proves material value.

Tests use explicitly synthetic pixel arrays, diagnostic-shaped evidence records, and an injected fake OCR adapter. No OCR engine, calibrated HUD fact, chat analyser, authorised gameplay asset, or real browser/OBS run is included yet, so this pass makes no live extraction or OCR-accuracy claim. `assessExtractionEvidenceBundle` refuses to mark diagnostic inputs as real evidence even when their structural checklist is complete.
