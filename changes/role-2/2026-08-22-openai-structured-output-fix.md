# Fix OpenAI structured-output schema compatibility

- **Type:** Fixed
- **Role:** Role 2
- **Issue/PR:** PR #168 plus follow-up pending
- **Summary:** Removed the unsupported `uniqueItems` keyword from the strict OpenAI candidate schema while preserving runtime duplicate rejection, aligned provider instructions with Role 3's evidence and duration gates, and disabled the OpenAI SDK's default retries.
- **Integration impact:** The public candidate contract and production 8-second fallback policy are unchanged. The Role 2 provider transport now enforces D-072's actual one-attempt limit, and generated durations receive the same difficulty ranges Role 3 validates.
- **Verification:** The owner-authorised production-parameter request completed inside the timeout and exposed the duration mismatch. The post-fix provider suites pass 17 focused tests; `npm run check` passes lint, TypeScript, boundaries, evidence and hygiene checks, 845 Vitest tests across 108 files, the production build, and client-secret scanning.
- **Reality status:** Two owner-authorised provider-only Brawl Stars recording diagnostics returned exactly three `gpt-5.6-terra` candidates without sending frames/chat/identities or accepting fallback. The production-parameter run completed in 6,733 ms with one attempt, low reasoning, `store: false`, no SDK retries, and an 8-second limit. Role 3 accepted two and rejected one as `difficulty-mismatch`, so this remains partial diagnostic evidence rather than a passing production-quality claim. No third provider call was made after the prompt refinement.
