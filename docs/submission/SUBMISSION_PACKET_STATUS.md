# Submission Packet Status

**Date:** 2026-08-21
**Purpose:** One owner-facing map from the Garena submission requirements to the prepared ChatXPT repository artifacts.

## Current Verdict

The repository-side submission materials are prepared and linked below: source/setup docs, architecture, disclosures, editable deck/PDF, targeted per-feature research, final Studio live-test runbook, extension package notes, product check, and evidence boundaries.

The final feature argument is now explicit: each material feature must show a targeted pain, the strongest directly relevant supporting evidence with limitations, and the built response passing its named live test. Generic growth research, platform documentation, fixtures, and automated tests cannot substitute for the wrong evidence class.

The final submission is not complete until the project owner records/uploads the final video, confirms Google Drive access, invites `garena-ai-build-challenge` to the private repository, and sends the email to `outreachsg@garena.com`.

## Prepared Repository Artifacts

| Requirement | Prepared artifact | Status | Notes |
| --- | --- | --- | --- |
| Setup instructions | [`README.md` section 1](../../README.md#1-setup-instructions) | Ready | Includes prerequisites, credential-free install, environment variables, local routes, OBS setup, Twitch Extension Local Test settings, optional Supabase, and verification commands. |
| Architecture overview | [`README.md` section 2](../../README.md#2-architecture-overview) | Ready | Includes the end-to-end flow, role/module boundaries, runnable-demo versus production-shaped paths, state authority, safety, and failure handling. `docs/ARCHITECTURE.md` remains the deep dive. |
| Relevant prompts and agent configurations | [`README.md` section 3](../../README.md#3-prompts-and-agent-configurations) | Ready | Separately discloses runtime quest policy, the legacy optional model prompt, the credential-free judged path, deterministic validation, and repository agent instructions/configuration. |
| Third-party libraries, models, datasets, and APIs | [`README.md` section 4](../../README.md#4-third-party-libraries-models-datasets-and-apis) | Ready | Includes dependency versions/purposes, model/provider status, external-service claim boundaries, dataset/asset use, and privacy rules. `docs/THIRD_PARTY_DISCLOSURES.md` remains the full disclosure register. |
| Product explanation | `docs/PRODUCT_BRIEF.md` | Ready | Covers problem, users, product promise, core loop, differentiation, MVP criteria, and deferred scope. |
| Per-feature pain/evidence/build proof | `docs/research/PRODUCT-VALIDATION.md` | Ready for live results | Maps each final Studio, gameplay, analytics, quest, profile, settings, viewer, OBS, and recovery feature to its targeted pain, best evidence, limitation, built response, and exact working proof. |
| Competition deck source | `docs/submission/SLIDE_DECK_PROPOSAL.md` | Ready | Final 15-slide narrative, research sources, evidence language, and per-slide repo lens. |
| Editable competition deck | `docs/submission/chatxpt-slide-deck-proposal.pptx` | Ready | Editable 16:9 PowerPoint with speaker-note source blocks and local product visuals. |
| Competition deck PDF | `docs/submission/chatxpt-slide-deck-proposal.pdf` | Ready | Submission-ready 15-page PDF; visually verified after PowerPoint export. |
| Five-minute video and live-test plan | `docs/submission/MANUAL_TEST_RECORDING_RUNBOOK.md` | Ready for owner execution | Uses the final one-Studio UI and records one uninterrupted Minecraft -> analytics -> three quests -> two viewers -> OBS -> result -> recovery segment, with per-feature pass/fail rows. |
| Product truth table | `docs/submission/END_TO_END_PROTOTYPE_CHECK.md` | Ready | Separates implemented source, automated evidence, and the external proof still required for every final feature. |
| Repository completeness check | `docs/submission/REPOSITORY_SUBMISSION_CHECK.md` | Ready, but dated to earlier merged main check | It truthfully lists remaining live-evidence and owner-action gaps. |
| Evidence rules and manifest | `docs/evidence/GOLDEN_REHEARSAL_RUNBOOK.md`, `docs/evidence/manifest.json` | Ready for recorded evidence | Current manifest has inspection-only and fixture-only evidence; add real recording entries only after privacy-reviewed runs. |
| Twitch Extension test package | `release/chatxpt-twitch-extension-finals.zip`, `twitch-extension/README.md` | Ready for Local/Hosted Test configuration | Uses Twitch `onAuthorized`, a build-owned exact EBS origin, signed canonical viewer/vote routes, exact-origin broadcaster CORS, and current-stream intensity controls; not real Twitch delivery or public approval evidence. |
| UI/control-room state for recording | `http://localhost:3000/studio` | Ready locally | The one Studio app contains Home, Gameplay Engine, Live Analytics, Live Quests, Profile & Defaults, Stream Settings, and Test Lab navigation. |
| OBS overlay URL | Generated inside Studio Test Lab for `/obs-overlay` | Implemented; external run required | Generate the key-free session-scoped read URL and add it as an OBS Browser Source above gameplay capture. Never expose the fragment token. |
| Viewer voting URL | `https://localhost:3000/viewer.html` through Twitch Local Test | Implemented; external run required | Direct browser access cannot invent a viewer identity. Joel/viewer votes through the installed panel; Twitch chat `1`/`2`/`3` remains the final fallback. |

## Five-Minute Video Contents To Capture

Use `docs/submission/MANUAL_TEST_RECORDING_RUNBOOK.md` as the source of truth. The final edit should include:

1. Targeted pain and promise: playing, interpreting chat, and operating engagement tools compete for attention; ChatXPT cannot create viewers but can close this operational loop.
2. One-time setup in one Studio: Twitch connection, saved Minecraft preset/boundaries, persistent Game Capture, and generated OBS Browser Source.
3. Real understanding: Minecraft through OBS Virtual Camera with moving processing metrics, supported facts, honest unknowns, and gameplay tempo kept separate from Stream vibe and Audience mood.
4. Real Twitch analytics: a planned two-participant sequence updates current/previous mood and rate, keywords/topics, and current-session participant aggregates without exposing raw identity.
5. Exactly three quests: one suitable private cue becomes three safe, distinct, context-compatible options under streamer review.
6. Viewer agency: two isolated viewers vote in the installed Twitch Extension or an honestly identified fallback, receive private acknowledgement, and share one authoritative tally/winner.
7. OBS payoff: winner, active quest, progress, terminal result, session points, and community hype update through a real OBS Browser Source and viewer surfaces.
8. Control and resilience: apply/reset a current-stream override and visibly recover from one provider, capture, or viewer interruption.

Keep all claims labelled: direct `/viewer.html` access is not Twitch viewer proof; a browser preview is not OBS proof; fixture/diagnostic paths are not live evidence; current-session Live Analytics is not post-stream history.

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
