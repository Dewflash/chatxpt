# Role 2 audience snapshot pipeline

- Added `createAudienceSignalPipeline`, a credential-free Role 2 audience implementation behind the existing `AudienceExtractionPipeline` port.
- The pipeline consumes normalised audience events, keeps only privacy-safe rolling-window categories, and emits canonical audience energy, intent, repeated-request, chat-vote, and negative-pressure signals.
- Added fixture tests for mixed chat/reaction/vote aggregation, low-confidence unknown handling, rolling-window expiry, session reset, provenance/evidence class preservation, and mixed fixture/live evidence partitioning.

This is fixture/component evidence only. It does not add real Twitch chat capture, sentiment-model trials, provider calls, persistence, or end-to-end live audience proof.
