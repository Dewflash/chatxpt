# Fix OpenAI structured-output schema compatibility

- **Type:** Fixed
- **Role:** Role 2
- **Issue/PR:** pending
- **Summary:** Removed the unsupported `uniqueItems` keyword from the strict OpenAI candidate schema while preserving runtime rejection of duplicate signal citations.
- **Integration impact:** The public candidate contract and production 8-second fallback policy are unchanged; only the Role 2 provider transport schema is corrected.
- **Verification:** The focused OpenAI candidate-strategy suite passed 16 tests, and `npm run check` passed lint, TypeScript, boundaries, evidence and hygiene checks, 844 Vitest tests, the production build, and client-secret scanning.
- **Reality status:** Source and automated fixture evidence only. One provider-only local diagnostic reached the 8-second timeout without output or usage metadata; no fallback was accepted as AI and no successful provider-output claim is made by this change.
