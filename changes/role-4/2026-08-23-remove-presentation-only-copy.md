# Remove redundant generation helper copy

- Type: Changed
- Role: Role 4
- Issue/PR: pending
- Summary: Removes the "Presentation only" helper beneath the Live Quests generation selector while preserving the existing deterministic fallback behavior.
- Integration impact: None; this is streamer-facing copy and its rendering assertion only.
- Verification: `npm.cmd test -- --run src/streamer/studio-product-pages.test.tsx` (47 tests passed); `npm.cmd run check` (123 files and 1,034 tests passed, production build passed).
- Reality status: UI copy only; no runtime behavior or live-evidence status changed.
