# Adapt intervention timing to streamer intensity

- **Type:** Changed
- **Role:** Role 3
- **Issue/PR:** pending stacked PR
- **Summary:** Quest proposals now wait for quieter, stronger opportunities at low streamer intensity and tolerate more active moments at high intensity while preserving the neutral legacy default.
- **Integration impact:** No shared contract changed. Role 1 already supplies the saved streamer profile through the accepted intervention seam.
- **Verification:** `npm.cmd test -- src/quest-engine/intervention.test.ts` passes 17 tests; `npm.cmd run check` passes lint, typecheck, role boundaries, evidence/runbook checks, 415 tests, the production build, and both client-secret scans. The first restricted build attempt hit a Windows `.next` file-lock error; the approved rerun completed.
- **Reality status:** Deterministic fixture/component evidence only. No live gameplay, Twitch, OBS, or persisted-profile run is claimed.
