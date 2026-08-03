# ChatXPT Evidence Manifest

**Owner:** Role 1 (`Dewflash`)

This manifest prevents fixture screenshots from being mistaken for live product evidence and makes deck/video assembly incremental. Role owners provide artifacts; Role 1 verifies the claim. The authoritative records are machine-readable in `docs/evidence/manifest.json`; this file explains how to contribute safely.

## Evidence classes

- `real`: executed with the named real Twitch, OBS, Supabase/Vercel, AI provider, device, or user input.
- `memory-backed`: integrated runtime behaviour using the production-shaped credential-free memory service.
- `fixture-only`: deterministic component/test/diagnostic state that proves rendering or logic only.
- `inspection-only`: source/configuration review without runtime proof.
- `unverified`: planned or implemented behaviour for which required execution evidence is still missing.

## Required workflow

Do not commit account names, tokens, private chat, personal viewer identifiers, or unrestricted share links.

1. Add or update the artifact through the owning role's normal pull request.
2. Add one entry to `manifest.json` with ID `E-YYYYMMDD-R<role>-NNN`.
3. Record the immutable source commit, branch, PR number, exact command or interaction, input actually used, surface/device/viewport, authoritative revision when applicable, reviewer, and limitations.
4. Use only privacy-safe artifact references:
   - repository artifacts stay under `docs/evidence/artifacts/`;
   - PR evidence uses `PR #<number>`;
   - private team-drive evidence uses a non-link label such as `team-drive-item:golden-run-01`;
   - local evidence uses a non-link label such as `local-artifact:studio-mobile-01`;
   - uncaptured work uses `storage: "none"` and `reference: "not-captured"` only when the evidence remains unverified.
5. Run `npm run check:evidence`, `npm run test:evidence`, and the role's normal checks.

Executed evidence must have a reviewer and an artifact reference. Runtime evidence must name at least one command or interaction. Real evidence must include a real input and every artifact must be marked privacy-reviewed. Fixture, memory, inspection, and unverified inputs cannot be relabelled as real.

The JSON Schema at `docs/evidence/manifest.schema.json` documents the complete entry shape. The repository validator also enforces role/GitHub ownership, class/input consistency, safe artifact locations, unique IDs, source revisions, and privacy restrictions.

## Real-test resource matrix

The `resources` section of `manifest.json` is the authoritative matrix. It assigns the broadcaster, two isolated viewer sessions, OBS/gameplay machine, streamer desktop browser, viewer mobile/narrow browser, and demo recording without recording the underlying account identities or private locations. Update readiness there rather than duplicating it in prose.

`assigned` means responsibility is clear but execution has not yet proved readiness. `owner-action-required` means the named owner must privately create or configure the resource. `ready` requires an evidence entry. `blocked` requires a limitation and recovery note in the related issue or pull request.

## Artifact naming

Use `<date>-<role>-<surface>-<state>-<evidence-class>` and retain the source revision in the manifest. Examples: `2026-08-05-role-4-studio-readiness-fixture-only.png` and `2026-08-08-role-5-two-viewer-vote-real.mp4`.
