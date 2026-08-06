# Shared Team Context

This is the short, current handoff for all five contributors and their ChatGPT/Codex agents. Root `AGENTS.md` defines authority, `docs/DECISIONS.md` records durable product decisions, `docs/PROJECT_TODO.md` tracks cross-project outcomes, and each role's guide, TODO, and execution plan define its work.

## Current product baseline

- ChatXPT is one reusable, game-neutral Next.js/TypeScript product with a platform-neutral core.
- Twitch is the only supported platform in the current MVP. Other platforms may appear only as disabled `Coming Soon` options.
- ChatXPT Studio is the full streamer setup and management app; Twitch Live Config provides compact in-stream controls; the Twitch Extension is the primary viewer surface; the hosted Quest Board and Twitch-chat voting are fallbacks; OBS displays broadcast visuals.
- Supabase Free is the target shared persistence/realtime service and Vercel is the deployment target. Credential-free local transport and deterministic generation remain permanent fallbacks.
- The judged workflow uses real gameplay captured through OBS Virtual Camera and real Twitch activity. Simulated fixtures are test/diagnostic evidence only; unavailable real signals are reported as unknown rather than fabricated.
- Role 1's application orchestrator is the sole runtime composition/persistence/broadcast authority. Every role integrates through the versioned public seams and contract tests in `docs/build-plans/INTEGRATION-CONTRACT.md`.
- Game support is tiered: universal broad visual signals, calibrated HUD facts for configured games, and future official telemetry. Capabilities/unknown are explicit.
- Brawl Stars is the intended real-gameplay demonstration scenario if the current OBS capture spike proves it reliable; otherwise Role 1 immediately selects a team-owned PC action game without changing the game-neutral product. The minimum extraction proof is universal action/quiet/transition intelligence plus at least one reliable calibrated fact for the selected game.
- Roles 2 and 3 jointly recommend the AI provider/model. Role 2 owns extraction, behavioural intelligence, provider adapters, and model-ready context. Role 3 owns quest-engine behaviour, quest-domain AI instructions, validation, lifecycle, activation, and safety enforcement.
- Twitch Extension Local/Hosted Test remains the target primary viewer proof. If it is not end to end by 6 August 2026 at 12:00 SGT, the real Twitch demonstration uses the hosted board and Twitch-chat voting fallbacks without misrepresenting Extension readiness.
- Viewer participation rate is the principal impact metric; quest completion, setup time, response latency, and fallback/reconnect success are supporting measures.
- The submission deadline is 9 August 2026. There is no automatic feature freeze: only the project owner may call it. Final deck/video/demo-narrative assembly is deferred until the project owner declares the product ready, while implementation, integration, and evidence collection continue.

## Authority and owners

| Role | Owner | Authority |
| --- | --- | --- |
| Role 1 | `Dewflash` | Project owner; integrations, shared contracts, infrastructure, final integration, direction, and role arbitration |
| Role 2 | `joelyrk` | AI intelligence, gameplay/chat extraction, provider adapters, and model-ready context |
| Role 3 | `L0pch` | Quest engine, quest-domain AI, lifecycle, safety, scoring, and activation behaviour |
| Role 4 | `JYL1m` | Streamer Studio, Twitch Live Config, shared visual system, and streamer UX |
| Role 5 | `drdexe` | Twitch viewer Extension, hosted viewer fallback, viewer overlay visuals, and viewer UX |

Role 1 is the final authority and may deconflict, redirect, or assist any role under the disclosure rules in `AGENTS.md`. Roles 2–5 otherwise implement only inside their assigned ownership.

## Immediate coordinated assignment

For the current MVP planning pass, Role 2 has scoped authority to decide the separate but synchronised build plans for Roles 4 and 5. Each plan covers outcomes, surfaces and flows, priorities, required states, view models/commands/errors/fixtures, public entry and Role 1 mounts, AI/data requirements, mock/live boundaries, milestones, contract/evidence acceptance, exclusions, and handoff order. The two plans share dependencies/deadlines and an early Role 4 design-system handoff. Roles 4 and 5 provide one feasibility review and then implement their plan, retaining detailed visual, interaction, accessibility, component, and code decisions that do not contradict it. Role 2 may revise the plans but may not implement or edit Role 4/5 source. Role 1 remains final authority and resolves disagreements.

## Coordination board

Update a row before starting shared-contract or golden-demo work. Detailed task status remains in the role TODOs.

| Area | Owner | Branch / issue | Intended outcome | Status |
| --- | --- | --- | --- | --- |
| Team foundation and integration | `Dewflash` | PR #2 | Merge role authority, workflow, TODO, and changelog foundation | Done |
| Role 1-3 execution plans | `Dewflash` | `docs/build-plans/` | Concurrent phases, owner decisions, deadlines, real-data evidence, and integration exits | Ready |
| Cross-role integration contract | `Dewflash` | `docs/build-plans/INTEGRATION-CONTRACT.md` | Public seams, orchestrator, shared ownership, realtime correctness, and test ladder | Ready |
| Canonical contract implementation | `Dewflash` | PR #6 | Versioned schemas, public ports, explicitly non-live fixtures, and schema tests | Done |
| Role public entrypoint foundation | `Dewflash` | PR #7 | Collision-free public modules and canonical consumer compatibility tests for Roles 1-5 | Done; Role 1 override disclosed |
| Application orchestrator foundation | `Dewflash` | PR #8 | Idempotent expected-revision command path with atomic fixture persistence before validated view broadcast | Done |
| Role dependency guard and legacy inventory | `Dewflash` | PR #9 | Enforce public-only cross-role imports and map legacy seams without deciding migration outcomes | Done |
| Foundation checkpoint audit | `Dewflash` | PR #10 | Compile changelog, verify merged main, and publish truthful role-by-role pickup state | Done |
| Evidence manifest and real-test resources | `Dewflash` | [PR #32](https://github.com/Dewflash/chatxpt/pull/32) | Machine-checked evidence classes, immutable run records, privacy-safe artifact references, and assigned Twitch/viewer/OBS/browser/recording resources | Done |
| Supabase persistence/realtime foundation | `Dewflash` | [PR #12](https://github.com/Dewflash/chatxpt/pull/12) | Revisioned server-only persistence, session lifecycle, permissions, sanitised snapshots, local fallback, and recovery tests; shared cloud activation remains separate evidence | Done |
| Guided UI-plan safety corrections | `Dewflash` using the D-015 integration override | [PR #27](https://github.com/Dewflash/chatxpt/pull/27); issues #15-#26 | Beginner-safe execution, adaptive design coaching, corrected priorities, personal-viewer/fallback gaps, and persistent owner handoffs without UI source changes | Done |
| Role 4/5 MVP build plans | `joelyrk` | [PR #14](https://github.com/Dewflash/chatxpt/pull/14); [PR #54](https://github.com/Dewflash/chatxpt/pull/54); feasibility [#15](https://github.com/Dewflash/chatxpt/issues/15)/[#16](https://github.com/Dewflash/chatxpt/issues/16) | Separate beginner-guided plans for the streamer and viewer owners; feasibility responses and Role 2 baseline acceptance are merged | Done |
| Role 2 provider/fallback evaluation | `joelyrk` | [PR #61](https://github.com/Dewflash/chatxpt/pull/61); Role 3 rubric on `main` | Provider-neutral timeout/failure metrics and injected algorithmic recovery are merged; the joint provider recommendation to Role 1 remains open | Done; recommendation pending |
| Role 2 visual extraction spike | `joelyrk` | [PR #55](https://github.com/Dewflash/chatxpt/pull/55); Role 1 dependency `role-1/obs-capture-spine` | Consume the canonical ephemeral `FrameSource` through downsampled visual measurements and selective-region OCR plumbing; record fixture-only evidence until authorised gameplay and a browser-delivered OBS frame are available | Done |
| Role 2 real-input evidence | `joelyrk` | `role-2/real-input-evidence`; Role 1 dependency `role-1/obs-capture-spine`; OCR dependency [issue #70](https://github.com/Dewflash/chatxpt/issues/70) | Record two authorised gameplay samples, quiet/action/transition and selective-OCR measurements, latency/resource observations, sanitised chat, and honest unknown behaviour without persisting raw frames | In progress |
| Quest engine implementation | `L0pch` | [PR #47](https://github.com/Dewflash/chatxpt/pull/47); [PR #44](https://github.com/Dewflash/chatxpt/pull/44); [PR #52](https://github.com/Dewflash/chatxpt/pull/52); [PR #53](https://github.com/Dewflash/chatxpt/pull/53); [PR #57](https://github.com/Dewflash/chatxpt/pull/57) | Provider rubric, engine evaluation, progress/reward policy, and quest AI policy are merged; authoritative vote resolution remains under review | In progress |
| Streamer experience | `JYL1m` | Start with [issue #15](https://github.com/Dewflash/chatxpt/issues/15) and `ROLE-4-EXECUTION.md` | Working Studio and Twitch Live Config against accepted contracts | Ready |
| Viewer experience | `drdexe` | Start with [issue #16](https://github.com/Dewflash/chatxpt/issues/16) and `ROLE-5-EXECUTION.md` | Working Extension, fallback board, and overlay against accepted contracts | Ready |

Use `Planned`, `Ready`, `In progress`, `Needs review`, `Blocked`, or `Done`. A row is a coordination signal, not a substitute for a branch, issue, pull request, role TODO, or decision entry.

## Golden demo requirements

The exact game/scenario remains a team implementation choice, but the stable demo must show:

1. Gameplay and audience inputs plus saved streamer preferences.
2. Real AI contribution producing three contextual, structured candidates, with provider status visible in evidence.
3. Quest-engine validation and safe fallback behaviour.
4. Viewer voting through the Twitch-first participation path.
5. Winning quest activation, OBS overlay progress, outcome, and non-monetary reward.
6. Clear labels for real input, algorithmic or AI-derived signals, fallback behaviour, uncertainty, and not-yet-implemented behaviour; simulated fixtures cannot be used as live-extraction proof.

## Safe handoff format

```text
Outcome:
Branch / commit:
Files and contracts changed:
Public seams and fixture IDs:
Interaction or route exercised:
Authoritative session/cycle revision:
Commands run and results:
Fallback behavior checked:
Decisions assumed or still open:
Known blockers / next owner:
```

## Context hygiene

- Fetch and inspect current `origin/main` before editing.
- Treat a wave as complete only after its smallest cross-role slice passes on merged `main`; do not save integration for the end.
- Never commit private ChatGPT exports, API keys, personal viewer data, or competition credentials.
- Convert settled conclusions into `docs/DECISIONS.md`; convert work status into the relevant TODO and coordination row.
- If incoming work conflicts with authority, scope, or an accepted decision, stop and notify the owning role and Role 1 before implementation.
