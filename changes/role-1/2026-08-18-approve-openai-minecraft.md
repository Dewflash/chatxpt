# Approve bounded server AI and Minecraft demo target

- **Type:** Changed
- **Role:** Role 1
- **Issue/PR:** #132 / #138
- **Summary:** Recorded owner approval for server-side OpenAI `gpt-5.6-terra` in the judged MVP and selected vanilla Minecraft as the calibrated demonstration target.
- **Integration impact:** Supersedes D-048 and D-055 plus conflicting provider-adoption/cost portions of D-014 and D-021. Keeps an 8-second strict structured-output boundary, credential-free algorithmic fallback, Role 3 deterministic authority, game-neutral contracts, and D-071 open contribution with Role 1 deconfliction.
- **Verification:** Full `npm run check`-equivalent sequence through the bundled Node runtime (lint, typecheck, boundary/evidence/runbook checks, 79 files/557 tests, production build, client-secret scan), `git diff --check`, active-authority contradiction scans, and GitHub issue/PR state updates.
- **Reality status:** Owner and documentation authority only. No credential was configured, no provider request was sent, no Minecraft OBS calibration was executed, and no live AI or extraction evidence is claimed.
