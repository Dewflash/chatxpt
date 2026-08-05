# Add bounded visual and OCR measurement plumbing

- **Type:** Added
- **Role:** Role 2
- **Issue/PR:** PR pending
- **Summary:** Added a game-neutral pixel-change measurement stream over the canonical ephemeral frame source plus selective-region OCR adapter plumbing.
- **Integration impact:** Role 1's browser OBS source can be injected after its capture branch merges; no canonical contract or another role's implementation changed.
- **Verification:** Ten focused visual/OCR tests pass. `npm run check` passes with 20 test files and 143 tests plus the production build; `git diff --check` passes.
- **Reality status:** The algorithms are implemented, but current tests use synthetic pixel arrays and a fake OCR adapter. No authorised gameplay/chat asset, actual OCR engine, browser-delivered OBS frame, or live extraction result is claimed.
