# Start the truthful Studio setup shell

- **Type:** Added
- **Role:** Role 4
- **Issue/PR:** PR pending on `role-4/studio-setup-shell`
- **Summary:** Adds the first public Streamer Studio setup/readiness shell with guided first-time and returning flows, authoritative service cards, grouped saved-profile summaries, expandable intelligence provenance, and honest loading/reconnect/evidence states.
- **Integration impact:** Role 1 can mount `StudioSetupShell` through the public `@/streamer` entry. Connection, permission, profile-save, and session actions remain unavailable until UI-X01/UI-X02/UI-X05 supply fully validated browser gateway results.
- **Verification:** Focused Role 4 render-contract suite (8 tests); lint; TypeScript; role boundaries; evidence manifest and its 3 tests; full repository suite (243 tests); optimized Next.js production build; [desktop fixture](evidence/r4-p03/setup-desktop.png); and [narrow reconnect fixture](evidence/r4-p03/setup-narrow-reconnect.png).
- **Reality status:** Real Role 4 source rendered with canonical fixture data. No live Twitch, OBS capture, AI provider, Supabase, authenticated gateway, persisted profile update, or session-start behaviour is claimed.
