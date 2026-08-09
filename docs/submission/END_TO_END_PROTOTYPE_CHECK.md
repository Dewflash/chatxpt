# End-to-End Prototype Check

**Checked:** 2026-08-09
**Post-merge update:** PRs #124-#131 are merged into `main`; `npm run check` passed on the merged branch before handoff.

## Current Verdict

The repository contains a runnable local prototype that demonstrates the core idea with fixture inputs and a local live-demo bridge:

1. streamer-facing signal controls;
2. exactly three generated sidequests;
3. local screen/window activity sampling when the browser is granted capture permission, with visible motion, visual-change, tempo, confidence, rolling sample history, preview, and checksum signals;
4. local Extension-style viewer voting through `/viewer.html`, with Twitch-chat `1`/`2`/`3` retained as a fallback/comment-ingestion proof when Twitch chat is reachable;
5. a top Studio recording cockpit with quick capture/chat/generate/overlay actions, visible automation settings for automatic quest generation versus manual producer review, automatic overlay publishing versus streamer-approved activation, readiness state, recent flow events, and an embedded OBS output mirror;
6. manual viewer-vote simulation as a diagnostic fallback;
7. streamer activation and result controls;
8. OBS-style overlay output through `http://localhost:3000/overlay`.

That path is useful for a demo walkthrough and deterministic diagnostics. If the recording visibly exercises screen capture and Twitch chat, those individual inputs may be described as real local inputs. It is still not full golden end-to-end evidence. The accepted MVP evidence still needs the same authoritative session/cycle revision across Studio, two viewer clients, persistence, and OBS overlay, with every unavailable signal labelled honestly.

For immediate recording, use `docs/submission/MANUAL_TEST_RECORDING_RUNBOOK.md`.

## Runnable Today

Fast local commands:

```bash
npm run dev
npm run check
npm run check:evidence
npm run check:demo-runbook
npm run test:integration
```

Local demo routes:

| Route | Current use | Evidence class |
| --- | --- | --- |
| `/` | Legacy control room with Brawl Stars-safe defaults, live screen/window activity sampler, local Extension voter bridge, anonymous Twitch-chat comment/fallback connector, sidequest generation, simulated vote fallback, activation, complete/fail/clear controls | local prototype / diagnostic |
| `/overlay` | Legacy browser overlay reading active quest state through the local overlay route/state bridge | local prototype / diagnostic |
| `/diagnostics/ui-harness` | Fixture session showing shared Studio, Viewer, and OBS overlay view-model shape, revision, and command envelopes | fixture-only |
| `/api/ui-gateway/fixture` | JSON fixture for the UI gateway view models | fixture-only |
| `/api/ui-gateway/commands` | Validates fixture command envelopes and stale revisions without mutating authoritative runtime | fixture-only |
| `/viewer.html` | Local Twitch Extension-style viewer voting screen backed by the demo participation bridge | local prototype / diagnostic |
| `/config.html`, `/live-config.html` | Twitch Extension path/readiness shells | setup diagnostic only |
| `/quest-board/[roomCode]` | Hosted-board access shell backed by configured persistence runtime when available | diagnostic until real session evidence exists |
| `/api/twitch/setup/readiness` | Server-safe Twitch setup readiness report | diagnostic |
| `/api/health/deployment` | Deployment/persistence environment health report | diagnostic |

## Exact Current Demo Path

1. Run `npm run dev`.
2. Open `http://localhost:3000/`.
3. Click **Capture game window** and choose the game/phone/OBS preview window. Confirm the preview thumbnail and checksum are changing before claiming live screen sampling.
4. Confirm the **Stream automation settings** are set to **Auto generate** and **Auto overlay**, or switch to **Manual review** / **Streamer approves** if the recording should show manual control.
5. Connect Twitch chat to the broadcaster channel, for example `dewflash`, if a test stream is available.
6. Wait for auto-generation or click **Generate sidequests** if the recording needs to move faster. If clicked manually, label that as prototype/demo control.
7. Confirm exactly three Brawl Stars-safe quest cards appear. With no `OPENAI_API_KEY`, this uses the credential-free algorithmic/demo engine. If `OPENAI_API_KEY` is configured, the legacy API tries the optional OpenAI adapter and falls back to the algorithmic engine on failure. The accepted judged MVP path remains the credential-free algorithmic route recorded in D-055.
8. Ask Joel or another viewer to open `http://localhost:3000/viewer.html`, select one of the three quests, and submit the vote. Confirm the vote increments in Studio and the leading voted quest auto-publishes to the overlay. Use Twitch chat `1`/`2`/`3` only as the fallback/comment-ingestion proof; if the viewer route is unavailable, click `+ vote` and label it as simulated diagnostic voting.
9. Open `http://localhost:3000/overlay` in another browser tab or OBS Browser Source to show the active quest, timer, status, and reward. If the automation is disabled, click **Activate** on the chosen quest.
10. Return to the control room and click **Complete**, **Fail**, or **Clear** to demonstrate terminal overlay updates.
11. Open `http://localhost:3000/diagnostics/ui-harness` separately to show the newer canonical fixture shape: one session ID, one quest-cycle ID, one revision, exactly three options, streamer/viewer/overlay views, and example command envelopes.

## AI Contribution Path

Current runnable UI path:

- `/api/sidequests` validates the legacy `GenerationRequest`.
- The judged MVP does not adopt an external provider. D-055 records the accepted provider decision: use credential-free algorithmic candidates plus Role 3 deterministic validation/replacement for the MVP.
- The legacy `/api/sidequests` path still contains an optional server-side OpenAI adapter if `OPENAI_API_KEY` is configured; this is not the accepted judged-provider path and should not be presented as MVP provider evidence.
- If the key is absent or the legacy provider call fails, it returns exactly three credential-free algorithmic/demo quests and, on provider failure, a warning.

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
- Missing `OPENAI_API_KEY` uses the credential-free algorithmic/demo engine.
- Legacy OpenAI failure falls back to the credential-free algorithmic/demo engine and returns a warning.
- Extension viewer or Twitch chat connection failure leaves the local demo able to continue through labelled diagnostic votes.
- Screen capture that is frozen, black, or incorrectly selected can be identified through the preview thumbnail and checksum before any live-analysis claim is made.
- The algorithmic/demo engine filters boundary-matching quest text and fills with safe fallback quests to keep exactly three options.
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

For the five-minute video, Role 2 should prepare the exact script and act as the viewer who opens the Extension-style viewer route and votes within the short vote window. The intended story is: one-time OBS setup, future streams reuse the scene, the streamer plays, ChatXPT samples the selected screen/window and viewer activity, three quests appear, the viewer votes, the winning quest reaches the OBS overlay, and the video closes with analytics plus quest-generator explanation under five minutes.

The newer Role 5 fixture evidence also shows Twitch, hosted-board, and OBS overlay render states, but the evidence manifest labels that as fixture-only.

## Remaining Live Evidence Blockers

- Twitch broadcaster account/developer app/Extension test setup is still `owner-action-required`.
- Two isolated viewer sessions are still `owner-action-required`.
- OBS gameplay machine and real OBS Virtual Camera sampling are still `owner-action-required`.
- Real Twitch Extension identity/JWT validation, Asset Hosting upload, and outbound acknowledgement are not evidenced by the local `/viewer.html` bridge.
- Real hosted-board two-client voting against an authoritative session is not evidenced.
- Real Supabase cloud realtime/persistence and Vercel deployment evidence are still outstanding.
- Role 2 real-frame extraction/OCR and real gameplay asset evaluation are still blocked or incomplete until the owner records a real OBS/gameplay run.
- External model-provider adoption is closed for the judged MVP by D-055: no provider is adopted or configured. Future Groq trial evidence remains optional/future, not a blocker for the credential-free MVP route.
- The accepted Role 2 algorithmic/provider path and Role 3 deterministic engine are component-tested but not fully wired into the visible end-to-end UI route.
- The integration completion rule is not met until the same authoritative session and quest-cycle revision is observable across orchestrator, Studio, two viewers, persistence, and OBS overlay.
