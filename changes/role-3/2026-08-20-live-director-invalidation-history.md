# Stabilise Director Cue invalidation and recovery history

- **Type:** Changed
- **Role:** Role 3
- **Issue/PR:** #150 / #158
- **Summary:** Makes cue invalidation and exactly-three conversion fail closed for emergency, ended-session, impossible, stale-intent, expired-audience, safety, and changed-context conditions while ordinary gameplay changes remain non-terminal.
- **Integration impact:** Extends the Role 3 public cue reconciliation and history helpers without changing Core contracts. Role 1 may persist the returned privacy-safe resolved-cue summary and replay it after reconnect; duplicate replay cannot consume the attention budget twice.
- **Verification:** Focused cue lifecycle, conversion, intervention, quest engine/outcome, and Role 1 consumer tests pass 7 files / 194 tests. `npm.cmd run check` passes 82 files / 657 tests, production build, boundary/evidence/runbook gates, and client-secret scans.
- **Reality status:** Deterministic fixture-only component evidence. No real Twitch, OBS, OpenAI provider, Supabase Cloud, UI, or Role 1 runtime was exercised.
