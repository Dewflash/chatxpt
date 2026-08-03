# Add the Supabase persistence and realtime foundation

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** [#12](https://github.com/Dewflash/chatxpt/pull/12)
- **Summary:** Add durable, revisioned session persistence with server-authoritative permissions, lifecycle recovery, sanitised role snapshots, and a credential-free local fallback.
- **Integration impact:** Role 1's existing orchestrator gains production persistence/realtime adapters while Roles 2-5 continue using the same public command and view contracts.
- **Verification:** `npm run test:persistence`, `npm run check`, `git diff --check`, pinned Supabase CLI version execution, migration/RLS static regression checks, and rigorous source/security review before pull request.
- **Reality status:** The schema, adapters, server/client boundary, memory fallback, lifecycle/permission behavior, tests, and production build are real code executed locally. No Docker-compatible runtime, linked Supabase project, or credentials were available, so migration/RLS execution and real two-client cloud realtime remain explicit follow-up evidence rather than claimed results.
