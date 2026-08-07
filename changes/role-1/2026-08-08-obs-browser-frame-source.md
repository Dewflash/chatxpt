# Add OBS browser frame source and overlay descriptor

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Added a browser-side OBS Virtual Camera `FrameSource` adapter that can select the labelled OBS camera, wrap an authorised `MediaStream`, emit canonical ephemeral gameplay-frame observations, and release captured frame images after consumers finish. Added a read-only OBS Browser Source descriptor for transparent overlay URLs with opaque overlay access tokens and safe redaction.
- **Integration impact:** Role 2 can consume the existing `FrameSource` contract through a Role 1-owned browser adapter without importing OBS or browser details. The adapter keeps raw video inside the browser/capture boundary and exposes only normalised `GameplayFrameObservation` metadata plus an ephemeral image handle. Role 5/OBS output can use the descriptor contract for read-only overlay mounting without reusing streamer/viewer command credentials.
- **Verification:** `npm run test -- src/integrations/obs/browser-frame-source.test.ts src/integrations/obs/browser-source.test.ts tests/integration/role-entrypoints.test.ts`.
- **Reality status:** Fixture-labelled fake browser media/canvas and URL-construction evidence only. No real OBS Virtual Camera device selection, permission recovery, real-frame sampling, Role 2 extraction run, or OBS Browser Source render is claimed yet.
