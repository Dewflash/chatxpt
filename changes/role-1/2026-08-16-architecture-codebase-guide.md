# Explain the ChatXPT architecture and major files

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Adds a source-grounded codebase guide covering the canonical architecture, current mounted prototype path, end-to-end data flow, ownership model, routes, and the purpose of each major implementation file.
- **Integration impact:** Documentation only; no contracts, runtime behaviour, or role-owned implementation changed.
- **Verification:** `npm run check` passed: lint, typecheck, role boundaries, evidence/runbook checks, 394 Vitest tests across 53 files, production build, and built-client secret scan. `git diff --check` is run again after staging.
- **Reality status:** The guide distinguishes mounted, implemented, diagnostic, production-shaped, partial, and externally unproven behaviour. It makes no new live-runtime claim.
