# Publish Live Director proposals through one authority

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** #150; pending
- **Summary:** Turning a Director Cue into a vote now reaches exactly three private streamer-review options through the configured candidate provider and deterministic quest authority.
- **Integration impact:** Adds a public proposal-coordinator port, composes Role 2 generation and Role 3 conversion in the server runtime, commits cue/proposal state in one revision, and strips private rationale/evidence/confidence/provider metadata from Viewer and OBS quest projections.
- **Verification:** `npm.cmd run test:orchestrator` (25 tests); focused 9-file contract/orchestrator/persistence/viewer/hosted-board/UI-gateway/OBS suite (95 tests); `npm.cmd run check` (82 files / 668 tests, production build, boundaries, evidence, runbook, and client-secret gates passed).
- **Reality status:** Fixture-only integration evidence. Provider-unavailable deterministic fallback and missing-gameplay no-publication are exercised; real Twitch, OBS, OpenAI, Supabase, and golden-workflow execution are not claimed.
