# Operationalise concurrent Role 1-3 build plans

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Added detailed five-day execution plans for platform/integration, real gameplay intelligence, and the deterministic quest engine, including named owner decisions, pass acceptance evidence, and concurrent integration exits.
- **Integration impact:** Roles 1-3 now start together against thin contracts and owned fixtures; Role 2 first delivers Role 4/5 plans; all contributors and their agents must read the assigned execution plan and record settled decision gates there.
- **Verification:** Authority, onboarding, CODEOWNERS, role guides/TODOs, pull-request evidence, decision log, and real-data rules checked together; `git diff --check` and `npm run check` run before merge handoff.
- **Reality status:** The plans and workflow are real team authority. Existing simulated prototype inputs remain test/diagnostic fixtures; no product implementation or live extraction is claimed by this documentation change.
