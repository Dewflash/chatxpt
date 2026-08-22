# Allow same-viewer repeated topics

- **Type:** Changed
- **Role:** Role 2
- **Issue/PR:** pending
- **Summary:** A topic may now qualify after two separate messages from the same Twitch account within the rolling window; repeating the word inside one message still counts once.
- **Integration impact:** Changes the audience aggregate consumed by Live Analytics and Live Director without changing the public schema.
- **Verification:** Focused audience-pipeline, Twitch-chat integration, and Live Analytics render suite passed 55 tests; scoped ESLint passed. Repository TypeScript is currently blocked by an unrelated concurrent missing `desktopDirector` field in `src/app/streamer-authorized-client.tsx`.
- **Reality status:** Source and deterministic test-fixture change; no real Twitch chat run has yet verified this refinement.
