# Enforce repository hygiene and expose the canonical smoke

- **Type:** Changed
- **Role:** Role 1
- **Issue/PR:** direct `main` integration under D-076
- **Summary:** Added a stable `npm run smoke` entry point and a repository-hygiene gate, corrected stale verification records, replaced a pass-specific resume snapshot with a current-queue pointer, and reconciled the live pull-request queue with Git ancestry and dry-run evidence.
- **Integration impact:** `npm run check` now rejects tracked local/build artifacts, broken relative Markdown links, and merged change fragments that still claim verification is pending. README and codebase guidance document the commands and previously omitted server-only Twitch/hosted-board variables. Stale PRs #139/#141/#144 are closed with branches preserved; substantial conflicting PR #149 stays open with an explicit rebuild/reconciliation warning.
- **Verification:** `npm run check:hygiene` and its three failure-mode tests passed; seven focused Core/Role 1 producer-consumer files passed 94 tests; `npm audit --omit=dev --audit-level=high` found zero vulnerabilities; full `npm run check` passed 82 Vitest files / 666 tests plus lint, TypeScript, 251-file/690-import boundaries, evidence/runbook checks, production build, and client-secret scan. A clean-clone PR #149 dry-run merge was aborted after enumerating 14 conflicts, and the temporary clone was removed.
- **Reality status:** Source, repository, fixture, and local automated verification only. The smoke remains memory-backed and does not prove real Twitch, OBS camera, Supabase Cloud, deployment, or provider execution.
