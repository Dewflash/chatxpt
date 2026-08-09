# End-to-End Prototype Check

**Checked:** 2026-08-09

## Current Verdict

The repository contains a runnable local prototype that demonstrates the core idea with synthetic inputs:

1. streamer-facing signal controls;
2. exactly three generated sidequests;
3. manual viewer-vote simulation;
4. streamer activation and result controls;
5. OBS-style overlay output.

That path is useful for a demo walkthrough and deterministic diagnostics, but it is not live end-to-end evidence. The accepted MVP evidence still needs real Twitch resources, real OBS Virtual Camera gameplay input, real viewer activity, and the same authoritative session/cycle revision across Studio, two viewer clients, persistence, and OBS overlay.

## Runnable Today

Fast local commands:

```bash
npm run dev
npm run check:evidence
npm run check:demo-runbook
npm run test:integration
```

Local demo routes:

| Route | Current use | Evidence class |
| --- | --- | --- |
| `/` | Legacy control room with synthetic gameplay/chat/profile controls, sidequest generation, simulated votes, activation, complete/fail/clear controls | fixture/diagnostic |
| `/overlay` | Legacy browser overlay reading the active quest through browser storage and `BroadcastChannel` | fixture/diagnostic |
| `/diagnostics/ui-harness` | Fixture session showing shared Studio, Viewer, and OBS overlay view-model shape, revision, and command envelopes | fixture-only |
| `/api/ui-gateway/fixture` | JSON fixture for the UI gateway view models | fixture-only |
| `/api/ui-gateway/commands` | Validates fixture command envelopes and stale revisions without mutating authoritative runtime | fixture-only |
| `/viewer.html`, `/config.html`, `/live-config.html` | Twitch Extension path/readiness shells | setup diagnostic only |
| `/quest-board/[roomCode]` | Hosted-board access shell backed by configured persistence runtime when available | diagnostic until real session evidence exists |
| `/api/twitch/setup/readiness` | Server-safe Twitch setup readiness report | diagnostic |
| `/api/health/deployment` | Deployment/persistence environment health report | diagnostic |

## Exact Current Demo Path

1. Run `npm run dev`.
2. Open `http://localhost:3000/`.
3. Use the default golden scenario or adjust match phase, squad status, health, viewer mood, streamer style, and chat request.
4. Click **Generate sidequests**.
5. Confirm exactly three quest cards appear. With no `OPENAI_API_KEY`, this uses the safe mock/demo engine. If `OPENAI_API_KEY` is configured, the legacy API tries the optional OpenAI adapter and falls back to the mock engine on failure.
6. Click `+ vote` on the three options to simulate viewer voting. This is not authoritative Twitch, hosted-board, or chat voting.
7. Click **Activate** on the chosen quest.
8. Open `http://localhost:3000/overlay` in another browser tab or OBS Browser Source to show the active quest, timer, status, and reward.
9. Return to the control room and click **Complete**, **Fail**, or **Clear** to demonstrate terminal overlay updates.
10. Open `http://localhost:3000/diagnostics/ui-harness` separately to show the newer canonical fixture shape: one session ID, one quest-cycle ID, one revision, exactly three options, streamer/viewer/overlay views, and example command envelopes.

## AI Contribution Path

Current runnable UI path:

- `/api/sidequests` validates the legacy `GenerationRequest`.
- If `OPENAI_API_KEY` exists, it calls the server-side legacy OpenAI adapter with structured JSON output requirements.
- If the key is absent or the provider call fails, it returns exactly three deterministic mock quests and, on provider failure, a warning.

Accepted MVP path present as component code/tests:

- Role 2 has credential-free audience and candidate-generation logic behind public ports.
- Role 2's algorithmic strategy emits exactly three `algorithmic` candidates from canonical intelligence/profile/recent-history input.
- Role 2's provider fallback wrapper classifies provider failures and falls back to credential-free candidates without retaining raw provider payloads.
- Role 3 validates every provider, algorithmic, or fallback candidate through the same deterministic safety/feasibility rules before it can reach viewers.

The accepted Role 2/Role 3 path is not yet wired into the visible `/` route as live product evidence.

## Human Review Points

- Streamer/producer reviews the three proposed quests before activation.
- Producer-facing rationale is available in the legacy quest cards; overlay output omits rationale.
- Streamer manually activates a quest in the legacy demo.
- Streamer can complete, fail, or clear the active quest in the legacy demo.
- The authored MVP runbook also requires review of unsafe quests, emergency pause, skip/cancel/succeed/fail/expiry, privacy of artifacts, and fixture-vs-live labelling before evidence is recorded.

## Exception Handling Visible Today

- Invalid `/api/sidequests` JSON or signal shape returns a 400 response.
- Missing `OPENAI_API_KEY` uses the deterministic mock engine.
- Legacy OpenAI failure falls back to the mock engine and returns a warning.
- The mock engine filters boundary-matching quest text and fills with safe fallback quests to keep exactly three options.
- `/api/ui-gateway/commands` rejects stale fixture revisions and malformed command envelopes.
- Hosted board access has explicit invalid, not-found, expired, inactive, and unavailable states.
- The documented real runbook requires unknown gameplay facts to remain `unknown`, provider failure to continue through algorithmic/deterministic fallback, and fixture/live claims to be split.

## Final Output Demonstrated Today

The local demo can produce an OBS-style overlay card with:

- active quest title;
- instruction;
- countdown;
- status;
- reward points;
- completed/failed visual status after producer action.

The newer Role 5 fixture evidence also shows Twitch, hosted-board, and OBS overlay render states, but the evidence manifest labels that as fixture-only.

## Remaining Live Evidence Blockers

- Twitch broadcaster account/developer app/Extension test setup is still `owner-action-required`.
- Two isolated viewer sessions are still `owner-action-required`.
- OBS gameplay machine and real OBS Virtual Camera sampling are still `owner-action-required`.
- Real Twitch chat/activity ingestion and outbound acknowledgement are not evidenced.
- Real Twitch Extension identity/JWT validation is not evidenced.
- Real hosted-board two-client voting against an authoritative session is not evidenced.
- Real Supabase cloud realtime/persistence and Vercel deployment evidence are still outstanding.
- Role 2 real-frame extraction/OCR and real gameplay asset evaluation are still blocked or incomplete.
- Joint Role 2/Role 3 free provider/model recommendation and real provider trial evidence remain open.
- The accepted Role 2 algorithmic/provider path and Role 3 deterministic engine are component-tested but not fully wired into the visible end-to-end UI route.
- The integration completion rule is not met until the same authoritative session and quest-cycle revision is observable across orchestrator, Studio, two viewers, persistence, and OBS overlay.
