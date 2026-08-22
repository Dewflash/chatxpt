# Balance Safety and Accessibility settings

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** pending
- **Summary:** Profile & Defaults now pairs Safety limits with Accessibility needs, aligns the Global boundaries badge with the section heading, and gives all boundary text areas more useful height.
- **Integration impact:** Presentation-only Role 4 change; profile fields, save behavior, contracts, and authority remain unchanged.
- **Verification:** Focused Profile render suite passed 1 file / 47 tests; scoped ESLint and TypeScript passed; browser checks at 1280 px measured equal 209 px paired fields, 144 px text areas, a shared heading/badge row, and zero overflow; 390 px stacked all fields at 324 px with zero overflow; no console warnings/errors; full `npm run check` passed 123 files / 1,030 tests plus production build and secret scans; `git diff --check` passed.
- **Reality status:** Real local source and browser rendering against the local fallback Profile page; no Twitch, OBS, viewer, gameplay, or persistence behavior changed.
