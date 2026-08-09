# Add browser-safe UI gateway harness

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** R1-015 / pending
- **Summary:** Added a fixture-only UI gateway snapshot, diagnostic JSON endpoint, command-envelope validation endpoint, and `/diagnostics/ui-harness` browser page for checking that streamer, viewer, and overlay clients share the same canonical session, quest-cycle, revision, and command boundary.
- **Integration impact:** Roles 4 and 5 can now target a Role 1-owned browser-safe fixture while their final UI surfaces remain owner-controlled. The command validator covers canonical command shape and stale-revision failure without pretending to persist votes, resolve lifecycle, or broadcast realtime state.
- **Verification:** `npm run test -- src/core/application/ui-gateway.test.ts tests/integration/role-entrypoints.test.ts tests/integration/ui-gateway-routes.test.ts`; `npm run typecheck`; `npm run check`; local dev route checks returned `GET /api/ui-gateway/fixture 200` and `HEAD /diagnostics/ui-harness 200`.
- **Reality status:** Fixture and diagnostic route evidence only. This does not prove live Twitch, OBS capture, Supabase realtime, AI/provider execution, two-viewer voting, or production deployment.
