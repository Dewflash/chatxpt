# Add Studio integrations technical health

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** #96
- **Summary:** Adds a fixture-only Studio Integrations technical health surface under `@/streamer`, mounted at `/studio` and `/studio/integrations`, with owner-approved configured/not-configured/not-ready/degraded status language for Twitch, OBS, extraction, AI, quest engine, viewer surfaces, Supabase, and Vercel.
- **Integration impact:** Role 4 now has a Studio health surface that consumes the public design-system root/components/tokens and exposes `StudioIntegrationHealthPanel` as a Role 1 mount wrapper. Role 1 can later replace the fixture view with runtime health data without giving Role 4 backend, deployment, Twitch, OBS, AI, extraction, persistence, or lifecycle authority.
- **Verification:** `npm run test -- src/design-system/design-system.test.ts src/streamer/integration-health-model.test.ts src/streamer/studio-integrations-render.test.ts tests/integration/role-entrypoints.test.ts`; `npm run typecheck`; `git diff --check`; `npm run check`.
- **Reality status:** Fixture-only UI/runtime evidence plus local source/test/build proof. No real Twitch, OBS, Supabase, Vercel, AI provider, extraction, or multi-client evidence is claimed.
