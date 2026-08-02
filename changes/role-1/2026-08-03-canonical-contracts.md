# Implement version-one canonical contract foundation

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** #6
- **Summary:** Added versioned platform-neutral schemas and public ports for envelopes, provenance/unknown signals, capabilities, profiles, sessions, candidates, lifecycle state, commands, votes, errors, view models, and role boundaries.
- **Integration impact:** Roles 2-5 can compile against `@/core` and explicitly non-live fixtures from `@/core/testing`; legacy runtime imports remain unchanged until the mechanical migration gate is resolved.
- **Verification:** `npm run test:contracts`, `npm run typecheck`, `npm run lint`, `git diff --check`, and full `npm run check` before merge.
- **Reality status:** Contract fixtures are synthetic and marked `fixture`; they prove schema compatibility only and are not gameplay, Twitch, AI, or end-to-end evidence.
