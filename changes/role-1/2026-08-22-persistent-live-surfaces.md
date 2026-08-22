# Permanent live surfaces and complete quest payoff

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** ChatXPT now gives each broadcaster one reusable private Live Director URL and one reusable public OBS Browser Source URL. Live Director, OBS, the Twitch Extension, hosted board, and chat fallback share the same safe chat/game/explainer and quest lifecycle, including configurable 30/60-second voting, automatic or streamer-approved activation, winner reveal, progress, result, and cooldown.
- **Integration impact:** Crosses Core view/profile/quest contracts, Role 1 grants/runtime/projection/persistence, Role 3 lifecycle, Role 4 Studio/Test Lab and compact Live Director, and Role 5 viewer/OBS surfaces. Supabase adds the backward-compatible `selected` quest status constraint; existing profile JSON uses schema defaults and requires no row rewrite.
- **Verification:** Rebased onto `origin/main` at `6c3a330`; `npm run check` passed with 114 test files / 889 tests, production build, role boundaries, hygiene, evidence validation, demo-runbook validation, and client-secret scan. Focused permanent-grant, cross-session, cross-surface projection, saved-preference, lifecycle, Twitch viewer, and render tests also pass.
- **Reality status:** Source and automated memory/fixture evidence are complete. No real Twitch-issued Extension vote, OBS Dock/Browser Source session, Supabase migration application, or Vercel deployment is claimed in this pass.
