# Enforce authoritative command orchestration

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Added the application orchestrator and injected ports for authorization, candidate lookup, pure engine decisions, atomic revision commits, view projection, and post-commit broadcast.
- **Integration impact:** Role 2 candidate batches and Role 3 decisions now have one tested path into Role 1 authoritative state; Roles 4/5 receive validated same-revision view models.
- **Verification:** Focused orchestration tests, `npm run check`, and `git diff --check` before merge.
- **Reality status:** The repository, authorizers, clock, engine scripts, projector, and publishers used here are fixture-only test harnesses. They prove ordering/idempotency/recovery semantics but not Supabase, real permissions, Twitch, OBS, AI, or live end-to-end behavior.
