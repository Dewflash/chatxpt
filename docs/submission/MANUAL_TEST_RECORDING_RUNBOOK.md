# Manual Test And Recording Runbook

**Date:** 2026-08-09  
**Purpose:** Give the project owner one clean local test flow to record, while keeping fixture, local, and real external evidence claims separate.

## Preflight

1. Confirm the repository state. For product proof, prefer merged `main` or the final submission branch after the docs patch lands. Record the exact branch and commit shown by Git.

   ```bash
   git status --short --branch
   git rev-parse --short HEAD
   npm run check
   npm run dev
   ```

2. Open these pages:

   | Surface | URL | What to show |
   | --- | --- | --- |
   | Studio / canonical harness | `http://localhost:3000/diagnostics/ui-harness` | Shared fixture session, revision, streamer/viewer/overlay view models, command envelopes |
   | Viewer Extension shell | `http://localhost:3000/viewer.html` | Twitch Extension viewer route responds under Twitch-compatible CSP |
   | OBS overlay | `http://localhost:3000/overlay` | Broadcast overlay route responds and can be added as an OBS browser source |
   | Deployment health | `http://localhost:3000/api/health/deployment` | Local persistence/realtime status, with unavailable cloud services labelled honestly |

3. Start screen recording before the first page interaction.

## Five-Minute Demo Plan

Use this plan when the project owner and Role 2 record the final short video. Role 2 owns the narration/run-of-show draft and acts as the viewer during the live run-through.

| Time | Segment | What to show | Role 2 action |
| --- | --- | --- | --- |
| 0:00-0:25 | Product promise | ChatXPT turns gameplay state, viewer activity, and streamer preferences into safe sidequests viewers choose in real time. | Keep this to one plain-language line; no architecture lecture. |
| 0:25-0:55 | First setup | OBS has the game/screen source and ChatXPT Browser Source overlay at `http://localhost:3000/overlay`, with the overlay above gameplay in Sources. | Script the one-time setup line: once OBS is configured, future streams reuse the saved scene. |
| 0:55-1:25 | Streamer Studio/control room | Open `http://localhost:3000/`, show live screen analysis, streamer settings/context, and exactly three generated quests. | Call out only the signals visible on screen, such as activity/delta/confidence/chat; unsupported gameplay facts stay unknown. |
| 1:25-2:30 | Live run-through | Project owner plays the game while ChatXPT samples the selected screen/window, generates three Brawl Stars-safe sidequests, and starts a short vote. | Join the Twitch channel as viewer and type `1`, `2`, or `3` within the voting window. |
| 2:30-3:15 | Viewer vote and overlay | Show the vote count update, activate or auto-show the winning quest, and show the OBS overlay updating for the broadcast. | Confirm the viewer action is the vote shown on screen; if chat cannot connect, label the fallback honestly. |
| 3:15-4:15 | Analytics and quest generator | Explain that ChatXPT combines broad gameplay activity, audience signals, streamer boundaries, and deterministic safety/validation to choose appropriate quests. | Keep the analysis explanation practical: what changed, why the quest fits, what is still prototype-level. |
| 4:15-5:00 | Outcome and close | Complete/fail the quest, show status/reward/history or the relevant local state, and close with the reusable workflow. | End with the future-stream line: open OBS, start stream, play, viewers vote, overlay updates. |

### Role 2 Handoff Wording

Role 2 should prepare the exact script and step-by-step capture process for the five-minute video. The required story is:

1. Explain the app, OBS overlay, and Streamer Studio.
2. Show first-time setup: open OBS, add/connect ChatXPT overlay/browser sources, and configure once.
3. Show future-stream setup: OBS remembers the same sources, so the streamer opens OBS and starts.
4. Run through the intended live loop: the streamer plays, ChatXPT silently assesses the selected screen/window and viewer activity, then generates sidequest options without constant streamer clicking.
5. Start a short vote around 30 seconds into the run-through.
6. Role 2 joins as the viewer and actually votes within that window.
7. Show the winning quest on the OBS overlay.
8. Finish with analytics and quest-generator discussion under the five-minute limit.

The script must stay honest: real local screen sampling, real Twitch-chat messages, and real OBS Browser Source rendering may be shown when exercised; fixture, manual, local-only, or unavailable behaviour must be labelled as such.

## Recording Script

1. Show the GitHub/repository state or terminal output:
   - branch and commit being recorded;
   - PRs #124-#129 are merged and all PRs are closed/merged;
   - `npm run check` passed on merged `main` at `efd81ce`, and passed again on the current commit if rerun for this recording;
   - app is running at `http://localhost:3000`.

2. Open `/diagnostics/ui-harness`.
   - Show the fixture/diagnostic labels.
   - Show the single session/cycle/revision.
   - Show exactly three quest options.
   - Show the streamer, viewer, and overlay panels using the same fixture state.

3. Exercise one allowed command in the harness.
   - If the UI exposes command controls, use one normal command and one stale/invalid command path.
   - Narrate that this proves the browser-safe command envelope and typed rejection path, not live Twitch authority.

4. Open `/viewer.html`.
   - Show that the Twitch viewer route renders.
   - State that Hosted Test/public Twitch approval is not required for the local prototype, but real Twitch evidence must be recorded separately if available.

5. Open `/overlay`.
   - Show that OBS can load this URL as a browser source.
   - If OBS is open, add or select a Browser Source pointing to `http://localhost:3000/overlay`.

6. Open `/api/health/deployment`.
   - Show `deployment: local`.
   - Show in-memory persistence is ready.
   - Show cloud realtime is configured or unavailable honestly.

7. Optional legacy walkthrough:
   - Open `http://localhost:3000/`.
   - Generate sidequests.
   - Confirm exactly three options.
   - Connect Twitch chat to the broadcaster channel if available and ask a viewer to type `1`, `2`, or `3`; otherwise simulate votes and label them as diagnostic.
   - Activate a winning quest.
   - Show overlay updates.
   - Complete or fail the quest.
   - Label this as local prototype proof. Only claim real Twitch voting or real screen sampling when the recording visibly exercises those live inputs.

## Claims This Recording Can Support

- Local prototype runs from the recorded branch/commit.
- Shared contract fixtures render for Studio/viewer/overlay.
- Exactly three options are represented in the local diagnostic flow.
- Browser-safe routes and deployment health endpoint respond.
- Credential-free local persistence works for development.
- The system distinguishes fixture/local evidence from live Twitch/OBS/cloud evidence.
- If exercised on camera, the legacy local control room can sample a selected screen/window, connect to Twitch chat as an anonymous reader for `1`/`2`/`3` messages, and update the local OBS overlay route.

## Claims This Recording Cannot Support Alone

- Real Twitch chat ingestion, unless the recording visibly connects to the broadcaster channel and shows live chat messages becoming votes.
- Twitch Extension JWT identity verification.
- Real OBS Virtual Camera frame extraction. The visible local screen/window sampler is evidence only for the source actually selected and recorded.
- Real Supabase cloud realtime/persistence.
- Real Vercel deployment.
- Two external viewer sessions voting against the same authoritative cloud revision.
- Public Twitch Extension review readiness.

## Real External Test Add-On

If Twitch and OBS are ready, record a second short clip:

1. Start OBS with a raw game scene and no recursive ChatXPT overlay in the analysed capture source.
2. Add `http://localhost:3000/overlay` as an OBS Browser Source for broadcast visuals.
3. Start a Twitch test stream or local Twitch Extension test mode.
4. Open one broadcaster/studio browser and two isolated viewer browsers.
5. Submit one vote from each viewer path available.
6. Show the same session/cycle/revision and winning quest across Studio, both viewers, and OBS.
7. Show whether Supabase/Vercel are actually involved or whether the run is local-only.
8. Save the recording and record its limitations in `docs/evidence/manifest.json` before using it as evidence.
