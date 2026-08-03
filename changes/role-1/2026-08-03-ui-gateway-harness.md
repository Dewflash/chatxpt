# Add the browser-safe UI gateway and diagnostic harness

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** UI-X01 #17, UI-X02 #18, UI-X05 #21; PR pending
- **Summary:** Added typed browser read/command contracts and client, setup readiness, six explicitly fixture-only local hosts, reproducible auth/failure scenarios, and shared component/browser verification.
- **Integration impact:** Roles 4 and 5 can mount their public components through Role 1 routes and receive injected safe state/commands without importing authentication, persistence, realtime internals, or shared test configuration. D-055/D-056 remain R1-016 implementation work.
- **Verification:** `npm run test:ui` (19 focused tests); `npm run test:e2e` (eight Chromium flows and screenshot); `npm run check` (14 files/92 tests plus production build); `npm audit` (zero vulnerabilities); `git diff --check`; production start with the diagnostic flag deliberately enabled still returned 404 for both page and API.
- **Reality status:** The gateway contract and browser transport are real code. The local service, identities, state, failures, and screenshot are permanently fixture/diagnostic-only; Twitch, OBS, Supabase cloud, live authentication, Role 4 UI, and Role 5 UI are not claimed.
