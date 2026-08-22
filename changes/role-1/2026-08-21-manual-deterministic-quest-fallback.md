# Show a deterministic quest fallback immediately

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Generate quest now immediately creates exactly three safe deterministic fallback quests for streamer review before gameplay or audience evidence is available.
- **Integration impact:** Adds the broadcaster-only `streamer.quest-generation` command across the Core contract, Role 1 application seam, Role 3 engine boundary, and Role 4 Studio surface.
- **Verification:** `npm test -- src/streamer/streamer-commands.test.ts src/streamer/studio-product-pages.test.tsx src/app/server/studio-session.test.ts` (45 passed); `npm run typecheck` (passed). `npm run check` reached the full test suite with 809 passing and four failures in separate in-progress game-name validation and existing orchestrator fallback tests.
- **Reality status:** The immediate output is explicitly labelled deterministic fallback and contains no gameplay or audience evidence. Evidence-driven generation remains on the real trusted-input path and occurs later.
