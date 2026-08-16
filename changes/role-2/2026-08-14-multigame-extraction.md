# Add an unknown-safe multi-game vision spine

- **Type:** Added
- **Role:** Role 2
- **Issue/PR:** pending
- **Summary:** Add isolated generic, Brawl Stars, and Minecraft profiles with bounded luminance/colour/spatial motion analysis, adaptive cadence, conservative Brawl/Minecraft HUD capability detection, recording replay calibration, selective browser OCR composition, canonical gameplay projection, and an explicitly enabled structured-output LLM strategy with algorithmic fallback.
- **Integration impact:** Consumes Role 1's existing canonical `FrameSource`; no shared contract change. Role 2 review remains required before merge because the project-owner-directed pass changes Role 2 implementation.
- **Verification:** Focused multi-game extraction tests, TypeScript, lint, role-boundary check, full tests, and production build; final results recorded at handoff.
- **Reality status:** Algorithms and integration boundaries are fixture-tested; authorised Brawl recordings were executed as local diagnostic replay only. OBS Virtual Camera started, but macOS denied the selected browser camera permission before a frame crossed the diagnostic seam. No paid LLM call, real OBS frame sampling, vanilla/modded Minecraft run, calibrated health/hunger/timer/score/outcome value, or live-accuracy evidence is claimed.
