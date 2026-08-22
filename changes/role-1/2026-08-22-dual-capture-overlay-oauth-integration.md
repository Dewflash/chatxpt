# Dual capture, permanent OBS overlay, and OAuth integration

- Reconciled current `main` with the active Studio, gameplay, AI, quest, and reset work without restoring session-specific OBS overlay links.
- Gameplay Capture now offers both direct browser screen/window selection and OBS Virtual Camera input.
- Preserved the permanent broadcaster-linked OBS Browser Source: the server resolves the broadcaster's current active session, while unauthenticated and wrong-broadcaster reads remain rejected.
- Hardened Twitch OAuth callback errors and Studio recovery. Twitch credentials remain local in ignored `.env.local` files and are never part of this change.
- Verified the configured Twitch client credentials with a successful app-token response and verified that local OAuth starts with the exact HTTPS callback registered for the app.

Evidence: focused integration tests passed (69 tests), `npm run check` passed (107 files, 842 tests, production build, boundary and secret scans), and `git diff --cached --check` passed before handoff. The final Twitch authorization click and real operator selection of each capture mode remain live browser checks rather than automated evidence.
