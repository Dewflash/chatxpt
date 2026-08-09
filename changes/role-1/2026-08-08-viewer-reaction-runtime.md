# Record authorised viewer reactions as community hype

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Added a runtime path for authorised `viewer.react` commands so reactions publish a fresh authoritative revision, increment server-owned community hype, and broadcast updated role views without invoking Role 3 quest lifecycle logic.
- **Integration impact:** Role 5 can wire its optional reaction dispatcher to the canonical command path without owning reaction acceptance, storage, revision, or hype authority. Reactions remain gated by the existing server authorizer and session capability checks.
- **Verification:** `npm run test -- tests/integration/orchestrator.test.ts tests/integration/permissions.test.ts`.
- **Reality status:** Fixture/memory runtime evidence only. No real Twitch Extension identity, Supabase realtime write, multi-viewer reaction run, or OBS Browser Source evidence is claimed.
