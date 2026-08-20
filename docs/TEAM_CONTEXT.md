# Shared Team Context

This is the short, current handoff for all five contributors and their ChatGPT/Codex agents. Root `AGENTS.md` defines authority, `docs/DECISIONS.md` records durable product decisions, `docs/PROJECT_TODO.md` tracks cross-project outcomes, and each role's guide, TODO, and execution plan define its work.

## Finalist schedule authority

ChatXPT is a Top 10 finalist. `docs/submission/FINALS-2026.md` records the non-sensitive finalist deadlines, 10-minute pitch plus 5-minute Q&A format, deliverables, judging weights, and presentation-day requirements from Garena's 14 August finalist email. The final Drive submission is due **21 August 2026 at 3 PM SGT** and becomes immutable after submission. Mentoring credentials and participant-registration links remain local/private and must not be committed.

## Current product baseline

- ChatXPT is one reusable, game-neutral Next.js/TypeScript product with a platform-neutral core.
- Twitch is the only supported platform in the current MVP. Other platforms may appear only as disabled `Coming Soon` options.
- ChatXPT Studio is the full streamer setup and management app; Twitch Live Config provides compact in-stream controls; the Twitch Extension is the primary viewer surface; the hosted Quest Board and Twitch-chat voting are fallbacks; OBS displays broadcast visuals.
- Supabase Free is the target shared persistence/realtime service and Vercel is the deployment target. Credential-free local transport and deterministic generation remain permanent fallbacks.
- The judged workflow uses real gameplay captured through OBS Virtual Camera and real Twitch activity. Simulated fixtures are test/diagnostic evidence only; unavailable real signals are reported as unknown rather than fabricated.
- Role 1's application orchestrator is the sole runtime composition/persistence/broadcast authority. Every role integrates through the versioned public seams and contract tests in `docs/build-plans/INTEGRATION-CONTRACT.md`.
- Game support is tiered: universal broad visual signals, calibrated HUD facts for configured games, and future official telemetry. Capabilities/unknown are explicit.
- Vanilla Minecraft is the calibrated real-gameplay demonstration target under D-072 without narrowing the game-neutral product. Modded, hidden-HUD, and unrecognised variants retain universal action/quiet/transition intelligence while unsupported calibrated facts remain `unknown`. Brawl Stars remains evaluation evidence only.
- D-072 permits server-side OpenAI `gpt-5.6-terra` with an eligible team-owned credited key, bounded normalised context, an 8-second timeout, strict exactly-three validation, and mandatory algorithmic fallback. Role 2 owns extraction, behavioural intelligence, provider adapters, algorithmic candidates, and model-ready context. Role 3 owns quest-engine behaviour, quest-domain AI instructions, validation, lifecycle, activation, and safety enforcement.
- Twitch Extension Local/Hosted Test remains the target primary viewer proof. If it is not end to end by 6 August 2026 at 12:00 SGT, the real Twitch demonstration uses the hosted board and Twitch-chat voting fallbacks without misrepresenting Extension readiness.
- Viewer participation rate is the principal impact metric; quest completion, setup time, response latency, and fallback/reconnect success are supporting measures.
- D-075 activates the narrow Live Director audience-to-sidequest hypothesis in ten isolated passes: five Role 1 authority/delivery/integration passes and five Role 3 deterministic cue/quest passes. P0 keeps declared intent, private source-labelled context/pointer/cue, exactly-three conversion, Extension Vote/Active/Result, compressed OBS payoff, and Live Config pop-out/OBS Dock delivery. Catch-up and Session Brief are P1 experiments; broad coaching/chat/cohost/analytics/native-desktop/extra-OBS scope is excluded.
- The immutable finalist Drive submission deadline is 21 August 2026 at 3 PM SGT under `docs/submission/FINALS-2026.md`, superseding the earlier 9 August proposal schedule. There is no automatic feature freeze: only the project owner may call it. Final deck/video/demo-narrative assembly is deferred until the project owner declares the product ready, while implementation, integration, and evidence collection continue.

## Authority and owners

| Role | Owner | Authority |
| --- | --- | --- |
| Role 1 | `Dewflash` | Project owner; integrations, shared contracts, infrastructure, integration/deconfliction coordination, direction, and role arbitration |
| Role 2 | `joelyrk` | AI intelligence, gameplay/chat extraction, provider adapters, and model-ready context |
| Role 3 | `L0pch` | Quest engine, quest-domain AI, lifecycle, safety, scoring, and activation behaviour |
| Role 4 | `JYL1m` | Streamer Studio, Twitch Live Config, shared visual system, and streamer UX |
| Role 5 | `drdexe` | Twitch viewer Extension, hosted viewer fallback, viewer overlay visuals, and viewer UX |

Role 1 is the final product-direction authority and actively deconflicts, redirects, or assists work under `AGENTS.md`. Under D-071 and D-076, every contributor may implement in any role area, and any contributor with repository permission may merge or directly land deconflicted work without mandatory review or branch protection. The table names responsibility leads and advisory context, not file, push, approval, review, or merge gates.

Under D-077, execution is work-conserving: no contributor waits solely for another role, owner, review, or reply. A missing repository seam is implemented cross-role in its proper module or the contributor immediately selects another ready P0 task. Only external access/credentials, unresolved material risk, an authority-level semantic conflict, or a failing required integration boundary is a genuine blocker; one blocked evidence claim does not idle unrelated safe work.

## Immediate coordinated assignment

For the current MVP planning pass, Role 2 maintains the separate but synchronised build plans for Roles 4 and 5. Each plan covers outcomes, surfaces and flows, priorities, required states, view models/commands/errors/fixtures, public entry and Role 1 mounts, AI/data requirements, mock/live boundaries, milestones, contract/evidence acceptance, exclusions, and handoff order. The two plans share dependencies/deadlines and an early Role 4 design-system handoff. Roles 4 and 5 provide feasibility and detailed UX context. Under D-071, Role 2 or any contributor may also implement Role 4/5 source in the proper module without waiting for role permission; Role 1 deconflicts overlap and resolves semantic disputes.

For Live Director, `Dewflash` and `L0pch` each drive five isolated passes under the active `docs/build-plans/LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md`. Role 3 begins with cue suitability and proceeds through cue lifecycle, exactly-three conversion, invalidation/history, and deterministic handoff. Role 1 builds the canonical authority, context composition, streamer delivery, viewer/OBS delivery, and real value evidence. Neither contributor waits for personal approval; every wave must deconflict its public seam before merge.

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
| Browser-safe UI gateway and harness | `Dewflash` | `codex/role-1-ui-gateway-harness` | Fixture-only Role 1 snapshot, command-envelope validator, and `/diagnostics/ui-harness` target for streamer/viewer/overlay integration without claiming live evidence | In progress |
| Authenticated gameplay ingress | `Dewflash`; open contribution under D-071 | Current finals integration branch; former stacked [PR #139](https://github.com/Dewflash/chatxpt/pull/139) and [PR #141](https://github.com/Dewflash/chatxpt/pull/141) are already contained in the baseline | Studio-authorised short-lived capture grants, bounded current OBS-derived normalised snapshots, automatic gameplay publication, and shared memory/Supabase persistence | Source integrated with automated coverage; real OBS/Supabase evidence remains open |
| Guided UI-plan safety corrections | `Dewflash` using the D-015 integration override | [PR #27](https://github.com/Dewflash/chatxpt/pull/27); issues #15-#26 | Beginner-safe execution, adaptive design coaching, corrected priorities, personal-viewer/fallback gaps, and persistent owner handoffs without UI source changes | Done |
| Role 4/5 MVP build plans | `joelyrk` | [PR #14](https://github.com/Dewflash/chatxpt/pull/14); [PR #54](https://github.com/Dewflash/chatxpt/pull/54); feasibility [#15](https://github.com/Dewflash/chatxpt/issues/15)/[#16](https://github.com/Dewflash/chatxpt/issues/16) | Separate beginner-guided plans for the streamer and viewer owners; feasibility responses and Role 2 baseline acceptance are merged | Done |
| Role 2 provider/fallback evaluation | `joelyrk`; open contribution | [PR #61](https://github.com/Dewflash/chatxpt/pull/61); issue #132; [PR #149](https://github.com/Dewflash/chatxpt/pull/149); D-072 | Evaluate approved OpenAI `gpt-5.6-terra` with strict exactly-three output, 8-second timeout, privacy/credit disclosure, citation freshness/confidence, and algorithmic plus Role 3 deterministic fallback | In progress; PR #149 has one valuable source commit but conflicts in 14 current files and must be rebuilt or deliberately reconciled on current `main`, not merged as-is |
| Role 2 visual extraction spike | `joelyrk` | [PR #55](https://github.com/Dewflash/chatxpt/pull/55); merged Role 1 browser frame source | Consume the canonical ephemeral `FrameSource` through downsampled visual measurements and selective-region OCR plumbing; record fixture-only evidence until authorised gameplay and a browser-delivered OBS frame are available | Done |
| Role 2 audience intelligence policy | `joelyrk` | [PR #111](https://github.com/Dewflash/chatxpt/pull/111) | Implement the resolved D2-12 through D2-15 aggregation, privacy, ambiguity, and evidence-separation rules before accepting the audience pipeline | Done |
| Role 2 real-input evidence | `joelyrk` | `codex/role-2-real-input-evidence-current`; Tesseract replacement [PR #126](https://github.com/Dewflash/chatxpt/pull/126) | Record two authorised gameplay samples, quiet/action/transition and selective-OCR measurements, latency/resource observations, sanitised chat, and honest unknown behaviour without persisting raw frames | In progress |
| Current gameplay snapshot integration | `Dewflash`; open contribution under D-071 | Current `main`; expanded evidence-policy/extraction work remains in conflicting [PR #149](https://github.com/Dewflash/chatxpt/pull/149) | Keep one server-only current snapshot per session, reject stale/cross-state observations, hydrate command-time authority, and expose Capture Health without frame-level revision churn | In progress; source is integrated, real capture evidence and deliberate PR #149 reconciliation remain open |
| Quest engine implementation | `L0pch`; open cross-role contribution under D-077 | R3-014/R3-015; issue [#50](https://github.com/Dewflash/chatxpt/issues/50); merged R3-009..R3-013 | Provider rubric, engine evaluation, safe partial progress, authoritative ticks, adaptive intervention, rewards, deterministic lifecycle, Live Director runtime wiring, and predicate-bearing automatic completion proceed without owner waits; only real credential/platform evidence remains external | In progress |
| Streamer experience | `JYL1m`; finals integration by `Dewflash` under D-063 | `role-1/finals-isolated-passes`; integrates `role-4/studio-memory-live-config` | Canonical `/studio`, Config, and Live Config are mounted through secure manual session bootstrap, signed Twitch broadcaster identity, authoritative command dispatch, and truthful readiness | Needs review |
| Viewer experience | `drdexe`; finals integration by `Dewflash` under D-063 | `role-1/finals-isolated-passes`; integrates `role-5/finals-viewer-review` | Canonical and packaged Twitch viewers use signed JWT identity, select-then-confirm first-vote-final authority, private recovery, reactions/hype, and full state parity | Needs review |
| Live Director implementation | `Dewflash` and `L0pch`, with work-conserving cross-role contribution | [PR #155](https://github.com/Dewflash/chatxpt/pull/155); [PR #160](https://github.com/Dewflash/chatxpt/pull/160); [issue #150](https://github.com/Dewflash/chatxpt/issues/150); `docs/roles/ROLE-1-RESUME-HANDOFF.md`; P-016; R1-023..R1-027; R3-009..R3-015; D-075/D-077 | Implement the accepted falsifiable audience-to-sidequest loop: Role 1 owns runtime authority/delivery/integration/evidence and Role 3 owns deterministic cue/quest mechanics, while any contributor may implement the missing public-seam slice without waiting | In progress; LD-R1-01/R1-02/R1-03 and all Role 3 Live Director passes R3-009 through R3-013 are merged with fixture-labelled evidence. Private Studio, Twitch Live Config, and the authorised pop-out/OBS Dock commit Role 3 cue actions. Role 3 proceeds with R3-014 on exactly-three runtime publication plus viewer/OBS delivery, or R3-015 if that slice overlaps. Real Twitch/OBS/Supabase/provider evidence and direct ChatXPT value remain unproven. |

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
