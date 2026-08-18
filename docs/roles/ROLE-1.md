# Role 1 Guide: Integrations and Shared Platform

**Owner:** `Dewflash`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts.

Execute work through `docs/build-plans/ROLE-1-BUILD-PLAN.md`. It defines the phase order, decision gates, deadlines, and acceptance evidence; this guide defines Role 1's primary responsibility and integration duty, not exclusive edit permission.

`docs/build-plans/INTEGRATION-CONTRACT.md` is the binding cross-role runtime boundary. Role 1 maintains its application orchestrator, canonical examples/tests, and shared composition files; any contributor may edit them under D-071.

## Mission

Keep ChatXPT coherent and demonstrable end to end. Own platform-neutral contracts, Twitch and OBS boundaries, realtime/persistence integration, session lifecycle, deployment coordination, and final integration evidence.

## Required outcomes

- Stable domain and participation contracts for every other role.
- A sole application orchestrator that composes Role 2/3 ports, authenticates/deduplicates commands, persists revisions, and broadcasts view state.
- Twitch authentication, chat/event, Extension, and OBS integration boundaries.
- Realtime room/session transport and persistence selected through an accepted decision.
- One golden integration path across Roles 2-5 plus credential-free fallbacks.
- Integrated README, architecture, disclosures, changelog, deck evidence, demo evidence, and submission package.

## Integration and deconfliction duties

- You and every contributor may inspect, assist, and modify any role without prior owner permission.
- Notify affected contributors promptly and request responsibility-lead review when practical; neither is a prerequisite for implementation, pushing, or opening a pull request.
- Before merge, inspect overlapping branches and pull requests, reconcile textual and semantic conflicts, preserve valid work from both sides, and decide the safest integration order.
- Do not silently replace an accepted component decision; record substantial deviations and explain which behaviour survives a conflict resolution.
- Use cross-role GitHub issues for durable coordination or unresolved choices, not as implementation gates.
- Keep Twitch payloads and provider payloads outside platform-neutral domain contracts.
- Keep `src/app/` routes thin, require public role entry points, and actively deconflict dependency/lock/config/env/migration changes made by any contributor.
- Record every owner resolution made through Codex back in GitHub or `docs/DECISIONS.md`.

## Verification

Run schema, producer/consumer, orchestration, multi-client, and golden-workflow checks. Verify the same authoritative revision across persistence, Studio, two viewers, and OBS. State separately what was inspected, simulated, locally tested, and demonstrated live.
