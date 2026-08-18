# Explain the ChatXPT architecture and major files

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Adds a source-grounded codebase guide covering the canonical architecture, retained prototype path, completed management/participation/OBS routes, end-to-end data flow, ownership model, and the purpose of each major implementation file.
- **Integration impact:** Documentation only; no contracts, runtime behaviour, or role-owned implementation changed.
- **Verification:** The equivalent full gate passed: lint, typecheck, role boundaries, evidence/runbook checks, 557 Vitest tests across 79 files, Next.js production build, built-client secret scan, and `git diff --check`. The immutable production build also passed the memory-backed canonical runtime smoke recorded as `E-20260818-R1-001`.
- **Reality status:** The guide distinguishes mounted, implemented, diagnostic, production-shaped, partial, and externally unproven behaviour. It makes no new live-runtime claim.
