# Shared Team Context

This is the short, current handoff for all five contributors and their ChatGPT/Codex agents. Root `AGENTS.md` defines authority, `docs/DECISIONS.md` records durable product decisions, `docs/PROJECT_TODO.md` tracks cross-project outcomes, and each role's guide and TODO define its work.

## Current product baseline

- ChatXPT is one reusable, game-neutral Next.js/TypeScript product with a platform-neutral core.
- Twitch is the only supported platform in the current MVP. Other platforms may appear only as disabled `Coming Soon` options.
- ChatXPT Studio is the full streamer setup and management app; Twitch Live Config provides compact in-stream controls; the Twitch Extension is the primary viewer surface; the hosted Quest Board and Twitch-chat voting are fallbacks; OBS displays broadcast visuals.
- Supabase Free is the target shared persistence/realtime service and Vercel is the deployment target. Credential-free local transport and deterministic generation remain permanent fallbacks.
- Gameplay extraction may be simulated when clearly disclosed and implemented behind a replaceable, game-neutral interface.
- Roles 2 and 3 jointly recommend the AI provider/model. Role 2 owns extraction, behavioural intelligence, provider adapters, and model-ready context. Role 3 owns quest-engine behaviour, quest-domain AI instructions, validation, lifecycle, activation, and safety enforcement.
- The submission deadline is 9 August 2026. Feature freeze is 7 August at 18:00 SGT; 8 August is reserved for integration, evidence, rehearsal, and recording.

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

Role 2 will produce the AI/data integration build plan that Roles 4 and 5 can implement against. It must define available inputs, outputs, confidence and source metadata, loading/failure/fallback states, mock fixtures, and proposed contract needs. Role 2 does not decide the streamer or viewer interaction design: Roles 4 and 5 retain their UI/UX and implementation authority and compare the plan with their component needs. Role 1 resolves any disagreement.

## Coordination board

Update a row before starting shared-contract or golden-demo work. Detailed task status remains in the role TODOs.

| Area | Owner | Branch / issue | Intended outcome | Status |
| --- | --- | --- | --- | --- |
| Team foundation and integration | `Dewflash` | PR #2 | Merge role authority, workflow, TODO, and changelog foundation | Done |
| AI/data plan for UI consumers | `joelyrk` | Create Role 2 branch/issue after pulling `main` | Implementation-ready intelligence contract plan for Roles 4 and 5 | Ready |
| Quest engine plan | `L0pch` | Create Role 3 branch/issue after pulling `main` | Engine boundary, lifecycle, safety, and AI-quality decisions | Ready |
| Streamer experience | `JYL1m` | Await Role 2 plan and shared contracts | Working Studio and Twitch Live Config against accepted contracts | Planned |
| Viewer experience | `drdexe` | Await Role 2 plan and shared contracts | Working Extension, fallback board, and overlay against accepted contracts | Planned |

Use `Planned`, `Ready`, `In progress`, `Needs review`, `Blocked`, or `Done`. A row is a coordination signal, not a substitute for a branch, issue, pull request, role TODO, or decision entry.

## Golden demo requirements

The exact game/scenario remains a team implementation choice, but the stable demo must show:

1. Gameplay and audience inputs plus saved streamer preferences.
2. Real AI contribution producing three contextual, structured candidates, with provider status visible in evidence.
3. Quest-engine validation and safe fallback behaviour.
4. Viewer voting through the Twitch-first participation path.
5. Winning quest activation, OBS overlay progress, outcome, and non-monetary reward.
6. Clear labels for real, mocked, simulated, fallback, and not-yet-implemented behaviour.

## Safe handoff format

```text
Outcome:
Branch / commit:
Files and contracts changed:
Interaction or route exercised:
Commands run and results:
Fallback behavior checked:
Decisions assumed or still open:
Known blockers / next owner:
```

## Context hygiene

- Fetch and inspect current `origin/main` before editing.
- Never commit private ChatGPT exports, API keys, personal viewer data, or competition credentials.
- Convert settled conclusions into `docs/DECISIONS.md`; convert work status into the relevant TODO and coordination row.
- If incoming work conflicts with authority, scope, or an accepted decision, stop and notify the owning role and Role 1 before implementation.
