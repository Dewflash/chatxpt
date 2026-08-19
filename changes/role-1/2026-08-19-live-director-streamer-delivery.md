# Deliver private Live Director streamer controls

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** #155
- **Summary:** Studio, Twitch Live Config, and a Studio-authorised compact pop-out/OBS Custom Dock now show Session Goal, Current Objective, source-separated private Live Context, and available Director Cue actions while preserving the existing exactly-three quest review.
- **Integration impact:** Adds a Role 1 `DirectorCueLifecycle` application port implemented by Role 3's public lifecycle, authenticated intent/cue command delivery, private dock setup guidance, and updated Role 4 streamer presentation through its public module.
- **Verification:** Focused server, command, streamer, orchestrator, and persistence tests pass (6 files / 65 tests); exact 420 px and 1440 px fixture browser renders have zero horizontal offenders; full repository gate passes 81 files / 631 tests plus lint, TypeScript, boundaries, evidence, production build, and client-secret scan.
- **Reality status:** Real source and memory-backed command integration with fixture-only browser evidence. No Twitch-issued JWT, real OBS dock/source, Supabase Cloud, real gameplay extraction, provider call, engagement effect, or solution-fit claim.
