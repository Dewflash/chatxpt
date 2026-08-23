# Keep final quest-vote tallies visible

- Type: Added
- Role: Role 4
- Issue/PR: pending
- Summary: Adds a dedicated Live Quests voting-result panel that preserves the winner and all three authoritative vote totals and percentages after voting closes, while separating that result from the later quest outcome.
- Integration impact: Presentation-only consumer of the existing authoritative quest-cycle tallies and winner; no contract, lifecycle, persistence, or voting changes.
- Verification: `npm.cmd test -- --run src/streamer/studio-product-pages.test.tsx` (50 tests passed); `npm.cmd run check` (123 files and 1,037 tests passed, production build passed).
- Reality status: Displays canonical runtime state; fixture coverage remains labelled as automated UI evidence rather than live Twitch evidence.
