# Publish the deterministic Live Director handoff

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** #150 / #160
- **Summary:** Adds a failure-oriented Live Director evaluation and stable public handoff covering every cue action, exactly-three private conversion, recovery, invalidation, cooldown, replay, and game-neutral fallback behaviour.
- **Integration impact:** No Core contract changes. Role 1 can compose the documented suitability, cue lifecycle, conversion, resolved-history, and existing quest-engine seams while retaining authentication, revisions, persistence, scheduling, provider invocation, projection, and broadcast authority.
- **Verification:** Focused cue suitability, lifecycle, conversion, evaluation, and Role 1 entrypoint tests pass 5 files / 109 tests. `npm.cmd run check` passes 82 files / 666 tests, the production build, boundary/evidence/runbook gates, and client-secret scans.
- **Reality status:** Deterministic fixture-only component evidence. No real Twitch, OBS, OpenAI provider, Supabase Cloud, UI, or Role 1 runtime was exercised.
