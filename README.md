# ChatXPT

ChatXPT is an AI-powered livestream engagement engine. It combines gameplay state, viewer sentiment, and streamer preferences to generate short sidequests, lets viewers vote, and displays the winning challenge as a live overlay.

The product is game-neutral and intended for game streamers across audience sizes, play styles, and genres. Twitch is the only platform implemented for the current MVP, but it is isolated behind adapters rather than embedded into the core product model.

## Team start here

Every contributor and their ChatGPT/Codex agent must read:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/TEAM_PLAYBOOK.md`](docs/TEAM_PLAYBOOK.md)
3. The assigned guide and TODO under [`docs/roles/`](docs/roles/)
4. [`docs/DECISIONS.md`](docs/DECISIONS.md)
5. [`docs/PROJECT_TODO.md`](docs/PROJECT_TODO.md)

The playbook includes first-time setup, safe daily Git commands, the required Codex start prompt, one-batch decision handling, verification, changelog fragments, pushing, and pull requests.

This repository begins with one demo-ready vertical slice:

1. A producer changes simulated game and audience signals.
2. ChatXPT produces three contextual sidequests.
3. Viewers vote on the options.
4. The winning quest is activated.
5. A separate overlay route displays its timer, status, and reward.

The deterministic mock engine is always available. A server-side OpenAI adapter is used only when `OPENAI_API_KEY` is configured.

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

## Optional live AI

Add an OpenAI API key to `.env.local`. ChatGPT Pro helps teammates use ChatGPT/Codex, but does not provide shared API billing for this application. Never expose the key through a `NEXT_PUBLIC_` variable.

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6-terra
```

If the API is unavailable, invalid, or slow, the endpoint falls back to deterministic generation and returns a warning for the producer UI.

## Repository map

- `src/app` - Next.js routes, API, and overlay
- `src/components` - interactive product UI
- `src/lib` - schemas, domain types, mock engine, and model adapter
- `docs` - product scope, architecture, decisions, workflow, and submission checklist
- `docs/roles` - mandatory per-role authority and to-do lists
- `changes` - role-owned changelog fragments compiled by Role 1
- `.github` - code ownership and pull-request/cross-role issue templates
- `.codex/skills/chatxpt-prototype` - shared project workflow for Codex
- `AGENTS.md` - durable instructions for AI-assisted contributors

## Architecture summary

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

The current prototype uses same-origin browser storage and `BroadcastChannel` to synchronize the control room and overlay. The accepted MVP target replaces authoritative live state with Supabase persistence and realtime channels while preserving this local transport as a credential-free fallback. Twitch, OBS, AI providers, gameplay extraction, persistence, and viewer surfaces remain replaceable adapters around the core contracts.

## Third-party disclosure

- Next.js and React - application framework and UI
- OpenAI JavaScript SDK and Responses API - optional structured generation
- Zod - runtime validation
- Vitest - automated tests

No third-party datasets are bundled. Demo chat and gameplay events are synthetic.
