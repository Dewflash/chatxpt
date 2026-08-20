## Summary

- Added the privacy-safe session history snapshot contract and fixture.
- Added memory and Supabase session history readers that derive terminal quest summaries from accepted command receipts.
- Downgraded mixed or non-live receipt evidence to `diagnostic` at the snapshot level instead of overclaiming live history.
- Kept raw chat, viewer identifiers, and private vote receipts out of the history model.

## Verification

- `npm run test -- src/core/contracts.test.ts tests/integration/persistence.test.ts tests/integration/supabase-adapters.test.ts` was covered by the 20 August repository consistency rerun; the encompassing seven-file run passed 94 tests, and full `npm run check` passed 82 Vitest files / 666 tests plus the production build.
