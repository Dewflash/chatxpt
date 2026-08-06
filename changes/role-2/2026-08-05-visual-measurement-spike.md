# Add bounded visual and OCR measurement plumbing

- **Type:** Added
- **Role:** Role 2
- **Issue/PR:** #55
- **Summary:** Added a game-neutral pixel-change measurement stream over the canonical ephemeral frame source plus selective-region OCR adapter plumbing.
- **Integration impact:** Role 1's browser OBS source can be injected after its capture branch merges; no canonical contract or another role's implementation changed.
- **Verification:** `npm test -- src/extraction src/ai` passes 29 tests, `npm run test:contracts` passes 18 tests, and `npm run check` passes 23 test files/184 tests plus the production build; `git diff --check` passes.
- **Reality status:** The algorithms are implemented, but current tests use synthetic pixel arrays and a fake OCR adapter. No authorised gameplay/chat asset, actual OCR engine, browser-delivered OBS frame, or live extraction result is claimed.
