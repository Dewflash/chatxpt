# Consume the shared design system in viewer surfaces

- **Type:** Changed
- **Role:** Role 5
- **Issue/PR:** #95
- **Summary:** Updates the viewer, hosted board, chat fallback, and OBS overlay demo surfaces to consume Role 4's public design-system root, components, and token variables, while keeping vote, room, and chat authority outside Role 5.
- **Integration impact:** Role 4's public visual-system handoff is now exercised by Role 5. Role 1 can pass an authorised viewer dispatcher and voter key into the board instead of relying on fixture-only command handling inside the production component. The accepted public mount names are exported as `TwitchViewerPanel`, `HostedQuestBoard`, `TwitchChatVoteInstructions`, and `QuestOverlay`. Hosted access and chat acknowledgement presentation types give Role 1 a UI-safe way to surface invalid/expired/forbidden/unavailable room states and counted/duplicate/rejected/late chat statuses. Overlay fixtures/rendering now cover inactive, voting, active, result, and reconnecting states.
- **Verification:** `npm run test -- src/viewer/surface-model.test.ts src/viewer/surfaces-render.test.ts src/design-system/design-system.test.ts tests/integration/role-entrypoints.test.ts`; `npm run typecheck`; `git diff --check`; `npm run check`.
- **Reality status:** Fixture-only UI/runtime evidence plus local build/test proof. No real Twitch Extension auth, Supabase realtime, multi-viewer, screenshot, or OBS Browser Source claim.
