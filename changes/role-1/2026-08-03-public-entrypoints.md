# Publish collision-free role entrypoints

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Reserved and documented public import boundaries for every role and added compatibility tests against canonical fixtures.
- **Integration impact:** Roles 2-5 can begin in exclusive directories without importing legacy internals or editing another role's files; the design-system entry remains deliberately empty for Role 4 to define.
- **Verification:** `npm run check`, role-entrypoint tests, and `git diff --check` before merge.
- **Reality status:** This is compile-time and schema compatibility evidence only; no Twitch, OBS, AI, quest behavior, UI, persistence, or realtime implementation is claimed.
