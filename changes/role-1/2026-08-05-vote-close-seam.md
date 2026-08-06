# Add the authoritative vote-close seam

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** #42 / pending
- **Summary:** All Twitch MVP participation paths now share a private first-vote-final ledger and a trusted neutral command can deliver the final accepted tally to the quest engine without selecting a winner.
- **Integration impact:** `viewer.vote` now requires a server-verified opaque voter key and source mode; `system.vote-close` and `AcceptedVoteTallySnapshot` are new Core contracts. Role 3 must implement winner, tie, zero-vote, legality, and activation policy before the close command changes lifecycle state. The minimal Role 3 compatibility branch rejects the command until that implementation lands.
- **Verification:** `npm run check` passed: lint, TypeScript, role boundaries, 123 tests, and the Next.js production build.
- **Reality status:** The memory ledger and orchestration seam execute in tests. Supabase code and migration are statically verified but have not yet run against a live database. No UI, Twitch delivery, winner selection, or production scheduler is claimed.
