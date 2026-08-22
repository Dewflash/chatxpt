# Route automatic setup to the packaged Desktop Director

- **Type:** Fixed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Automatic capture setup now opens and reveals `ChatXPT Live Director.app` instead of launching Electron's generic development welcome window.
- **Integration impact:** The macOS `chatxpt://` association is packaged-only. Source Electron runs repair a previously stolen generic-development association without reading or changing the encrypted broadcaster grant.
- **Verification:** Focused protocol suite passed 1 file / 7 tests; scoped lint and diff validation passed. Source smoke first removed the reproduced generic association and, after packaging, reported `none` while leaving the packaged handler untouched. Rebuilt packaged smoke reported `register-packaged-client` with window, preload, always-on-top, click-through, hide/show, and secure-storage checks passing. LaunchServices resolved `chatxpt` to `com.chatxpt.live-director`; direct `chatxpt://open` launched only the packaged process. `npm run check` passed 122 files / 1,010 tests plus lint, TypeScript, boundaries, hygiene/evidence/runbook checks, production build, and client-secret scans.
- **Reality status:** The owner screenshot and process/LaunchServices inspection reproduced the real failure. Local macOS protocol execution now targets the packaged bundle; one owner-selected capture after rebuilding remains the final hands-on confirmation.
