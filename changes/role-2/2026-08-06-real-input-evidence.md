# Prepare real-input extraction evidence

- **Type:** Added
- **Role:** Role 2
- **Issue/PR:** #70 / draft PR #72
- **Summary:** Added an evidence report for authorised OBS measurements plus the approved conservative universal-visual policy, bounded OCR preprocessing/confirmation, processing latency, sanitised audience coverage, and explicit unknown behaviour.
- **Integration impact:** Role 1's canonical `FrameSource` remains the only capture input. The report can consume the pending browser OBS source after Role 1 merges it; Tesseract.js dependency review is tracked in issue #70; no shared contract changed.
- **Verification:** Focused extraction tests pass 23 cases, canonical contract tests pass 18 cases, `npm run check` passes 26 test files/214 tests plus lint, typecheck, boundary/evidence validation, and the production build; `git diff --check` passes.
- **Reality status:** Current automated tests use diagnostic-shaped fixture data only. No real OBS frame, OCR engine, authorised gameplay/chat sample, resource run, or live evidence is claimed by this change.
