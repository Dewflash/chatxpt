# Make five-role integration an explicit build contract

- **Type:** Changed
- **Role:** Role 1
- **Issue/PR:** #5
- **Summary:** Added the binding cross-role integration contract, named Role 1's application orchestrator, and required public ports, canonical fixtures, producer/consumer tests, revisioned realtime, risk-first spikes, and integration after every wave.
- **Integration impact:** Roles 1-5 now build through explicit seams and public entry points; Role 2's Role 4/5 plans must be synchronised and include view models, commands, fixtures, mounts, evidence, and an early design-system handoff; game support is tiered and capability-aware.
- **Verification:** Authority, architecture, build plans, role guides/TODOs, CODEOWNERS, onboarding, PR template, submission criteria, and decisions checked together; `git diff --check` and `npm run check` run before merge handoff.
- **Reality status:** These are real team authority and integration requirements. The current runtime remains the separately documented legacy prototype; this change does not claim Twitch, OBS extraction, Supabase, or the new orchestrator is already implemented.
