# Consume the shared design system in viewer surfaces

- **Type:** Changed
- **Role:** Role 5
- **Issue/PR:** #95
- **Summary:** Updates the viewer, hosted board, chat fallback, and OBS overlay demo surfaces to consume Role 4's public design-system root, components, and token variables, while keeping vote authority outside Role 5.
- **Integration impact:** Role 4's public visual-system handoff is now exercised by Role 5. Role 1 can pass an authorised viewer dispatcher and voter key into the board instead of relying on fixture-only command handling inside the production component. The accepted public mount names are exported as `TwitchViewerPanel`, `HostedQuestBoard`, `TwitchChatVoteInstructions`, and `QuestOverlay`.
- **Verification:** `npm run test -- src/viewer/surface-model.test.ts src/viewer/surfaces-render.test.ts src/design-system/design-system.test.ts`; `npm run typecheck`; `git diff --check`; `npm run check`.
- **Reality status:** Fixture-only UI/runtime evidence plus local build/test proof. No real Twitch Extension auth, Supabase realtime, multi-viewer, screenshot, or OBS Browser Source claim.
