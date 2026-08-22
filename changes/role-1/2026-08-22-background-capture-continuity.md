# Keep OBS capture alive across delayed frames

- **Type:** Fixed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Gameplay Capture no longer disconnects OBS when browser background scheduling makes a queued frame older than the live-ingress window. It drops that obsolete frame, keeps the media feed and local analyser running, refreshes authority when needed, and resumes server delivery with the next fresh frame.
- **Integration impact:** Adds a recoverable `stale-snapshot` gameplay-ingress response and client delivery policy; no gameplay, quest, or capture contracts change.
- **Verification:** `npm run check` passes with 115 test files / 893 tests, production build, boundary/hygiene/evidence checks, and client secret scan. Focused recovery tests cover the 20-second delayed-frame case, revision races, older snapshots, throttling, transient authorization, and permanent failures.
- **Reality status:** The failure and recovery boundary is covered with automated clocks and response fixtures. A fresh owner-operated OBS Virtual Camera run is still required for real-device confirmation.
