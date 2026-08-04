# Deterministic quest-engine foundation

- **Type:** Added
- **Role:** Role 3
- **Issue/PR:** [#36](https://github.com/Dewflash/chatxpt/issues/36), [#37](https://github.com/Dewflash/chatxpt/issues/37), and [#38](https://github.com/Dewflash/chatxpt/issues/38); PR pending
- **Summary:** Adds the pure quest lifecycle foundation, Phase 2 intervention/control policy, and Phase 3 safety-first candidate validation with deterministic exactly-three fallback assembly and rejection audit evidence.
- **Integration impact:** Role 1 can construct the exported canonical `QuestEngine`, intervention policy, and candidate assembler. The orchestrator should run intervention, then assembly, then issue `system.intelligence-ready`; duplicate command handling and authoritative event/revision stamping remain Role 1-owned. Coordinated Core work is still required for authoritative timer progression, intervention context composition, and the application-wide emergency latch.
- **Verification:** `npm.cmd exec vitest run src/quest-engine` passes 32 focused tests. `npm.cmd run check` passes lint, typecheck, role boundaries, all 105 tests, and the production build.
- **Reality status:** Engine logic is real and deterministic. Candidate, command, and lifecycle examples are explicitly test-only fixtures; no live extraction or provider behaviour is claimed.
