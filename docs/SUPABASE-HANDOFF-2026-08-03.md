# ChatXPT Supabase Foundation Handoff — 3 August 2026

**Owner:** Role 1 (`Dewflash`)

**Pass:** R1-P04 implementation foundation, merged to `main` in [PR #12](https://github.com/Dewflash/chatxpt/pull/12)

## Outcome

ChatXPT now has one production-shaped persistence/realtime boundary instead of a Supabase placeholder. The existing Role 1 orchestrator can use either the credential-free memory runtime or the server-only Supabase runtime without changing Role 2/3 engine contracts or Role 4/5 view/command contracts.

## Implemented

- Hybrid relational plus versioned JSONB schema for profiles, sessions, quest cycles, immutable candidate batches, command receipts, accepted participation facts, quest events, lifecycle operations, access grants, and role snapshots.
- Atomic command RPC with global command-ID serialisation, expected-revision compare-and-swap, receipt/event/participation persistence, and duplicate/stale results.
- One active preparing/live session per broadcaster, eight-character room-code uniqueness, two-hour preparing expiry, heartbeat-driven unlimited live duration, and non-extending ten-minute reconnect grace.
- Broadcaster, moderator, viewer/anonymous, and system command policy plus read-only overlay/realtime access classes.
- RLS on every ChatXPT table, revoked direct client table access, service-role-only write RPCs, and no client broadcast policy.
- Private `chatxpt:<session>:<role>` snapshot broadcasts protected by short-lived server-managed Supabase principal grants.
- Shared viewer snapshot sanitisation that removes viewer identity, personal session points, and accepted vote choice before persistence or broadcast.
- Subscribe-first reconnect logic, latest authorised snapshot fetch, revision ordering, token refresh, and malformed-payload rejection.
- Current Supabase JS/CLI dependencies, committed CLI configuration/migration/seed, environment validation, health probe, and `server-only` import protection.
- Credential-free in-memory implementations of the same persistence, lifecycle, candidate, snapshot, and access-grant ports.

## How each role consumes it

- **Role 1:** compose `resolveServerPersistenceEnvironment` and `createConfiguredPersistenceRuntime` from `@/realtime/server`, then bind the result with `bindPersistenceRuntime` from `@/realtime`. Role 1 remains the only owner of API routes, authentication mapping, access grants, migrations, and secrets.
- **Role 2:** store/read candidate batches only through the public candidate repository supplied by Role 1. Do not import Supabase or persist raw chat/frames.
- **Role 3:** continue returning pure decisions/events. The orchestrator persists them; Role 3 does not import this persistence layer.
- **Roles 4/5:** continue emitting canonical commands and rendering role view models. Do not call product tables or write Supabase directly. Role 1's later thin routes issue authorised snapshots/access grants; the browser-safe subscriber is available from `@/realtime`.

## Local start

With Supabase variables empty, server composition selects memory mode. This path is suitable for concurrent implementation and deterministic integration tests:

```bash
npm ci
npm run test:persistence
npm run check
```

For a local Supabase stack, install/start a Docker-compatible runtime and run:

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
```

## Shared preview activation still required

Role 1 must perform these external steps with the team-owned Supabase Free account:

1. Create/link the shared preview project without sharing credentials in Git or chat.
2. Configure URL, publishable key, and secret key in the server environment.
3. Apply the migration with a dry run followed by `supabase db push`.
4. Require private Realtime channels and enable the chosen Supabase Auth path, including anonymous Auth if the fallback viewer flow uses it.
5. Execute RLS tests as `anon`, authenticated principals with/without grants, and the server secret key.
6. Record a real two-client snapshot round trip, duplicate/stale command behavior, reconnect, grant expiry/revocation, and service/broadcast failure.

Those steps need external project credentials and a database runtime. Source, mocked adapter, or in-memory tests must not be presented as proof that the cloud project is configured.

## Evidence recorded in this pass

- `npm run test:persistence`: 7 test files and 38 persistence/realtime tests passed.
- `npm run check`: lint, TypeScript, ownership-boundary scan over 55 files/137 local imports, all 73 tests, and the optimized Next.js production build passed.
- `supabase/tests/database/foundation.test.sql` provides 20 pgTAP assertions for schema, RLS, privileges, policies, and server-only function execution; it is committed but not claimed as executed without a database runtime.
- Pinned Supabase CLI `2.111.0` executed successfully with `npx supabase --version`.
- No Docker-compatible runtime, linked Supabase project, or Supabase credentials were available in this workspace, so SQL execution, RLS execution, private WebSocket delivery, and two-browser cloud evidence remain explicitly unverified.

## Scope deliberately untouched

Twitch OAuth/Extension JWT mapping, OBS capture/overlay wiring, Role 2 extraction/AI, Role 3 mechanics, Role 4/5 UI, legacy route migration, Vercel deployment, raw-chat persistence, and public/non-Twitch platform APIs remain outside this pass.
