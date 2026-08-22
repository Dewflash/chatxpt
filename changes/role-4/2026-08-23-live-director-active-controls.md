# Control active quests from Desktop Live Director

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** pending
- **Summary:** An authoritative active quest now exposes confirmed `Cancel quest` and immediate `Mark complete` controls in the private Desktop Live Director. The controls remain available after either Automatic viewer-led activation or Manual direct activation, provided the current quest authority allows the matching action.
- **Integration impact:** The permanent private broadcaster grant adds only canonical `cancel` and `succeed` requests. Role 1 re-resolves the broadcaster, current session, cycle, revision, active candidate, and allowed action before Role 3 performs the transition; fail, skip, pause, progress, winner, vote, and general session authority remain denied.
- **Verification:** The focused quest-engine, command, Studio, Desktop UI, descriptor, and server-authority suite passed 6 files / 142 tests, covering both setup modes, allowed actions, denied lifecycle expansion, terminal persistence, shared revision publication, and idempotent retry. Scoped ESLint, TypeScript, role-boundary, and task diff checks passed. The production-build portion of the full gate was not rerun while the owner's active `dev:twitch` process used the same Next.js workspace.
- **Reality status:** Memory-backed authoritative runtime and canonical fixture rendering only. The owner-linked packaged companion still needs real Automatic and Manual active-quest cancellation/completion checks and downstream Studio/OBS/Extension convergence evidence.
