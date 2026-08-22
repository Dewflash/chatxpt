# Add reviewable streamer speech context

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Full Studio can listen for a streamer-spoken goal or broad activity, show the browser transcript and confidence, and use it as the Current Objective only after explicit streamer review.
- **Integration impact:** Adds backward-compatible `inputMethod` and `confidence` fields to declared-intent commands/state; Role 4 consumes the browser adapter and Role 1 preserves the evidence through Live Director composition.
- **Verification:** Focused speech adapter, command, contract, Live Director, Studio render, and authorised server-session suite passed 6 files / 69 tests. `git diff --check` and full `npm run check` passed with 83 files / 672 tests, lint, TypeScript, role boundaries, hygiene/evidence/runbook checks, production build, and client-secret scan.
- **Reality status:** Production source uses the browser's available local or remote speech recognition service and stores no raw microphone audio. Automated evidence uses a fake browser recognizer; real microphone permission, transcript accuracy, vendor processing, and stream-time behaviour are not yet proven.
