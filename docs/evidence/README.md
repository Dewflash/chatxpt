# ChatXPT Evidence Manifest

**Owner:** Role 1 (`Dewflash`)

This manifest prevents fixture screenshots from being mistaken for live product evidence and makes deck/video assembly incremental. Role owners provide artifacts; Role 1 records and verifies the claim.

## Evidence classes

- `real`: executed with the named real Twitch, OBS, Supabase/Vercel, AI provider, device, or user input.
- `memory-backed`: integrated runtime behaviour using the production-shaped credential-free memory service.
- `fixture-only`: deterministic component/test/diagnostic state that proves rendering or logic only.
- `inspection-only`: source/configuration review without runtime proof.
- `unverified`: planned or implemented behaviour for which required execution evidence is still missing.

## Manifest

Do not commit account names, tokens, private chat, personal viewer identifiers, or unrestricted share links.

| Evidence ID | Date | Owner | Claim / flow | Surface and viewport/device | Session/cycle revision | Evidence class | Input/service actually used | Commands/checks | Artifact or PR | Reviewer / limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | No judged evidence recorded yet. | — | — | unverified | — | — | — | Await role submissions. |

## Real-test resource matrix

Record responsibility, not credentials or personal account identifiers.

| Resource | Responsible role/person | Ready | Required-by run | Private storage/location | Notes |
| --- | --- | --- | --- | --- | --- |
| Twitch broadcaster account with 2FA | Role 1 | No | Twitch readiness | Agreed private channel | Do not commit identity or tokens. |
| Two allowlisted viewer sessions/accounts | Role 1 coordinates | No | Multi-viewer integration | Agreed private channel | Use separate browsers/profiles or devices. |
| OBS/gameplay machine and raw-game scene | Role 1 coordinates | No | Capture spike | Local machine | Avoid overlay recursion. |
| Mobile/narrow viewer device or emulator | Role 5 with Role 1 | No | Viewer evidence | Local device | Record viewport/device, not personal identity. |
| Screen/video recording owner | Role 1 | No | Evidence/rehearsal | Team-controlled storage | Confirm audio, captions, and privacy before upload. |

## Artifact naming

Use `<date>-<role>-<surface>-<state>-<evidence-class>` and retain the source revision in the manifest. Examples: `2026-08-05-role-4-studio-readiness-fixture-only.png` and `2026-08-08-role-5-two-viewer-vote-real.mp4`.
