# Role 2 extraction evidence catalogue

- Added a Role 2-owned evidence catalogue helper for gameplay recordings, gameplay frames, chat transcripts, and annotations.
- The helper keeps synthetic fixtures fixture-only, allows team-owned or authorised recordings for real extraction evaluation, and only allows live demo extraction claims from privacy-reviewed OBS Virtual Camera input with separated annotations.
- Added focused tests for owned gameplay, live OBS frames, synthetic fixtures, mixed annotations, annotation-only live OBS records, unsanitised chat, sanitised-chat source/kind invariants, and contradictory fixture metadata.

This is a provenance gate only. It does not add real gameplay assets, real chat exports, OCR accuracy evidence, provider trials, or end-to-end live extraction proof.
