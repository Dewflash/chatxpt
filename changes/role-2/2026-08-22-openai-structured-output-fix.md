# Fix OpenAI structured-output schema compatibility

- **Type:** Fixed
- **Role:** Role 2
- **Issue/PR:** pending
- **Summary:** Removed the unsupported `uniqueItems` keyword from the strict OpenAI candidate schema while preserving runtime rejection of duplicate signal citations, then aligned provider rationale instructions with Role 3's evidence gate.
- **Integration impact:** The public candidate contract and production 8-second fallback policy are unchanged; only the Role 2 provider transport schema is corrected.
- **Verification:** The focused OpenAI candidate-strategy suite passed 16 tests, and `npm run check` passed lint, TypeScript, boundaries, evidence and hygiene checks, 844 Vitest tests, the production build, and client-secret scanning.
- **Reality status:** One owner-authorised provider-only Brawl Stars recording diagnostic returned exactly three `gpt-5.6-terra` candidates in 5,091 ms without sending frames/chat/identities or accepting fallback. Role 3 accepted two and rejected one as `unknown-dependent`, so this is partial diagnostic evidence rather than a passing production-quality claim. The resulting prompt refinement has automated coverage but has not received another provider call.
