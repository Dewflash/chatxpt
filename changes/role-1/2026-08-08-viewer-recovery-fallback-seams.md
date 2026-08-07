# Add viewer recovery and fallback participation seams

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** R1-016 / pending PR
- **Summary:** Adds canonical schemas for hosted-board discovery, private per-viewer recovery, and Twitch-chat vote acknowledgement statuses. The in-memory persistence runtime can now resolve active hosted-board room codes and restore only the matching viewer's accepted vote/points by session-scoped voter key.
- **Integration impact:** Role 5 can render hosted fallback access, reconnect recovery, and chat fallback acknowledgement states without parsing Twitch chat, owning vote authority, or leaking another viewer's private participation state. Shared viewer broadcasts continue to strip viewer identity, accepted choice, points, private recovery, and accepted chat command details.
- **Verification:** `npm run test -- src/core/contracts.test.ts tests/integration/persistence.test.ts tests/integration/role-entrypoints.test.ts`
- **Reality status:** Contract and memory-runtime evidence only. No Supabase cloud round trip, real Twitch chat ingestion/delivery, Twitch Extension identity, or two-browser live recovery run is claimed by this change.
