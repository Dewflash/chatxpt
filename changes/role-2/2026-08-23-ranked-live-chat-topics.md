# Rank meaningful live chat topics

- **Type:** Fixed
- **Role:** Role 2
- **Issue/PR:** pending
- **Summary:** Live Analytics now shows up to three repeated automatic topics, filters common request filler such as `please` and `find`, and avoids duplicating an exact streamer-watchlist match.
- **Integration impact:** Role 2 publishes ranked privacy-safe topic signals in the existing `AudienceSnapshot`; Role 4 renders them and retains the existing Live Director pointer as a backward-compatible fallback. No shared schema changed.
- **Verification:** Focused audience/Twitch/Studio tests pass (3 files, 59 tests); `npm run check` passes (123 test files, 1,030 tests, production build, boundaries, hygiene, evidence, and client-secret scans).
- **Reality status:** Topic extraction and rendering are fixture/component-tested. Existing authorised Twitch evidence is unchanged; this fix has not been re-exercised with new real Twitch chat.
