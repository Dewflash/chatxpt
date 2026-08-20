# ChatXPT

ChatXPT is a Twitch-first AI stream director that turns gameplay context, audience activity, and streamer preferences into three safe, vote-ready sidequests. Viewers choose through a Twitch Extension-style surface, and the winning quest appears in an OBS browser overlay while the streamer keeps playing.

The current MVP supports Twitch-facing surfaces only. The core contracts are platform-neutral so future adapters can support other streaming services without rebuilding the quest system.

## Submission README

This README directly covers the four repository requirements for the Garena submission:

1. [Setup instructions](#1-setup-instructions)
2. [Architecture overview](#2-architecture-overview)
3. [Relevant prompts and agent configurations](#3-prompts-and-agent-configurations)
4. [Third-party libraries, models, datasets, and APIs](#4-third-party-libraries-models-datasets-and-apis)

Supporting product, evidence, slide, and recording documents are linked later, but they do not replace these four sections.

## 1. Setup Instructions

### Requirements

- Node.js 20.9 or newer; Node.js 22 is recommended.
- npm, using the committed `package-lock.json`.
- A current desktop browser.
- OBS Studio for the broadcast-overlay workflow.
- A Twitch developer account and locally installed Extension only when testing inside Twitch.
- A Docker-compatible runtime only when running the optional local Supabase stack.

### Install and run locally

The judged MVP has a credential-free algorithmic path. A basic local run does not require an AI-provider key, Twitch secret, or Supabase project.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js prints the active URL if port 3000 is already occupied.

### Environment variables

All values in `.env.example` are empty placeholders. Real credentials must remain in `.env.local` or deployment-secret storage and must never be committed.

| Variable | Required for basic local demo | Purpose |
| --- | --- | --- |
| `CHATXPT_LLM_ENABLED` | No | Explicit server-side opt-in. It defaults to `false`, so merely having a key cannot trigger provider spend. |
| `CHATXPT_LLM_PROVIDER_ID` | No | Privacy-safe provider label used in canonical generation metadata. |
| `CHATXPT_LLM_TIMEOUT_MS` | No | Bounded provider deadline before credential-free algorithmic fallback. |
| `OPENAI_API_KEY` | No | Server-only credential for the controlled OpenAI Responses path. Missing credentials preserve algorithmic generation. |
| `OPENAI_MODEL` | No | Pins the server-side model for a controlled provider run. |
| `OPENAI_BASE_URL` | No | Optional only for an explicitly approved Responses-compatible endpoint. |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Public project URL for the accepted Supabase persistence/realtime target. Empty values select local memory mode. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No | Publishable Supabase client key when a project is configured. |
| `SUPABASE_SECRET_KEY` | No | Server-only Supabase secret for privileged operations. Never expose it through `NEXT_PUBLIC_*`. |
| `TWITCH_CLIENT_ID` | No | Twitch application client identifier for real Twitch integration work. |
| `TWITCH_CLIENT_SECRET` | No | Server-only Twitch application secret. |
| `TWITCH_EXTENSION_CLIENT_ID` | No | Identifier for the registered Twitch Extension. |
| `TWITCH_EXTENSION_ASSET_ORIGIN` | Only for cross-origin Local Test assets | Exact asset origin allowed to call broadcaster Studio endpoints, such as `https://localhost:8080`. Hosted Test derives the trusted `https://<extension-id>.ext-twitch.tv` origin from `TWITCH_EXTENSION_CLIENT_ID`. |
| `TWITCH_EXTENSION_SECRET` | For Twitch tests | Base64 Extension signing secret used only by the server to verify Twitch JWTs and derive pseudonymous, session-scoped participation identity. |
| `TWITCH_EVENTSUB_SECRET` | For Twitch chat tests | Independent server-only HMAC secret used to verify EventSub webhook delivery. |
| `CHATXPT_OBS_OVERLAY_SETUP_KEY` | For secure OBS URLs | Server-only signing key for short-lived, session-scoped overlay grants. Studio issues the normal setup URL without asking the streamer to enter this key. |
| `CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY` | For authenticated capture | Server-only signing key for short-lived, session-scoped normalised gameplay ingress grants. Studio authorises the normal capture flow through its HttpOnly session cookie. |
| `CHATXPT_STUDIO_SETUP_KEY` | No | Server-only diagnostic bootstrap key of at least 32 characters. Twitch OAuth is the normal Studio entry; the key is never exposed by the normal product UI. |
| `CHATXPT_HOSTED_BOARD_SECRET` | For hosted fallback | Server-only HMAC secret for anonymous, session-scoped hosted Quest Board viewer grants. |
| `NEXT_PUBLIC_APP_ENV` | No | Environment label; the example uses `local`. |

Legacy Supabase projects may use the aliases documented in [.env.example](.env.example), but each environment should configure only one key pair.

### Local product surfaces

| Surface | URL | Purpose |
| --- | --- | --- |
| ChatXPT Studio | [http://localhost:3000/studio](http://localhost:3000/studio) | Canonical authenticated management surface for starting the broadcaster session, saved defaults, integration health, and sidequest control. |
| Legacy diagnostic control room | [http://localhost:3000/diagnostics/control-room](http://localhost:3000/diagnostics/control-room) | Preserved diagnostic surface; it is not the canonical finals workflow. |
| OBS overlay | Generated in Studio Test Lab | Authenticated transparent `/obs-overlay` browser-source output for vote and active-quest states. |
| Viewer Twitch Extension panel | [https://localhost:3000/viewer.html](https://localhost:3000/viewer.html) | Authenticated viewer voting surface when opened by Twitch Local Test. Direct browser access intentionally cannot vote. |
| Twitch configuration page | [http://localhost:3000/config.html](http://localhost:3000/config.html) | Local Twitch Extension configuration path. |
| Twitch live controls | [http://localhost:3000/live-config.html](http://localhost:3000/live-config.html) | Compact broadcaster controls for Twitch's Live Config area. |
| Hosted Quest Board fallback | `http://localhost:3000/quest-board/<roomCode>` | ChatXPT-hosted participation fallback when an Extension is unavailable. |
| UI diagnostics | [http://localhost:3000/diagnostics/ui-harness](http://localhost:3000/diagnostics/ui-harness) | Clearly labelled fixture/diagnostic states for local testing, not live evidence. |
| OBS extraction diagnostic | [http://localhost:3000/diagnostics/gameplay-extraction](http://localhost:3000/diagnostics/gameplay-extraction) | Local OBS Virtual Camera connection, exact-device selection, and bounded multi-game analysis. It never creates submission evidence automatically. |

### OBS browser-source setup

1. Start ChatXPT with `npm run dev`.
2. In OBS, add a **Browser** source to the scene that contains the game or screen capture.
3. In Studio Test Lab, choose **Generate OBS URL**, copy the session-scoped `/obs-overlay` URL, and use it as the Browser source URL. Do not share its fragment token.
4. Use a 1280 by 720 browser-source canvas, or match the output resolution of the OBS scene.
5. Place the ChatXPT browser source above the gameplay source in OBS's Sources list.
6. Confirm that the browser source is visible, then publish a vote from Studio.
7. Keep the source in the saved OBS scene. Future streams can reuse the scene without repeating this setup.

The overlay is broadcast output, not the primary voting or configuration surface. Viewers vote through the Twitch Extension-style panel, the hosted Quest Board fallback, or `1`/`2`/`3` Twitch chat as the final fallback.

### Twitch Extension local-test setup

Set the base64 `TWITCH_EXTENSION_SECRET` in `.env.local`, then run the HTTPS development server:

```bash
npm run dev:twitch
```

Trust the one-time local certificate warning in the test browser, then configure the registered Extension version in the Twitch Developer Console with:

| Twitch setting | Value |
| --- | --- |
| Testing Base URI | `https://localhost:3000/` |
| Configuration Path | `config.html` |
| Live Configuration Path | `live-config.html` |
| Panel Viewer Path | `viewer.html` |
| Extension type | Panel; enable additional video placements only if they are intentionally being tested |

Configure `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_EVENTSUB_SECRET`, and `CHATXPT_PUBLIC_BASE_URL`, then open `/studio` and choose **Connect Twitch**. The state-bound OAuth callback validates the broadcaster, imports the channel's current game, creates or reopens the preparing session, and requests the supported chat EventSub subscription when the public callback origin is HTTPS. Then install and activate the Local Test Extension version on the broadcaster's channel. Twitch `onAuthorized` supplies refreshable broadcaster and viewer Extension JWTs: Config and Live Config require the signed broadcaster role, while the viewer surface derives a non-reversible session voter key and routes votes through the canonical orchestrator and Role 3 engine. A direct `.html` tab is expected to show an authorization recovery message because browser-created identities are not accepted.

The upload package under `twitch-extension/` uses a build-owned exact EBS origin in `assets/environment.js`; replace it with the deployed HTTPS ChatXPT origin before Hosted Test and add that domain to Twitch's URL-fetching allowlist. If Local Test assets are served from a separate origin, set that exact base origin in `TWITCH_EXTENSION_ASSET_ORIGIN`; production Asset Hosting is restricted to the registered `TWITCH_EXTENSION_CLIENT_ID` origin. Automated signed-token tests and local diagnostic state are not proof of a real Twitch run, public approval, or cloud persistence; record real Local/Hosted Test evidence separately.

### Optional local Supabase stack

The product keeps a memory fallback when Supabase is not configured. To exercise the reproducible local database workflow, first start a Docker-compatible runtime, then follow [supabase/README.md](supabase/README.md):

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
npm run supabase:test
```

Source inspection and static migration tests do not prove a real Supabase cloud round trip. Any cloud claim must have a matching evidence-manifest entry.

### Verify the repository

For a memory-backed production-server smoke, configure the Twitch and local setup secrets in `.env.local`, then start the built app on the smoke runner's default port:

```bash
npm run build
PORT=3210 npm start
```

In a second terminal, run:

```bash
npm run smoke
```

The smoke command loads `.env.local`, exercises the canonical Studio, Twitch readiness, hosted-board, Gameplay Capture, EventSub verification, OBS overlay, and page-mount boundaries, and reports its memory-backed limitations. It is not real Twitch, OBS camera, Supabase Cloud, or deployment evidence.

Set `CHATXPT_SMOKE_BASE_URL` in the invoking terminal only when the server is not at `http://localhost:3210`.

Run the complete repository gate:

```bash
npm run check
```

This runs linting, TypeScript checks, role-boundary and repository-hygiene enforcement, evidence and demo-runbook validation, secret-exposure tests, the Vitest suite, a production build, and a built-client secret scan. Focused commands such as `npm run test:integration`, `npm run test:persistence`, and `npm run test:contracts` are also available in [package.json](package.json).

## 2. Architecture Overview

### End-to-end product flow

```text
Twitch activity + OBS/gameplay frames + streamer profile
                         |
                         v
        normalisation and signal extraction
                         |
                         v
       gameplay snapshot + audience intelligence
                         |
                         v
       exactly three sidequest candidates
                         |
                         v
 deterministic validation, safety, and lifecycle rules
                         |
                         v
 Twitch Extension / hosted board / chat fallback voting
                         |
                         v
 authoritative winner -> OBS overlay -> result/history
```

ChatXPT does not host livestream video. Twitch remains the video and channel surface; ChatXPT supplies stream intelligence, participation, and broadcast graphics around it.

### Component boundaries

| Layer | Responsibility | Main repository area |
| --- | --- | --- |
| Platform-neutral core | Versioned domain contracts for sessions, signals, candidates, votes, quest state, progress, results, and role-specific view models | `src/core/` |
| Integrations and orchestration | Twitch/OBS boundaries, authentication, command deduplication, persistence, revisioning, and realtime projection | `src/integrations/`, `src/realtime/`, thin `src/app/` routes |
| AI intelligence and extraction | OBS frame sampling, lightweight visual analysis, selective OCR boundary, noisy-signal aggregation, audience analysis, and candidate generation | `src/extraction/`, `src/ai/` |
| Quest engine | Deterministic timing, validation, safety, veto, vote, activation, completion, scoring, and fallback rules | `src/quest-engine/` |
| Streamer experience | Studio, Twitch configuration/live controls, status, preferences, automation, review, analytics, and recovery UI | `src/streamer/`, `src/design-system/` |
| Viewer experience | Twitch Extension voting, hosted Quest Board, vote acknowledgement/tally, active quest, results, reconnect states, and OBS overlay visuals | `src/viewer/` |
| Route composition | Next.js pages and API endpoints that mount role-owned modules | `src/app/` |
| Persistence target | Supabase schema, row-level security, realtime policy, migrations, and local CLI workflow | `supabase/` |

Role 1 maintains shared contracts and orchestration. Role 2 is responsible for input analysis and candidate generation. Role 3 remains the deterministic runtime authority over quest validity and lifecycle. Roles 4 and 5 lead the streamer and viewer experiences. These labels define module responsibility, not edit permission: under D-071 any contributor may implement across roles, while public ports still prevent one module from importing another module's private implementation.

### Current runnable path versus production-shaped path

The repository intentionally distinguishes what can be shown locally today from what is implemented as a production boundary:

| Capability | Current runnable local behaviour | Production-shaped direction / evidence boundary |
| --- | --- | --- |
| Quest generation | `/api/sidequests` validates input and returns three credential-free algorithmic options. The optional model path requires both explicit enablement and a server key; failure still falls back algorithmically. | Role 2 now exposes a canonical structured-output strategy over normalized gameplay, audience, and profile context. Role 3 remains the deterministic validation/replacement authority. No external model is required for the judged MVP. |
| Viewer participation | Studio stages a local diagnostic cycle; `/viewer.html` accepts only verified Twitch Extension JWTs and routes votes through the canonical revisioned memory ledger with private acknowledgement/recovery. | Supabase adapters implement the same channel lookup, vote ledger, and private recovery boundaries. Real Twitch/Supabase evidence is claimed only after a recorded external run. |
| Overlay state | The local overlay uses same-origin state, `BroadcastChannel`, and `/api/overlay-state` so Studio and OBS can reflect vote/quest changes. | OBS remains an output adapter driven by sanitised `OverlayViewModel` state from the orchestrator. |
| Persistence and realtime | Blank Supabase configuration selects the credential-free memory runtime. | Role 1 includes Supabase-backed repository/realtime adapters and schema/RLS checks. A real cloud run is only claimed when recorded in `docs/evidence/manifest.json`. |
| Gameplay understanding | The Studio can expose local screen-capture-derived activity signals and clearly labelled manual/diagnostic context where used. Unknown facts remain unknown. | Role 2's extraction boundary supports real OBS Virtual Camera frames, lightweight motion/visual algorithms, bounded OCR, timestamps, confidence, and provenance. A fixture is never presented as live extraction evidence. |
| Twitch Extension | Local/Hosted Test paths, HS256 JWT verification, channel/session mapping, anonymous and opaque-viewer participation, token refresh, canonical vote handling, private recovery, and the Role 5 viewer surface are implemented. | Public release, Twitch-side Local/Hosted Test success, and real-channel evidence still require external configuration and recorded proof. |

### State, safety, and failure handling

- Command and state contracts carry session, cycle, revision, and provenance information so stale or duplicate actions can be rejected.
- Persistence occurs before realtime publication in the production-shaped orchestrator boundary.
- Gameplay and audience observations include timestamps and confidence. Stale, low-confidence, or unavailable facts are excluded or represented as `unknown`.
- AI output is never authoritative. Role 3 rules enforce safety, feasibility, diversity, timing, streamer boundaries, and lifecycle transitions.
- The system preserves a credential-free generator and deterministic fallback library so provider failure cannot stop the main workflow.
- Secrets stay server-side; client bundles are scanned for configured secret values and forbidden environment names.
- Synthetic gameplay/chat data is restricted to automated tests and clearly labelled diagnostics.

The deeper target-architecture description is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), the implementation and major-file walkthrough is in [docs/CODEBASE_GUIDE.md](docs/CODEBASE_GUIDE.md), and the binding role-to-role seams are in [docs/build-plans/INTEGRATION-CONTRACT.md](docs/build-plans/INTEGRATION-CONTRACT.md).

## 3. Prompts and Agent Configurations

ChatXPT uses two different kinds of instructions: runtime quest-generation policy and repository-development agent configuration. They are disclosed separately below.

### Runtime quest-generation instructions

The submitted judged path remains credential-free and algorithmic. It does not require a model prompt. The repository also includes an explicitly enabled, server-only controlled provider path for owner-authorised evaluation.

| File | Role | Important constraints |
| --- | --- | --- |
| `src/lib/openai-engine.ts` | Legacy optional server-side model adapter | Requests exactly three structured quests; infers only a broad game family; avoids invented HUD/game facts; requires distinct play patterns, short readable wording, measurable completion, and safe boundaries; validates against a strict JSON schema. |
| `.codex/skills/chatxpt-prototype/references/quest-policy.md` | Human-readable quest policy | Defines three distinct options, signal-aware adaptation, rejection conditions, and producer approval. |
| `src/ai/algorithmic-candidates.ts` | Accepted credential-free Role 2 strategy | Produces exactly three game-neutral candidates, filters stale/low-confidence signals, avoids recent duplicate titles, records source signal IDs, confidence, method, and generation time. |
| `src/ai/openai-candidate-strategy.ts` | Canonical controlled provider strategy | Sends only normalized snapshots/profile preferences, excludes streamer identity and raw chat, requires exactly three strict drafts, and rejects invented signal citations. |
| `src/ai/server.ts` | Server-only provider composition | Requires explicit enablement and a server credential, applies a bounded timeout, and retains automatic algorithmic fallback. |
| `src/lib/mock-engine.ts` | Legacy local `/api/sidequests` fallback | Supplies the currently mounted credential-free local candidate route. Despite the filename, its response is labelled `algorithmic`; fixtures remain separate from live evidence. |
| `src/quest-engine/validation.ts` | Deterministic authority after generation | Validates candidate safety and quality before a candidate can enter the quest lifecycle. |
| `src/ai/PROVIDER_EVALUATION.md` | Provider integration evaluation | Compares latency, privacy, cost, structured output, and reliability without declaring a provider live. |
| `src/quest-engine/PROVIDER_QUALITY_RUBRIC.md` | Provider quest-quality evaluation | Defines quest quality and engine-fit criteria for any future controlled model evaluation. |

The core runtime policy is:

1. Use only supported gameplay, audience, and streamer-profile facts.
2. Return exactly three choices that differ in actual play pattern.
3. Keep titles glanceable and instructions easy to understand during gameplay.
4. Give every quest a measurable duration or completion condition, difficulty, and reward.
5. Reject unsafe, illegal, discriminatory, sexual, humiliating, monetary, wagering, real-world physical, griefing, or non-consensual team-sabotage requests.
6. Fall back to safe game-neutral quests when context is unknown, stale, low-confidence, unsupported, or provider output is invalid.
7. Treat deterministic validation and streamer veto rules as authoritative over any AI output.

### Repository agent configurations

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Root authority for product scope, golden workflow, five-role responsibility, open cross-role contribution, safety, evidence, collaboration, and delivery rules followed by contributors and coding agents. |
| `.codex/skills/chatxpt-prototype/SKILL.md` | Project-specific Codex workflow for implementing and validating ChatXPT changes. |
| `.codex/skills/chatxpt-prototype/agents/openai.yaml` | Codex skill metadata and default invocation prompt: `Use $chatxpt-prototype to implement the next demo-ready ChatXPT feature.` |
| `.codex/skills/chatxpt-prototype/references/quest-policy.md` | Shared sidequest policy loaded by the ChatXPT skill for generation-related work. |
| `docs/TEAM_PLAYBOOK.md` | Human/agent setup, Git, task selection, verification, handoff, and pull-request procedure. |
| `docs/roles/ROLE-*.md` | Role-specific authority, design and implementation responsibilities, and escalation boundaries. |
| `docs/build-plans/*.md` | Phase gates, contracts, acceptance evidence, and implementation plans. |
| `docs/DECISIONS.md` | Durable decisions, including the approved server-side model, fallback, privacy, and Minecraft demo boundary. |

These agent files guide repository work; they are not hidden runtime prompts sent to viewers or Twitch. Provider credentials, raw model names, and prompt editing are also not exposed as normal streamer controls.

### Model/provider status

D-072 permits the judged MVP to use the OpenAI Responses API with exact model `gpt-5.6-terra`. It remains an opt-in server path requiring `CHATXPT_LLM_ENABLED=true`, a server-only team-owned key, and existing prepaid or promotional credit. OpenAI documents no API free tier for this model, so missing credential/credit/quota/provider availability immediately preserves the credential-free algorithmic route; Role 3 still validates or replaces every candidate deterministically. The adapter sends only bounded normalised context, sets `store: false`, retains no prompt/output/vendor payload in ChatXPT, and never sends raw frames, raw chat, viewer identity, Twitch IDs, usernames, or secrets. OpenAI documents that API data is not used for training by default unless the account opts in, but default abuse-monitoring logs may retain customer content for up to 30 days unless the API project is approved for Zero Data Retention. Source presence is not runtime evidence, and no provider call is claimed without a manifest entry. See the official [GPT-5.6 Terra model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra) and [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint).

## 4. Third-Party Libraries, Models, Datasets, and APIs

### Runtime libraries

Exact versions are pinned in [package.json](package.json) and `package-lock.json`.

| Library | Version | Use in ChatXPT |
| --- | --- | --- |
| Next.js | 16.2.12 | Application framework, routes, API handlers, development server, and production build. |
| React / React DOM | 19.2.8 | Streamer, viewer, Twitch-shell, diagnostics, and overlay interfaces. |
| Zod | 4.4.3 | Runtime validation for domain contracts, requests, commands, view models, and structured provider output. |
| Supabase JS | 2.111.0 | Persistence and realtime adapter for the accepted production target. Local memory remains available. |
| `server-only` | 0.0.1 | Build-time protection for server-only integration modules and secrets. |
| OpenAI SDK | 7.3.0 | D-072-approved server-side structured-output adapter with mandatory credential-free fallback. |
| Tesseract.js | 7.0.0 | Optional bounded OCR adapter for named gameplay-frame crops. Installation alone is not live OCR evidence. |

Development and test tooling includes TypeScript 5.9.3, ESLint 9.39.2, Vitest 4.1.10, the Supabase CLI 2.111.0, and the corresponding Node/React type packages.

### Models

| Model/provider | Submitted status | Data and credential boundary |
| --- | --- | --- |
| Credential-free algorithmic generation | Permanent judged-MVP fallback | Runs on the same real inputs without an external model, credential, or quota. |
| OpenAI `gpt-5.6-terra` | Approved opt-in judged-MVP path | Team-owned key remains server-side; existing credit, explicit enablement, 8-second timeout, strict exactly-three validation, and algorithmic fallback are mandatory. No call is claimed without recorded execution. |
| Groq `openai/gpt-oss-20b` | Superseded evaluation candidate | Not adopted or configured after D-072. |

### External services and APIs

| Service/API | Intended role | Current claim boundary |
| --- | --- | --- |
| Twitch | MVP streaming platform: application/Extension surfaces, chat activity, local/hosted test, and future authenticated viewer participation | Local Extension-style interaction is implemented. Public approval, JWT identity, and real-channel integration require separately recorded evidence. |
| OBS Studio | Real gameplay/screen input and Browser Source broadcast output | The overlay URL is implemented. Real OBS/Virtual Camera extraction is claimed only when visibly recorded and entered in the evidence manifest. |
| Supabase Free | Accepted persistence and realtime target | Memory fallback and adapters/schema exist. Real cloud operation is not claimed without a recorded cloud run. |
| Vercel | Planned preview/production host | No deployment claim is made until a deployment artifact is recorded. |
| OpenAI API | Approved optional candidate-generation API | Requires a private team-owned credited key; no client secret, provider dependency, or runtime claim is implied without recorded evidence. |

YouTube, Discord, TikTok, Kick, and other streaming platforms are not implemented in the Twitch MVP. They may appear only as future or `Coming Soon` integrations.

### Datasets and assets

- No third-party datasets are bundled or used as a training dataset in this repository.
- Synthetic gameplay, chat, audience, and UI data are test/diagnostic fixtures only.
- Team-owned or explicitly authorised gameplay recordings may be used for evaluation after privacy review.
- Raw OBS frames are ephemeral and must not be committed.
- Private Twitch chat exports, viewer identifiers, account names, credentials, and unrestricted recordings must not be committed.
- Twitch upload assets and screenshots demonstrate packaging or UI state only; they do not prove Twitch review or public release.

The complete disclosure and claim rules are maintained in [docs/THIRD_PARTY_DISCLOSURES.md](docs/THIRD_PARTY_DISCLOSURES.md). An integration test checks that package dependencies remain covered by that disclosure.

## Product Surfaces and Fallbacks

The golden Twitch workflow is:

```text
streamer starts a session
-> Twitch/gameplay adapters emit normalised events
-> ChatXPT decides whether the moment is suitable
-> exactly three validated sidequests are proposed
-> streamer automation/veto rules are applied
-> viewers vote through Extension, hosted board, or chat fallback
-> the winner appears in the OBS overlay
-> success, failure, cancellation, or skip updates history/rewards
```

The viewer-facing Twitch Extension is the primary participation surface. The hosted Quest Board is the first fallback, and `1`/`2`/`3` Twitch-chat voting is the final fallback. Chat messages may also inform audience analysis, but reading chat and casting an authoritative vote are separate responsibilities.

## Repository Map

| Path | Contents |
| --- | --- |
| `src/app/` | Thin Next.js pages and API composition. |
| `src/core/` | Canonical platform-neutral contracts, ports, and test-only fixtures. |
| `src/integrations/`, `src/realtime/` | Role 1 adapters, orchestration, persistence, and realtime boundaries. |
| `src/ai/`, `src/extraction/` | Role 2 intelligence, candidate generation, gameplay extraction, and evaluation. |
| `src/quest-engine/` | Role 3 deterministic validation, lifecycle, safety, scoring, and fallback logic. |
| `src/streamer/`, `src/design-system/` | Role 4 streamer UI and shared visual system. |
| `src/viewer/` | Role 5 viewer participation and OBS overlay UI. |
| `supabase/` | Migrations, RLS/realtime policy, and local database workflow. |
| `tests/integration/` | Cross-role contract and workflow tests. |
| `docs/` | Architecture, decisions, team process, evidence, research, and submission documents. |
| `.codex/skills/chatxpt-prototype/` | Project-specific coding-agent workflow and quest-policy reference. |
| `twitch-extension/`, `release/` | Twitch Extension package source and local-test release artifact. |

## Evidence and Limitations

Passing source tests, fixture screenshots, and diagnostics do not prove real Twitch, OBS, cloud, or external-provider operation. Every runtime claim used as submission evidence must be recorded in [docs/evidence/manifest.json](docs/evidence/manifest.json) with the input, source revision, command or interaction, artifact, reviewer, and limitations.

The current prototype truth table is [docs/submission/END_TO_END_PROTOTYPE_CHECK.md](docs/submission/END_TO_END_PROTOTYPE_CHECK.md). The repository readiness check is [docs/submission/REPOSITORY_SUBMISSION_CHECK.md](docs/submission/REPOSITORY_SUBMISSION_CHECK.md).

## Contributor Workflow

Every contributor and coding agent must read [AGENTS.md](AGENTS.md), [docs/TEAM_PLAYBOOK.md](docs/TEAM_PLAYBOOK.md), the assigned role guide/TODO, [docs/build-plans/INTEGRATION-CONTRACT.md](docs/build-plans/INTEGRATION-CONTRACT.md), the assigned build plan, and [docs/DECISIONS.md](docs/DECISIONS.md). Any contributor may change any role directory. Changes stay within the destination module's responsibility, integrate through public ports, disclose and deconflict cross-role overlap with Role 1, include focused tests, and add a change fragment under `changes/`.

## Submission Packet

The owner-facing artifact map is [docs/submission/SUBMISSION_PACKET_STATUS.md](docs/submission/SUBMISSION_PACKET_STATUS.md). The deck, video runbook, prototype truth check, and readiness check support the submission process; this README is the repository artifact that directly contains setup, architecture, prompt/agent, and third-party disclosure sections.
