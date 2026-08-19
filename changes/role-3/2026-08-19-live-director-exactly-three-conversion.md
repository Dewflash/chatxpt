# Route Director Cues through exactly-three validation

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** #150 / #157
- **Summary:** Converts an authorised private Director Cue into exactly three validated proposal options for streamer approval, or a typed no-publication result when the safe path cannot complete.
- **Integration impact:** Exposes `DefaultDirectorCueConverter` through the Role 3 public entry point. It reuses existing canonical candidate, quest state, command, validation, and engine seams without changing Core contracts or publishing directly to viewers.
- **Verification:** Focused conversion tests pass 15 cases; the affected conversion/validation/cue/engine plus Role 1 entrypoint/orchestrator set passes 6 files / 129 tests; `npm.cmd run check` passes 82 files / 646 tests, the production build, boundary/evidence/runbook gates, and client-secret scans.
- **Reality status:** Deterministic fixture-only component evidence. No real Twitch, OBS, OpenAI provider, Supabase Cloud, UI, or Role 1 runtime was exercised.
