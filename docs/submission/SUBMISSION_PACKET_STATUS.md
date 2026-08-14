# Submission Packet Status

**Date:** 2026-08-09  
**Purpose:** One owner-facing map from the Garena submission requirements to the prepared ChatXPT repository artifacts.

## Current Verdict

The repository-side submission materials are prepared and linked below: source/setup docs, architecture, disclosures, final editable deck/PDF, five-minute recording runbook, extension package notes, prototype check, and evidence boundaries.

The final submission is not complete until the project owner records/uploads the final video, confirms Google Drive access, invites `garena-ai-build-challenge` to the private repository, and sends the email to `outreachsg@garena.com`.

## Prepared Repository Artifacts

| Requirement | Prepared artifact | Status | Notes |
| --- | --- | --- | --- |
| Setup instructions | [`README.md` section 1](../../README.md#1-setup-instructions) | Ready | Includes prerequisites, credential-free install, environment variables, local routes, OBS setup, Twitch Extension Local Test settings, optional Supabase, and verification commands. |
| Architecture overview | [`README.md` section 2](../../README.md#2-architecture-overview) | Ready | Includes the end-to-end flow, role/module boundaries, runnable-demo versus production-shaped paths, state authority, safety, and failure handling. `docs/ARCHITECTURE.md` remains the deep dive. |
| Relevant prompts and agent configurations | [`README.md` section 3](../../README.md#3-prompts-and-agent-configurations) | Ready | Separately discloses runtime quest policy, the legacy optional model prompt, the credential-free judged path, deterministic validation, and repository agent instructions/configuration. |
| Third-party libraries, models, datasets, and APIs | [`README.md` section 4](../../README.md#4-third-party-libraries-models-datasets-and-apis) | Ready | Includes dependency versions/purposes, model/provider status, external-service claim boundaries, dataset/asset use, and privacy rules. `docs/THIRD_PARTY_DISCLOSURES.md` remains the full disclosure register. |
| Product explanation | `docs/PRODUCT_BRIEF.md` | Ready | Covers problem, users, product promise, core loop, differentiation, MVP criteria, and deferred scope. |
| Competition deck source | `docs/submission/SLIDE_DECK_PROPOSAL.md` | Ready | Final 15-slide narrative, research sources, evidence language, and per-slide repo lens. |
| Editable competition deck | `docs/submission/chatxpt-slide-deck-proposal.pptx` | Ready | Editable 16:9 PowerPoint with speaker-note source blocks and local product visuals. |
| Competition deck PDF | `docs/submission/chatxpt-slide-deck-proposal.pdf` | Ready | Submission-ready 15-page PDF; visually verified after PowerPoint export. |
| Five-minute video plan | `docs/submission/MANUAL_TEST_RECORDING_RUNBOOK.md` | Ready | Includes Joel handoff, required screen list, timing, what to claim, and what not to claim. |
| Prototype truth table | `docs/submission/END_TO_END_PROTOTYPE_CHECK.md` | Ready | States what the current local prototype can demonstrate and which live evidence claims remain unproved. |
| Repository completeness check | `docs/submission/REPOSITORY_SUBMISSION_CHECK.md` | Ready, but dated to earlier merged main check | It truthfully lists remaining live-evidence and owner-action gaps. |
| Evidence rules and manifest | `docs/evidence/GOLDEN_REHEARSAL_RUNBOOK.md`, `docs/evidence/manifest.json` | Ready for recorded evidence | Current manifest has inspection-only and fixture-only evidence; add real recording entries only after privacy-reviewed runs. |
| Twitch Extension test package | `release/chatxpt-twitch-extension-finals.zip`, `twitch-extension/README.md` | Ready for Local/Hosted Test configuration | Uses Twitch `onAuthorized`, a build-owned exact EBS origin, and signed canonical viewer/vote routes; not real Twitch delivery or public approval evidence. |
| UI/control-room state for recording | `http://localhost:3000/` | Ready locally | Top cockpit has two status bars, four main actions, and ribbon toggles for Studio, Stream analytics, Game signals, and Vote / overlay. |
| OBS overlay URL | `http://localhost:3000/overlay?obs=1` | Ready locally | Add as OBS Browser Source above gameplay/screen capture. |
| Viewer voting URL | `https://localhost:3000/viewer.html` through Twitch Local Test | Implemented; external run required | Direct browser access cannot invent a viewer identity. Joel/viewer votes through the installed panel; Twitch chat `1`/`2`/`3` remains the final fallback. |

## Five-Minute Video Contents To Capture

Use `docs/submission/MANUAL_TEST_RECORDING_RUNBOOK.md` as the source of truth. The final edit should include:

1. What ChatXPT is: gameplay state plus audience activity plus streamer preferences become safe sidequests.
2. OBS one-time setup: gameplay/screen source below the ChatXPT overlay browser source.
3. Future-stream setup: OBS remembers the scene, so the streamer starts from the saved setup.
4. Streamer Studio: two status bars, four cockpit buttons, and ribbon views for Studio, Stream analytics, Game signals, and Vote / overlay.
5. Live run-through: streamer plays, ChatXPT samples the selected screen/window, and three quests are generated.
6. Viewer participation: Joel opens `/viewer.html` or the configured Twitch Extension local test panel and votes within the short window.
7. Overlay payoff: the winning quest appears on the OBS overlay.
8. Analytics and quest generator explanation: show motion/visual-change/tempo/confidence/chat/vote signals, then explain safety and fallback boundaries.
9. Outcome: complete/fail/clear the quest and close on reusable future-stream workflow.

Keep all claims labelled: real local screen capture only if selected on camera; real Twitch chat only if live messages appear; local Extension-style voting is local demo evidence; fixture/diagnostic paths are not live evidence.

## Google Drive Folder Checklist

Create the final Google Drive folder with the exact submitted team name. Put these in it:

1. `chatxpt-slide-deck-proposal.pdf` or the final refreshed deck PDF.
2. Final maximum five-minute demo video.
3. Repository link or equivalent source-access note.
4. Any short README/note needed to explain evidence labels and the exact source commit.

Before emailing, test Drive access from the intended reviewer access mode. Do not include unrestricted links in Git.

## Final Owner Actions Still Required

These cannot be completed by repository edits alone:

1. Record and privacy-review the final demo video.
2. Upload the deck PDF and demo video to the Google Drive folder.
3. Confirm the folder is accessible to the intended reviewer.
4. Invite `garena-ai-build-challenge` to the private GitHub repository.
5. Rerun `npm run check` on the exact final commit after all docs/code edits.
6. Record the final commit, Drive link, sender, recipient, and submission time outside the repository or in a private-safe submission note.
7. Send the submission email to `outreachsg@garena.com`.

## What Not To Overclaim

- The `/viewer.html` route and signed-fixture tests prove JWT/EBS application behaviour, not real Twitch JWT issuance, Local/Hosted Test delivery, or public Extension approval.
- The local overlay route proves OBS can load the page only when OBS is visibly using that URL.
- Fixture screenshots and diagnostic harnesses do not prove real Twitch, real OBS capture, real Supabase cloud, Vercel deployment, or two external viewers.
- Unsupported gameplay facts must remain `unknown`; do not narrate guessed health, kills, score, or phase as live extraction unless the recording actually proves them.
