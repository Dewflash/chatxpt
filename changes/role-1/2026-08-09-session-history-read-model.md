## Summary

- Added the privacy-safe session history snapshot contract and fixture.
- Added memory and Supabase session history readers that derive terminal quest summaries from accepted command receipts.
- Downgraded mixed or non-live receipt evidence to `diagnostic` at the snapshot level instead of overclaiming live history.
- Kept raw chat, viewer identifiers, and private vote receipts out of the history model.

## Verification

- Pending in this pass: focused persistence/Supabase tests and `npm run check`.
