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
   - Simulate votes.
   - Activate a winning quest.
   - Show overlay updates.
   - Complete or fail the quest.
   - Label this as local fixture/diagnostic proof, not real Twitch voting, real OBS frame extraction, real Supabase/Vercel, or golden workflow proof.

## Claims This Recording Can Support

- Local prototype runs from the recorded branch/commit.
- Shared contract fixtures render for Studio/viewer/overlay.
- Exactly three options are represented in the local diagnostic flow.
- Browser-safe routes and deployment health endpoint respond.
- Credential-free local persistence works for development.
- The system distinguishes fixture/local evidence from live Twitch/OBS/cloud evidence.

## Claims This Recording Cannot Support Alone

- Real Twitch chat ingestion.
- Twitch Extension JWT identity verification.
- Real OBS Virtual Camera frame extraction.
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
