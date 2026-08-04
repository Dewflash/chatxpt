# Add the real OBS Virtual Camera capture spine

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** R1-007 / pending
- **Summary:** Adds explicit browser discovery and selection of OBS Virtual Camera, ephemeral frame delivery through `FrameSource`, capture provenance/status, resource cleanup, and a production-disabled real-input diagnostic.
- **Integration impact:** Role 2 receives real timestamped `ImageBitmap` frames without owning browser permission or media lifecycle. Role 4 may later mount the public capture boundary in Studio. No extraction algorithm, gameplay fact, quest rule, or Role 4/5 product UI is implemented.
- **Verification:** Seven focused adapter tests cover device recognition, real-source observation shape, explicit and automatic bitmap release, permission failure/timeout, stale state, abort, and track cleanup; `npm run check` passed 80 tests plus lint/type/boundary/build; local diagnostic returned 200; production-with-flag returned 404; a real in-app-browser permission attempt recovered truthfully after the bounded timeout.
- **Reality status:** The adapter and diagnostic are real code; tests use controlled browser API doubles. OBS Studio 32.2.1 was installed and loaded the macOS Virtual Camera module, but macOS reported that Camera Extension owner approval is required, so no real frame is claimed yet. No raw frame is persisted and missing gameplay facts remain unknown.
