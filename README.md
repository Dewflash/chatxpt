# ChatXPT

ChatXPT is an AI-powered livestream engagement engine. It combines gameplay state, viewer sentiment, and streamer preferences to generate short sidequests, lets viewers vote, and displays the winning challenge as a live overlay.

The product is game-neutral and intended for game streamers across audience sizes, play styles, and genres. Twitch is the only platform implemented for the current MVP, but it is isolated behind adapters rather than embedded into the core product model.

## Team start here

Every contributor and their ChatGPT/Codex agent must read:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/TEAM_PLAYBOOK.md`](docs/TEAM_PLAYBOOK.md)
3. The assigned guide and TODO under [`docs/roles/`](docs/roles/)
4. [`docs/build-plans/INTEGRATION-CONTRACT.md`](docs/build-plans/INTEGRATION-CONTRACT.md)
5. The assigned execution plan under [`docs/build-plans/`](docs/build-plans/) for Roles 1-3, or the accepted Role 2-authored plan for Roles 4-5
6. [`docs/DECISIONS.md`](docs/DECISIONS.md)
7. [`docs/PROJECT_TODO.md`](docs/PROJECT_TODO.md)

The original merged foundation checkpoint is summarised in [`docs/FOUNDATION-HANDOFF-2026-08-03.md`](docs/FOUNDATION-HANDOFF-2026-08-03.md). Role 1's current persistence/realtime implementation and exact evidence boundary are in [`docs/SUPABASE-HANDOFF-2026-08-03.md`](docs/SUPABASE-HANDOFF-2026-08-03.md).

The playbook includes first-time setup, safe daily Git commands, the required Codex start prompt, one-batch decision handling, verification, changelog fragments, pushing, and pull requests.

On the first pull in each clone, Codex follows [`docs/FIRST-PULL-WELCOME.md`](docs/FIRST-PULL-WELCOME.md): everyone sees the team map and their own decision areas, while Roles 4/5 also receive the one-time vibecoding guide. A local Git marker prevents the welcome from repeating on ordinary pulls.

Role 4 and Role 5 may simply tell Codex `I am Role 4. What do I need to do?` or `I am Role 5. What do I need to do?`. Codex selects their first ready pass, explains the design choices with recommendations, handles routine technical/Git decisions, and records answers in `docs/roles/ROLE-4-EXECUTION.md` or `docs/roles/ROLE-5-EXECUTION.md`.

The checked-in legacy prototype begins with one local diagnostic slice:

1. A producer changes simulated game and audience signals.
2. ChatXPT produces three contextual sidequests.
3. Viewers vote on the options.
4. The winning quest is activated.
5. A separate overlay route displays its timer, status, and reward.

This simulated path is useful for deterministic tests and migration checks, but it is not accepted as live product evidence. The target MVP uses real gameplay captured through OBS Virtual Camera, real Twitch activity, credential-free algorithmic intelligence, and deterministic quest fallback. Unavailable real signals are reported as `unknown`.

## Quick start

Requirements: Node.js 20.9+ (Node 22 recommended) and npm.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the control room and [http://localhost:3000/overlay](http://localhost:3000/overlay) for the browser-source overlay.

Run all checks:

```bash
npm run check
```

Run the focused Role 1 persistence/realtime suite with `npm run test:persistence`. A fully empty local Supabase configuration intentionally selects the credential-free in-memory runtime. The pinned Supabase CLI and database workflow are documented in [`supabase/README.md`](supabase/README.md); local database execution additionally requires a Docker-compatible runtime.

The full check includes an ownership-boundary scan. Role modules may consume approved public entrypoints, but cannot import another role's private files. The factual legacy split and its still-open migration decisions are recorded in [`docs/architecture/LEGACY-MIGRATION-INVENTORY.md`](docs/architecture/LEGACY-MIGRATION-INVENTORY.md).

## Legacy optional OpenAI adapter

The prototype still contains an optional server-side OpenAI adapter while the role-owned migration is in progress. It is not the accepted MVP provider path, and no teammate is authorised to incur paid API usage for the project. ChatGPT Pro does not provide shared application API billing. Never expose any provider key through a `NEXT_PUBLIC_` variable.

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-terra
```

Roles 2 and 3 will jointly recommend a free provider/model path. If any provider is unavailable, invalid, or slow, the product must continue through credential-free algorithmic intelligence and deterministic quest fallback while showing clear provider status.

## Repository map

- `src/app` - Next.js routes, API, and overlay
- `src/core` - versioned platform-neutral contracts, public ports, and explicitly non-live contract fixtures
- `src/integrations` and `src/realtime` - Role 1 public adapter and authoritative-state boundaries
- `supabase` - Role 1-owned reproducible schema, RLS, private realtime policy, and local CLI configuration
- `src/ai` and `src/extraction` - Role 2 public intelligence and extraction boundaries
- `src/quest-engine` - Role 3 pure engine boundary
- `src/streamer` and `src/design-system` - Role 4 public streamer and shared-visual-system boundaries
- `src/viewer` - Role 5 public participation and overlay boundary
- `src/components` - interactive product UI
- `src/lib` - schemas, domain types, mock engine, and model adapter
- `docs` - product scope, architecture, decisions, shared team context, workflow, and submission checklist
- `docs/roles` - mandatory per-role authority and to-do lists
- `docs/build-plans` - authoritative integration contract plus phase, decision-gate, deadline, and acceptance plans
- `docs/evidence` and `docs/research` - Role 1-owned truthful evidence manifest, test resources, and problem-solution/originality validation records
- `changes` - role-owned changelog fragments compiled by Role 1
- `.github` - code ownership and pull-request/cross-role issue templates
- `.codex/skills/chatxpt-prototype` - shared project workflow for Codex
- `AGENTS.md` - durable instructions for AI-assisted contributors

## Current prototype architecture before role migration

```text
game signals + chat signals + streamer profile
                    |
                    v
          POST /api/sidequests
             /             \
     OpenAI adapter     mock engine
             \             /
              3 quest options
                    |
             viewer voting
                    |
          activated overlay state
                    |
              /overlay route
```

The checked-in legacy prototype still uses same-origin browser storage and `BroadcastChannel` to synchronize its control room and overlay. The new Role 1 runtime now implements Supabase-backed authoritative persistence/private snapshot broadcasting and a production-shaped in-memory fallback behind public ports, but the legacy routes are not silently rewired before their migration decisions. Twitch, OBS, AI providers, gameplay extraction, persistence, and viewer surfaces remain replaceable adapters around the core contracts.

Role 1's application orchestrator will compose those adapters and Role 2/3 public ports, persist revisioned state, and broadcast role-specific view models. Cross-role work integrates after every wave through producer/consumer contract tests rather than being combined only after five separate builds finish.

The application orchestrator is implemented behind injected authorization, candidate-reader, engine, repository, projection, clock, ID, and publisher ports. The Role 1 persistence runtime now binds its repository, immutable candidate store, and sanitised snapshot publisher into that seam. Automated tests prove local idempotency, stale/concurrent-write rejection, lifecycle recovery, permission denial, persist-before-notify ordering, reconnect revision handling, and static migration/RLS requirements. They do not claim a real Supabase cloud round trip until project credentials and compatible database runtime evidence exist.

The version-one contract schemas and fixtures now live under `src/core/`. Legacy routes still use `src/lib/domain.ts` until the separately gated mechanical migration; the existence of new contracts does not imply the current UI or API is integrated with them yet.

Each role also has an additive public `index.ts` in its owned source directory. These entrypoints expose only accepted shared seams; they are not placeholder product implementations, and the deliberately empty design-system entrypoint leaves visual decisions with Role 4.

## Third-party disclosure

Submission-facing third-party disclosures live in [`docs/THIRD_PARTY_DISCLOSURES.md`](docs/THIRD_PARTY_DISCLOSURES.md). The disclosure covers runtime dependencies, development tooling, Twitch/OBS/Supabase/Vercel/provider status, data and asset boundaries, non-MVP platforms, and evidence-claim rules.

No third-party datasets are bundled. Existing demo chat and gameplay events are synthetic and may be used only as test/diagnostic fixtures, not live-extraction evidence.
