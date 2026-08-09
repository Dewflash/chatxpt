# Third-Party Disclosures

**Owner:** Role 1 (`Dewflash`)

This document is the source for submission disclosures. It describes what is currently committed or planned for the Twitch MVP without implying that unverified services are live.

## Runtime Dependencies

| Dependency | Version source | Purpose | Client exposure | Current evidence boundary |
| --- | --- | --- | --- | --- |
| `next` | `package.json` / `package-lock.json` | Application framework, server routes, build, and local/production rendering | Client and server framework code | Local build/test evidence only until Vercel deployment is recorded. |
| `react` / `react-dom` | `package.json` / `package-lock.json` | Streamer, viewer, diagnostic, and overlay UI rendering | Client UI runtime | Fixture/local rendering evidence unless a real browser run is recorded. |
| `zod` | `package.json` / `package-lock.json` | Runtime validation for contracts, commands, view models, and provider output | Client and server validation where imported | Automated schema/test evidence. |
| `@supabase/supabase-js` | `package.json` / `package-lock.json` | Planned/implemented Role 1 persistence and realtime adapter | Server-side product writes; browser access only through authorised public rules | Local/static adapter evidence until a real Supabase Free project run is recorded. |
| `server-only` | `package.json` / `package-lock.json` | Build-time guard for server-only integration modules | Not a product feature | Build-time/source evidence. |
| `openai` | `package.json` / `package-lock.json` | Legacy optional server-side adapter during migration | Server only; no `NEXT_PUBLIC` provider key allowed | Not the accepted MVP provider and no paid usage is authorised. |
| `tesseract.js` | `package.json` / `package-lock.json` | Free local selective OCR engine for Role 2's bounded named-crop evidence path | Client/runtime worker exposure only where Role 2 mounts the injected OCR adapter | Installed dependency and fixture plumbing only; live OCR requires deployed worker/CSP/language-data evidence and real OBS input evidence. |

## Development And Test Dependencies

| Dependency | Version source | Purpose | Evidence boundary |
| --- | --- | --- | --- |
| `typescript` | `package.json` / `package-lock.json` | Static type checking | `npm run typecheck`. |
| `eslint` / `eslint-config-next` | `package.json` / `package-lock.json` | Linting | `npm run lint`. |
| `vitest` | `package.json` / `package-lock.json` | Unit, contract, and integration tests | `npm test` and focused role suites. |
| `supabase` | `package.json` / `package-lock.json` | Local database workflow and migration checks | Requires a Docker-compatible runtime for local DB execution; static checks are not cloud evidence. |
| `@types/node` / `@types/react` / `@types/react-dom` | `package.json` / `package-lock.json` | TypeScript compile-time declarations | `npm run typecheck`. |
| Node.js | `.nvmrc`, `package.json` engines | Runtime for scripts, checks, and Next.js | Clean-clone/setup evidence must record the actual installed version. |

## External Services

| Service | MVP role | Credential handling | Current status |
| --- | --- | --- | --- |
| Twitch | Only supported streaming platform for MVP: OAuth, chat, Extension, hosted test, and channel activity where configured | Client IDs may be public where Twitch permits; client secrets, tokens, Extension JWT secrets, and broadcaster/viewer identities stay out of Git | Registration/test evidence remains separate and must be recorded in `docs/evidence/manifest.json`. |
| OBS | Real gameplay input via OBS Virtual Camera and broadcast output via Browser Source overlay | No credentials expected; recordings/screenshots must be privacy-reviewed | Local setup evidence remains separate from source inspection. |
| Supabase Free | Accepted persistence/realtime target | Service role keys and project URLs/secrets remain private environment values | Code supports memory fallback; real cloud evidence must be recorded separately. |
| Vercel | Planned deployment host for production/preview | Project tokens and environment values stay outside Git | Deployment evidence is not claimed until a deployment run is recorded. |
| AI provider | No external provider is adopted for the judged MVP under D-055 | Provider keys stay server-side and are not required for the credential-free path | No provider is selected for external adoption in the submitted path; it uses credential-free algorithmic generation plus deterministic Role 3 validation/fallback. Groq `openai/gpt-oss-20b` is evaluation-only for a future controlled trial, not an MVP dependency. |

## Data And Asset Disclosures

- No third-party datasets are bundled in the repository.
- Synthetic gameplay, audience, and UI fixture data are test/diagnostic assets only.
- Team-owned or explicitly authorised gameplay recordings may be used for evaluation only after privacy review and evidence-manifest entry.
- Raw frames are ephemeral and must not be committed.
- Raw Twitch chat exports, personal viewer identifiers, account names, unrestricted media links, and credentials must not be committed.
- Twitch upload placeholder assets are not proof of a reviewed or publicly released Extension.

## Not Implemented In The Twitch MVP

- YouTube, Discord, TikTok, Kick, or any non-Twitch streaming adapter.
- Public developer API, SDK, partner portal, billing, purchases, Bits monetisation, wagering, or persistent reward economy.
- Official game telemetry integrations.
- Arbitrary third-party stream analysis.
- A provider/model picker for normal streamers.

## Submission Claim Rules

- A dependency being installed is not evidence that the related service works.
- A passing fixture test is not live Twitch, OBS, cloud, or provider evidence.
- A real claim must cite a manifest entry with the exact input, command/interaction, source revision, artifact, reviewer, and limitations.
- Mixed evidence must be split into separate claims or state the limitation plainly.
