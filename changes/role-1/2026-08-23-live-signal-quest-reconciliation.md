# Reconcile live gameplay, audience, and quest publication

- **Type:** Fixed
- **Role:** Role 1, with cross-role extraction, generation, validation, and Studio presentation changes
- **Issue/PR:** pending
- **Summary:** Real OBS Minecraft snapshots and current Twitch chat aggregates now survive high-frequency gameplay revisions into the same proposal, safe local algorithmic quests no longer collapse because of demo-copy false positives, private streamer rationale no longer makes the public viewer/overlay snapshot publisher report a false realtime outage, and an already-open memory-mode Quest Board refreshes fast enough to follow a new cycle without a manual reload.
- **Integration impact:** Role 1 runtime/realtime authority and hosted-board recovery cadence; Role 2 Minecraft frame extraction and algorithmic candidates; Role 3 game-name and evidence validation; Role 4 truthful recommendation copy. No public contract shape changed.
- **Verification:** `npm.cmd run check` passed lint, TypeScript, role boundaries, repository/evidence/demo/security gates, all 120 test files / 960 tests, production build, and client-secret scan. Live local evidence covered authorised Twitch chat, real OBS Virtual Camera Minecraft capture, three algorithmic options, broadcast approval, hosted vote/winner/activation, and succeeded result/reward.
- **Reality status:** Real Twitch broadcaster/chat and real OBS/Minecraft input were used. The OpenAI provider stayed disabled, persistence was process-local, and a real Twitch-issued viewer JWT vote plus Supabase/Vercel remain unproven.
