# Add a repeatable Role 5 multi-client rehearsal

- **Type:** Added
- **Role:** Role 5
- **Issue/PR:** pending
- **Summary:** Added a production-server rehearsal that proves two isolated viewer contexts can vote into one authoritative winner and read-only overlay payoff, then verifies private reconnect plus hosted-board and Twitch-chat fallbacks.
- **Integration impact:** Adds the shared `npm run smoke:role-5-memory` command over existing public Twitch Extension, hosted-board, EventSub, Studio, and OBS API boundaries. It changes no canonical contract, vote/lifecycle rule, viewer presentation, persistence schema, or external dependency.
- **Verification:** Immutable commit `79192dc`; rehearsal passed at revisions 6/7/8/9; focused viewer/Twitch/hosted/chat/OBS tests passed 6 files / 47 tests; full `npm.cmd run check` passed 80 files / 583 tests plus production build; script lint/syntax, package parsing, and diff checks passed.
- **Reality status:** Memory-backed evidence `E-20260819-R5-001` uses locally signed diagnostic JWTs, synthetic candidates, test-only secrets, and process memory. Real Twitch-issued identity/EventSub, Supabase Cloud, physical browser interaction, and OBS Browser Source remain unverified R5-008 work.
