# Make Director Cue actions deterministic

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** #150 / #154
- **Summary:** Adds the pure Director Cue lifecycle for acknowledge, exactly-three conversion intent, one-resurface `Later`, dismiss, expiry, stale context, emergency, and session cancellation.
- **Integration impact:** Exposes `DefaultDirectorCueLifecycle` through the Role 3 public entry point for later Role 1 injection; canonical Core contracts are unchanged.
- **Verification:** Focused suitability/lifecycle/consumer tests pass 65 fixture-only cases; typecheck, focused lint, and `git diff --check` pass; `npm.cmd run check` passes 81 files / 625 tests plus the production build and all repository gates.
- **Reality status:** Deterministic fixture-only component evidence. No real Twitch, OBS, Supabase Cloud, provider, UI, or Role 1 runtime was exercised.
