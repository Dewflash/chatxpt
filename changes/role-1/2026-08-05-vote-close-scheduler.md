# Add the vote-close scheduling spine

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** #42 / pending
- **Summary:** ChatXPT can find every live voting cycle whose deadline has passed and issue a trusted, deterministic `system.vote-close` command without giving clients system authority.
- **Integration impact:** Adds the `DueVoteCycleReader` persistence port, service-role-only Supabase due-cycle RPC, memory/Supabase adapters, and `VoteCloseScheduler`. This is stacked on PR #45 and still delegates winner and lifecycle policy to Role 3.
- **Verification:** `npm run check` passed: lint, TypeScript, role boundaries, 133 tests, and the Next.js production build.
- **Reality status:** The deadline sweep and adapters execute in automated tests. No Vercel Cron, long-lived worker, gateway wake-up endpoint, or live Supabase execution is claimed yet.
