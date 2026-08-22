# Polish Studio live previews and section navigation

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** pending
- **Summary:** Home gives the widescreen OBS Overlay preview slightly more desktop room, and the remaining Studio page ribbons now link to the sections actually rendered on each page.
- **Integration impact:** Presentation-only Studio and gameplay-capture anchor changes; no viewer, overlay, command, extraction, or runtime contract changed.
- **Verification:** Focused Studio/capture suite passed 2 files / 49 tests; scoped ESLint and TypeScript passed; full `npm run check` passed 123 files / 1,028 tests plus boundaries, hygiene/evidence/runbook checks, production build, and client-secret scans; `git diff --check` passed.
- **Reality status:** Real source changes based on the owner's live Studio review; post-change browser navigation remains to be verified.
