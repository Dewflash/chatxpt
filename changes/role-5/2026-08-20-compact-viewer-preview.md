# Keep sidequests primary in the compact viewer

- **Type:** Changed
- **Role:** Role 5
- **Issue/PR:** pending
- **Summary:** The Twitch Extension now keeps only Vote and authoritative status in its compact fixed action area, while community hype, private session points, and reactions remain available in secondary scrollable content. A fixture-only diagnostic route renders every current streamer, viewer, fallback, and overlay interface for consistent visual review.
- **Integration impact:** Adds the shared thin `/diagnostics/interfaces` route and preserves the existing `@/streamer`, `@/viewer`, and `@/design-system` public seams without contract changes.
- **Verification:** Focused viewer and role-entrypoint tests passed 2 files / 33 tests; `npm run check` passed 82 files / 666 tests plus lint, TypeScript, role boundaries, evidence/runbook checks, production build, and client-secret scan; local production snapshots at the accepted target viewports reported zero horizontal overflow.
- **Reality status:** Production components rendered from canonical fixture data in a local Next.js production server. This is not real Twitch, Supabase Cloud, multi-viewer, gameplay, or OBS Browser Source evidence.
