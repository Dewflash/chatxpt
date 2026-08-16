# Add a fail-closed OBS extraction diagnostic

- **Type:** Added
- **Role:** Role 1 integration override
- **Issue/PR:** pending
- **Summary:** Compose the canonical browser `FrameSource` with Role 2's public multi-game analyzer in a clearly labelled local diagnostic, and require exact OBS Virtual Camera selection after browser permission reveals device labels.
- **Integration impact:** No shared contract change. The route remains diagnostic, retains no raw frames, and does not write authoritative session or quest-progress state.
- **Verification:** OBS adapter tests, TypeScript, role-boundary check, production build, and real local page inspection. OBS 32.2.1 activated its Camera Extension and started Virtual Camera output; macOS denied the selected browser camera permission, so no frame sampling is claimed.
