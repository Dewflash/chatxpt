# Authenticate normalised gameplay ingress

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Added the shared production server composition root, canonical view projector, a server-side setup-key exchange for short-lived capture grants, and a bounded endpoint for canonical OBS-derived gameplay snapshots.
- **Integration impact:** Role 2 snapshots can enter the same memory/Supabase latest-state repository that the Role 1 orchestrator hydrates at command time; raw frames, fixture evidence, stale authority, cross-session payloads, and unbounded burst traffic fail closed.
- **Verification:** Focused grant/ingress/persistence/orchestrator boundary run passed 40 tests; `npm run check` passed 61 files / 445 tests, production build, evidence checks, role boundaries, and client-secret scan.
- **Reality status:** Authentication and ingestion are fixture-tested. No real browser, OBS frame, Twitch session, Supabase project, or live evidence is claimed by this pass.
