# Add the real OBS Virtual Camera capture spine

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** R1-007 / PR #35
- **Summary:** Adds explicit browser discovery and selection of OBS Virtual Camera, ephemeral frame delivery through `FrameSource`, capture provenance/status, resource cleanup, and a production-disabled real-input diagnostic.
- **Integration impact:** Role 2 receives real timestamped `ImageBitmap` frames without owning browser permission or media lifecycle. Role 4 may later mount the public capture boundary in Studio. No extraction algorithm, gameplay fact, quest rule, or Role 4/5 product UI is implemented.
- **Verification:** Ten focused adapter and diagnostic-state tests cover device recognition, real-source observation shape, explicit and automatic bitmap release, permission failure/timeout, abort while permission is pending, late-stream cleanup, stale state, serialised diagnostic controls, typed retryability, and track cleanup. `npm run check` passes 83 tests plus lint, type, role-boundary, and production-build checks.
- **Reality status:** The adapter and diagnostic are real code; tests use controlled browser API doubles. OBS Studio 32.2.1's macOS Camera Extension is enabled and its log confirms the Virtual Camera output started. Browser camera permission and receipt of an actual frame remain unverified, so no real-frame or gameplay evidence is claimed yet. No raw frame is persisted and missing gameplay facts remain unknown.
