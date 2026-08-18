# Open cross-role collaboration

- **Type:** Changed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Contributors may now implement in any role directory or shared file without prior role-owner approval. Role leads remain responsibility advisers, and Role 1 actively helps deconflict overlapping branches before merge.
- **Integration impact:** Supersedes exclusive file ownership, mandatory pre-implementation cross-role handoffs, and role-based review gates across all five roles while preserving module responsibilities, public import boundaries, safety rules, checks, evidence, and final integration review.
- **Verification:** Documentation consistency audit; `git diff --check`; and the full `npm run check` equivalent executed through the bundled Node runtime because global `npm` was unavailable (lint, TypeScript, boundary/evidence/runbook checks, 557 tests, production build, and client-secret scan all passed).
- **Reality status:** Repository workflow and authority documentation only; no product runtime behaviour changed.
