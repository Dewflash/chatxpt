# Deterministic quest-engine foundation

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** [#36](https://github.com/Dewflash/chatxpt/issues/36), [#37](https://github.com/Dewflash/chatxpt/issues/37), [#38](https://github.com/Dewflash/chatxpt/issues/38), and [#42](https://github.com/Dewflash/chatxpt/issues/42); PR #40
- **Summary:** Adds the pure quest lifecycle foundation, Phase 2 intervention/control policy, Phase 3 safety-first exactly-three assembly, and a bounded Phase 4 voting window while deferring winner activation behind the shared close-vote seam. The deterministic safety boundary explicitly rejects concrete harmful, illegal, and offline physical-dare instructions.
- **Integration impact:** Role 1 can construct the exported canonical `QuestEngine`, intervention policy, and candidate assembler. The orchestrator should run intervention, then assembly, then issue `system.intelligence-ready`; duplicate command handling, vote identity/ledger, authoritative event/revision stamping, timer progression, emergency state, and vote close remain Role 1-owned.
- **Verification:** `npm.cmd exec vitest run src/quest-engine` passes 41 focused tests. `npm.cmd run check` passes lint, typecheck, role boundaries, all 114 tests, and the production build.
- **Reality status:** Engine logic is real and deterministic. Candidate, command, and lifecycle examples are explicitly test-only fixtures; no live extraction or provider behaviour is claimed.
