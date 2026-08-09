# Organise demo cockpit status and ribbon views

- **Role:** Role 1 integration and demo coordination
- **Summary:** Grouped the top status bars into Game, Chat, Quest, Broadcast, Analytics, and Voting sections, added an explicit Action cockpit label for the four recording buttons, and tightened the Analytics and Game signals views into column layouts so controls no longer stretch awkwardly across the page.
- **Integration impact:** Improves recording clarity without changing the local demo data flow, viewer bridge, OBS overlay route, or evidence boundaries.
- **Verification:** `npm run lint`, `npm run typecheck`, `git diff --check`, and live route smoke checks passed before the full final check.
