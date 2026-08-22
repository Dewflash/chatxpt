# Show the viewer-selection countdown in Desktop Live Director

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** pending
- **Summary:** During an Automatic viewer vote, the compact Desktop Live Director now shows `Selection · m:ss` directly in Quest status and updates it live until the authoritative state advances.
- **Integration impact:** No contract change. The UI derives the display from the existing server-supplied quest-cycle deadline and does not close voting, choose a winner, or advance lifecycle state.
- **Verification:** `npm run test -- src/streamer/persistent-stream-overlay.test.ts` passed 1 file / 9 tests; scoped ESLint and `npm run typecheck` passed.
- **Reality status:** Canonical fixture and source verification only. The packaged owner-linked companion still needs a real Automatic voting-window check.
