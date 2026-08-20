## Summary

- Expanded the canonical `streamer.profile-settings` command to persist selected game, restrictions, preferred quest types, forbidden quest types, and accessibility needs in addition to experience, voting, and reward defaults.
- Applied those fields through the authoritative orchestrator so profile revision, session revision, role views, and broadcasts remain one server-owned state update.
- Updated Role 4 command-builder coverage and Studio copy to distinguish the now-available persistence seam from the remaining full list-editing UI pass.

## Evidence

- `npm run test -- src/streamer/streamer-commands.test.ts tests/integration/orchestrator.test.ts src/core/contracts.test.ts`
