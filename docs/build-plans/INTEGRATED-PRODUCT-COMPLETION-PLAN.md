# ChatXPT Integrated Product Completion Plan

**Status:** Active implementation plan under D-083 and D-085

**Product owner:** `Dewflash`

**Integration coordinator:** Role 1

**Date:** 20 August 2026

## Objective

Turn the current collection of contracts, diagnostic tools, fixture surfaces, and partially mounted features into one coherent streamer product whose visible capabilities work end to end.

The product is complete only when the same authoritative session travels through real Twitch and OBS inputs, ChatXPT intelligence, deterministic quest decisions, persistence/realtime, streamer controls, viewer participation, the OBS overlay, rewards, recovery, and history. Passing component tests or rendering fixture data is not product completion.

This plan covers the complete agreed scope and records every currently unavailable capability. It supplements the role plans; `AGENTS.md`, `docs/DECISIONS.md`, and `docs/build-plans/INTEGRATION-CONTRACT.md` remain higher authority.

This published plan is the implementation baseline for the other development computer. The owner-reviewed snapshot pass remains a gate before product source implementation; update this plan if accepted snapshots change scope, hierarchy, or acceptance criteria.

## Fixed owner decisions

The implementation must not reopen these choices unless the owner explicitly changes them:

- Twitch is the only supported MVP platform. Other platforms may appear only as unavailable `Coming Soon` options.
- ChatXPT Studio is the complete streamer product. Twitch Live Config is its compact stream-time companion.
- `/studio` becomes the authenticated product Home. `/` redirects there only after canonical parity; the legacy Control Room then moves behind diagnostics.
- `Start Stream` starts the ChatXPT session after readiness passes. It does not start OBS or make Twitch go live.
- ChatXPT blocks start when ChatXPT, Twitch, or Game Capture is unavailable. Viewer Voting and Broadcast Overlay may warn without blocking only when an accepted fallback remains usable.
- Game Capture uses one-time OBS Virtual Camera setup and browser permission, then reconnects automatically when the browser permits it. Studio must remain open for browser capture in this MVP.
- Twitch channel metadata pre-fills the game; the streamer may correct it before starting.
- Home is a concise one-viewport control centre, not a page containing every feature.
- Dedicated primary pages are Gameplay Engine, Live Analytics, Live Quests, Profile & Defaults, Stream Settings, and Test Lab.
- Streamers may create named presets; Competitive, Chill, Educational, and Community are starter examples.
- Home shows `Stream vibe`; Live Analytics separately shows `Audience mood`.
- Live Analytics includes automatically detected topics and an optional streamer watchlist while retaining only aggregates, not raw viewer messages or usernames.
- Official voting requires exactly three validated, game-aware quests. Idle previews may show zero to three pre-approved options.
- Manual streamer approval remains the MVP default before a proposed batch reaches voting.
- Audio and speech capture are deferred. The product exposes no microphone or transcript controls and makes no audio claim.
- OBS may show one concise `Up next` line sourced from a typed Current Objective or authoritative active quest. It does not show `Now`, transcripts, or private reasoning; insufficient evidence hides the line.
- Test Lab remains available to every streamer through normal Studio navigation.
- Incomplete capabilities remain visible only as clearly unavailable, non-operational controls written for streamers. Product UI never talks to testers or names internal roles, contracts, fixtures, revisions, or evidence classes.
- Proposed snapshots are design targets, never runtime evidence. The owner personally decides when integrated features are complete.

## Completion rule

A feature may move through these states:

1. **Proposed:** present only in an owner-reviewed design snapshot.
2. **Unavailable:** visible in product UI but disabled with a plain reason or recovery action.
3. **Component ready:** source and focused tests pass, but the feature is not represented as integrated.
4. **Integrated:** authoritative command, persistence, realtime, downstream projection, recovery, and producer/consumer tests work together.
5. **Real-input verified:** the relevant real Twitch, OBS, Supabase, browser, or provider path has executed and the evidence is recorded.
6. **Owner accepted:** the project owner has personally tested the product and marked the feature complete.

Only the owner may apply state 6. Contributors still run and report technical checks; owner testing does not replace them.

## Required route and surface map

| Route or surface | Purpose | Required states |
| --- | --- | --- |
| `/studio` | Authenticated Home control centre | cannot connect; connected/no stream; preparing; live; reconnecting; ended |
| `/studio/gameplay` | Gameplay Engine | Overview; Game Capture; Understanding; Health & Recovery |
| `/studio/live-analytics` | Audience health | Overview; Activity; Topics; Session History |
| `/studio/live-quests` | Sidequest output and control | Now; Recommendations; Why; Voting; Results |
| `/studio/profile` | Persistent defaults | Personality; Stream Presets; Safety; Accessibility |
| `/studio/stream-settings` | Effective current-stream settings | saved source; session override; reset to saved |
| `/studio/test-lab` | Streamer-accessible authorised testing | sample/live source distinction; capture controls; observed/unknown; recovery |
| `/studio/live-director` | Compact private pop-out/dock | current context; cue; quest review/actions; health |
| `/config.html` | Twitch installation/configuration | authorised setup; connection; open Studio |
| `/live-config.html` | Compact Twitch stream-time control | current state; quest actions; intensity; emergency pause |
| `/viewer.html` | Twitch Extension viewer | loading; voting; accepted; winner; active; result; reconnect |
| `/quest-board/[roomCode]` | Hosted viewer fallback | same authoritative viewer lifecycle; anonymous recovery |
| Twitch chat | Final participation fallback | concise `1`/`2`/`3`; bounded acknowledgement; result |
| `/obs-overlay` | Public read-only broadcast projection | `Up next`; voting; winner; active; progress; result; reconnect |
| `/diagnostics/*` | Developer and reproducibility tools | explicit diagnostic/fixture labelling outside customer workflows |

## Proposed snapshot gate

The owner cues and reviews snapshots before UI implementation begins. The snapshots show the proposed product, not the current source.

### Primary Studio set

1. Cannot-connect Home.
2. Connected, ready-to-start Home.
3. Active-stream Home.
4. Gameplay Engine.
5. Live Analytics.
6. Live Quests.

### Supporting set

7. Profile & Defaults.
8. Stream Settings.
9. Test Lab.
10. Compact Twitch Live Config.
11. Twitch Extension.
12. OBS Overlay.

The gate exits when the owner accepts hierarchy, visible information, unavailable states, interaction placement, responsive intent, and streamer-facing copy. Snapshot approval does not mark any feature implemented.

## Canonical runtime composition

There is one runtime path:

```text
Twitch OAuth/EventSub + OBS Virtual Camera
-> Role 1 normalised input adapters
-> Role 2 gameplay and audience intelligence
-> Role 1 intervention scheduler/composition
-> Role 2 configured candidate provider
-> Role 3 deterministic validation/lifecycle
-> Role 1 atomic persistence and realtime publication
-> Role 4 Studio/Live Config
-> Role 5 Extension/hosted/chat/OBS
```

Rules:

- The production runtime must mount the existing Role 2 providers and Role 1 intervention coordinator. Tests alone do not count as composition.
- Ordinary Twitch chat must enter the privacy-safe audience pipeline; exact `1`/`2`/`3` messages additionally enter the vote adapter.
- AI candidate generation runs once per eligible candidate batch, never on every client refresh or overlay tick.
- The approved OpenAI call receives bounded normalised facts only, makes one attempt with an eight-second timeout, and always passes through Role 3 validation.
- Missing credentials, timeout, refusal, malformed output, rate limit, or outage activates the credential-free game-aware algorithmic path.
- If Role 2 plus Role 3 cannot assemble exactly three safe game-aware options, the official batch returns typed exhaustion and no vote opens.
- Raw frames are ephemeral. Raw chat is processed in memory. UI clients never own lifecycle, winner, progress, reward, or permission authority.
- Supabase persistence is authoritative. Realtime notifications prompt clients to reconcile against the latest authorised snapshot.
- Polling may remain only as a bounded recovery fallback after realtime subscription failure, not as the normal live transport.
- The legacy `/api/sidequests` and legacy Control Room cannot remain parallel product authorities. They move behind diagnostics after parity.

## Required contract work

Contract names may remain additive, but these responsibilities must be represented explicitly:

| Contract area | Required change |
| --- | --- |
| Streamer profile | Persist named presets, personality, quest preferences, safety, accessibility, voting, rewards, game selection, and keyword watchlist. |
| Effective stream settings | Represent saved source, selected preset, session-only overrides, effective values, and reset-to-saved without browser-local authority. |
| Session lifecycle/readiness | Separate disconnected, connected/no stream, preparing, ready, live, reconnecting, and ended. Starting cannot silently bypass readiness. |
| Gameplay view | Project capture health, supported facts, freshness, confidence, explicit unknown/error, and plain-language understanding without leaking diagnostic internals. |
| Audience intelligence | Carry privacy-safe energy, activity, mood, participation, repeated topics, watchlist counts, freshness, sample size, and current-session aggregates. |
| Candidate provider | Return exactly three game-aware candidates or typed exhaustion with provider/algorithmic status kept private where appropriate. |
| Live Director | Add the missing production scheduler/producer commands and refresh context after relevant gameplay, audience, objective, or lifecycle changes. |
| Public `Up next` | Add a sanitised, expiring, game-compatible field to the overlay projection; exclude `Now`, transcript, reasoning, usernames, provider data, and private cues. |
| Viewer recovery/rewards | Persist each viewer's accepted choice and non-zero session points privately; keep community hype shared and both values session-scoped. |
| Realtime/recovery | Give each client an authorised subscription plus snapshot reconciliation, stale-revision rejection, reconnect status, and polling fallback. |
| History | Persist terminal quest outcome, points/hype effect, aggregate participation, and non-causal session summary without raw chat or viewer identity. |

Every shared-contract change requires Core schema tests, producer tests, consumer tests, migration notes where applicable, and Role 1 deconfliction before landing.

## Implementation slices

Implementation begins only after the owner accepts the snapshot gate. Each slice is landed separately and must leave the product in a coherent state.

### ICP-01 — Product shell and truthful availability

**User outcome:** Streamers see the accepted navigation and final-product language. Every unfinished feature is clearly unavailable without tester-facing copy.

**Work:**

- Create the thin Studio routes from the accepted map and one shared responsive navigation shell.
- Render the accepted Home compositions for cannot-connect, connected/no stream, and live states.
- Remove diagnostic badges, revision labels, role/contract language, and `Not live workflow evidence` from customer surfaces.
- Unmount the deferred microphone/transcript controls and remove audio from snapshots and completion claims. Preserve or delete dormant source only in a separately reviewed cleanup; it must not ship mounted.
- Centralise capability availability so disabled UI cannot accidentally dispatch commands.
- Keep `/` on the legacy Control Room until ICP-08 parity; do not delete it.

**Primary responsibility areas:** `src/streamer/`, `src/design-system/`, thin `src/app/studio/` routes, Core view availability fields.

**Exit:** Route/render/accessibility tests pass; every visible action is either authoritative or disabled; no product page contains tester language. This slice remains component/integration ready, not owner complete.

### ICP-02 — Twitch connection, session readiness, and production Game Capture

**User outcome:** A streamer connects Twitch once, sees the Twitch game pre-filled, connects OBS Virtual Camera once, and can start ChatXPT only when core readiness is real.

**Work:**

- Complete self-service Twitch OAuth/EventSub connection and recovery while retaining secure manual setup only as an unavailable/diagnostic fallback until external credentials are available.
- Read Twitch channel metadata, pre-fill the game, and permit correction before start.
- Move real OBS Virtual Camera capture out of the diagnostics page into a production capture controller used by Gameplay Engine and session readiness.
- Perform one-time source selection/permission setup, preserve browser-safe reconnect metadata, and reconnect automatically when permission and device identity permit.
- Keep capture running while Studio is open; stop cleanly on session end, permission loss, device loss, or explicit disconnect.
- Change session start so it creates/prepares authority, evaluates readiness, and transitions to live only through the lifecycle boundary. It must not mark a blocked session live first.
- Implement the four-item Home strip: Twitch, Game Capture, Viewer Voting, Broadcast Overlay.
- Replace `open diagnostics` recovery with useful product recovery actions.

**Primary responsibility areas:** `src/integrations/`, `src/realtime/`, `src/core/`, `src/extraction/`, `src/app/server/`, `src/streamer/`.

**Exit evidence:**

- Contract tests for lifecycle/readiness and stale/duplicate start.
- Real browser permission allow/deny/revoke recovery.
- Real OBS Virtual Camera frames reaching authoritative Gameplay Snapshot storage.
- Real Twitch account/channel metadata or an explicitly recorded external credential blocker.
- Owner can distinguish cannot-connect from connected/no stream.

### ICP-03 — Persistent Profile, presets, and current-stream overrides

**User outcome:** Streamers configure defaults once, reuse named presets, and safely change only the current stream without silently rewriting defaults.

**Work:**

- Extend profile commands and persistence for game, restrictions, preferred/forbidden quest types, safety, accessibility, voting, rewards, keyword watchlist, and user-created named presets.
- Seed editable Competitive, Chill, Educational, and Community starter presets.
- Add explicit selected-preset and effective-setting provenance.
- Add session override patch/clear commands and persist them with authoritative revisions.
- Feed effective values into Live Director context, audience/stream-vibe presentation, candidate context, quest policy, and session analytics.
- Implement Profile & Defaults and Stream Settings pages plus concise Home summaries/deep links.
- Keep provider/model controls out of normal streamer UI.

**Primary responsibility areas:** Core profile/session contracts, persistence/migrations, orchestrator, `src/streamer/`.

**Exit evidence:** Create/edit/delete/select preset; reconnect; next-session reuse; override; reset-to-saved; stale revision; unauthorised mutation; downstream candidate-context tests.

### ICP-04 — Gameplay Engine and automatic Live Director context

**User outcome:** Gameplay Engine plainly shows what ChatXPT can see, what it understands, what it is doing, and exactly why it is waiting or unavailable.

**Work:**

- Mount Role 2 gameplay intelligence in the sole server runtime rather than only diagnostics/tests.
- Produce context-ready commands automatically after relevant fresh gameplay, audience, objective, and lifecycle changes.
- Apply hysteresis/debouncing so noisy frames do not churn authoritative state.
- Preserve universal `Active`, `Quiet`, `Transition`, and `Unknown` plus calibrated Minecraft facts only when proven.
- Build Gameplay Engine sections: Overview, Game Capture, Understanding, Health & Recovery.
- Merge the Home session header and Live Director into Current Stream while keeping full detail on Gameplay Engine.
- Implement clear transient states such as Reading the game, Calculating, Generating quests, Retrieving state, Permission blocked, Camera lost, and Unsupported fact.
- Implement `Up next` authority from typed Current Objective or active quest, require selected-game compatibility and fresh gameplay evidence, expire it, and hide it when insufficient.
- Do not implement audio or public `Now`.

**Primary responsibility areas:** `src/extraction/`, `src/ai/` intelligence composition, Core Live Director contracts, orchestrator/scheduler, `src/streamer/`, overlay contract consumer preparation.

**Exit evidence:** Real Minecraft quiet/action/transition plus one calibrated fact; unknown/stale/conflict/device-loss cases; automatic context refresh; no raw frame persistence; no audio control; no unsupported semantic activity claim.

### ICP-05 — Ordinary Twitch chat and Live Analytics

**User outcome:** Streamers see useful current audience health without reading a technical signal dump or exposing viewer messages.

**Work:**

- Route every authorised ordinary Twitch chat event into Role 2's audience pipeline; retain the existing exact vote route for `1`/`2`/`3`.
- Keep raw chat in memory only and pseudonymise/deduplicate before aggregation.
- Produce energy, message activity, audience mood, participation, repeated topics, automatic topics, watchlist counts, sample size, freshness, and current-session timeline aggregates.
- Define sparse, multilingual, sarcastic, spam, toxic-pressure, contradictory, deleted, and reconnect behaviour as low-confidence or unknown rather than neutral certainty.
- Build Live Analytics sections: Overview, Activity, Topics, Session History.
- Keep Audience mood separate from Home's Stream vibe.
- Persist aggregate timeline/history only; never persist or display raw messages, usernames, Twitch IDs, or persistent viewer profiles.

**Primary responsibility areas:** Twitch adapter, `AudienceEventSource`, `src/extraction/`, Core audience contracts, persistence, `src/streamer/`.

**Exit evidence:** Real signed Twitch chat with ordinary messages and vote messages; aggregate changes reach Studio; spam/dedup/privacy tests; reconnect; raw-content absence from state, receipts, snapshots, database, logs, and OBS.

### ICP-06 — Game-aware quest generation and Live Quests

**User outcome:** ChatXPT proposes relevant quests for the selected game, never generic filler that conflicts with the game state, and opens voting only after streamer approval.

**Work:**

- Replace every game-neutral algorithmic and deterministic fallback template with game-profile-aware libraries and compatible unknown-safe variants.
- Correct the OpenAI instruction so weak evidence uses game-compatible, non-state-claiming options rather than game-neutral filler.
- Mount `createConfiguredCandidateProvider` and `Role1InterventionCoordinator` in production composition.
- Trigger one candidate request per eligible cycle after Role 3 suitability; never call AI on overlay refresh, Studio polling, or every gameplay frame.
- Pass bounded gameplay, aggregate audience, effective profile, restrictions, recent quests, and selected-game capabilities.
- Preserve one attempt, eight-second timeout, strict exactly-three output, deterministic validation, replacement, and typed exhaustion.
- Preserve manual streamer approval as default; reject cancels the batch.
- Build Live Quests sections: Now, Recommendations, Why these were recommended, Voting, Results.
- Home shows only current quest/recommendation status and zero to three pre-approved idle options.

**Primary responsibility areas:** `src/ai/`, `src/quest-engine/`, orchestrator/composition, persistence, `src/streamer/`.

**Exit evidence:** Provider success and every fallback failure class; algorithmic no-key path on real inputs; Minecraft-aware copy; contradicted-state rejection; zero/one/two options return exhaustion; exactly three reach private review; no publication before approval.

### ICP-07 — Realtime participation, rewards, and OBS payoff

**User outcome:** Two viewers share one authoritative vote and result, reconnect safely, earn session-scoped rewards, and see the winner plus `Up next`/quest payoff on OBS.

**Work:**

- Replace normal client polling with authorised Supabase subscriptions plus snapshot reconciliation; retain polling only as recovery fallback.
- Preserve one participation ledger for Twitch Extension, hosted board, and Twitch chat.
- Persist private accepted-vote recovery and non-zero session points; keep community hype shared and both session-scoped.
- Ensure duplicate/retried commands cannot double-vote, double-react, or double-award.
- Add the public `Up next` field to OverlayViewModel and render it without private Live Director data.
- Preserve compact overlay voting, winner, active quest, progress, result, cooldown, and reconnect states.
- Build Home's tabbed read-only previews for Streamer View, Twitch Extension, and OBS Overlay from current authoritative state with `Open full view`.
- Exercise hosted and chat fallbacks from the same cycle revision.

**Primary responsibility areas:** `src/realtime/`, persistence/migrations, Core projections, `src/viewer/`, `src/streamer/`, thin app clients.

**Exit evidence:** Real Supabase two-device vote/reconnect; first-vote-final; duplicate and stale handling; reward recovery; Twitch Extension/hosted/chat parity; real OBS Browser Source; structural privacy tests for overlay and viewer snapshots.

### ICP-08 — Test Lab, history, recovery, and canonical route migration

**User outcome:** Streamers can inspect authorised Test Lab scenarios and session history without confusing samples with a live session; the canonical Studio becomes the product entry point without losing legacy functionality.

**Work:**

- Mount `/studio/test-lab` in normal streamer navigation.
- Support team-owned/authorised video and live capture, source selection, observed/unknown output, and recovery while clearly distinguishing Sample from Live inside the lab.
- Do not reuse broad tester disclaimers on ordinary product pages.
- Build post-stream history from privacy-safe quest outcomes, aggregate participation, points/hype changes, and non-causal summaries.
- Complete product recovery actions for Twitch, Game Capture, Viewer Voting, Broadcast Overlay, realtime, token expiry, session expiry, and dependency outage.
- Run the canonical seven-step workflow twice without manual repair.
- After parity, redirect `/` to `/studio` and move the legacy Control Room and legacy sidequest path behind protected diagnostics without deleting functionality.

**Primary responsibility areas:** `src/streamer/`, diagnostics routes, history reader/persistence, app routing, integration tests.

**Exit evidence:** Streamer Test Lab route; authorised-input policy; sample/live distinction; history privacy; two canonical parity runs; route migration test; legacy diagnostic recovery path.

### ICP-09 — Full real-input acceptance and owner handoff

**User outcome:** The owner can personally test one complete product rather than separate demonstrations.

**Required run:**

```text
Connect Twitch
-> connect OBS Virtual Camera
-> verify game/defaults/readiness
-> Start Stream starts ChatXPT
-> real gameplay and ordinary chat update Gameplay Engine and Live Analytics
-> one eligible moment creates exactly three validated game-aware quests
-> streamer approves
-> two viewers vote through the Twitch Extension
-> authoritative winner appears in Extension, Studio, and OBS
-> quest progresses and ends
-> points, hype, result, and history persist
-> reconnect restores correct private and shared state
-> provider-unavailable run completes through the game-aware fallback
```

**Failure matrix:** Twitch unavailable; wrong/expired Twitch token; Game Capture denied/lost; unsupported game fact; stale/conflicting gameplay; sparse/spam chat; provider missing/refusal/timeout/malformed/rate limit/outage; Supabase write failure; realtime disconnect; duplicate/stale command; Extension unavailable with hosted fallback; hosted unavailable with chat fallback; OBS reconnect; zero-vote; cancellation; emergency pause; session end.

**Technical gate:** Focused producer/consumer tests, migration tests, privacy scans, accessibility/responsive checks, `npm run check`, clean production build, real evidence manifest, and no secret leakage.

**Final gate:** The owner personally tests the integrated product and explicitly marks accepted features complete. Anything not accepted remains `Unavailable` and stays in the inventory.

## Current unavailable-capability inventory

### Scheduled by this plan

| Capability currently unavailable or incomplete | Current reality | Planned slice |
| --- | --- | --- |
| Self-service Twitch connection and recovery | Secure manual mapping exists; full OAuth/EventSub product setup is incomplete. | ICP-02 |
| Correct readiness-gated start | Source now keeps setup sessions in `preparing`, gates explicit Start on Twitch/Game Capture readiness, and transitions to `live` only through the lifecycle command. Final test execution and real capture/Twitch evidence remain open. | ICP-02 |
| Twitch game pre-fill with correction | Start currently relies on manually entered game data. | ICP-02 |
| Production Game Capture | `/studio/gameplay/capture` now mounts a product capture screen that reuses the OBS Virtual Camera analyzer and gameplay ingress grant/snapshot boundary; it still requires manual setup keys and real OBS proof. | ICP-02 |
| Automatic Game Capture reconnect | The product capture screen refreshes short-lived ingress grants while running and remembers the selected game profile plus last successful capture time in browser-local storage; full permission/device-loss recovery is still incomplete. | ICP-02 |
| Complete profile editing | Profile & Defaults now emits the existing authoritative profile-settings command for game, intensity, creativity, safety lists, quest preferences, and accessibility. Presets, richer validation, and final UI/testing remain incomplete. | ICP-03 |
| Named stream presets | No preset schema, persistence, or UI exists. | ICP-03 |
| Current-stream overrides | A broadcaster-only `streamer.session-override` command, optional authoritative override state, streamer projection, and Stream Settings apply/reset controls now exist for current-stream intensity/creativity. Preset-aware effective settings and final tests remain incomplete. | ICP-03 |
| Canonical runtime intelligence composition | Source now mounts the configured candidate provider and intervention coordinator in the server runtime for cue conversion and eligible-cycle proposal requests. Final test execution and real-input proof remain open. | ICP-04/ICP-06 |
| Automatic Live Director refresh | Context composition exists but no production producer/scheduler emits it. | ICP-04 |
| Gameplay Engine page | ICP-01 route shell exists with Overview, Game Capture, Understanding, and Health & Recovery sections and links to `/studio/gameplay/capture`; full understanding workflow remains incomplete. | ICP-04 |
| Public `Up next` | Overlay projection now has a sanitized nullable `upNext` field derived from authoritative quest-cycle state or a known typed Current Objective with selected-game-compatible fresh gameplay evidence; final tests remain open. | ICP-04/ICP-07 |
| Ordinary-chat audience intelligence | Non-vote Twitch messages are ignored by the app ingress. | ICP-05 |
| Live Analytics page | ICP-01 route shell exists with Overview, Activity, Topics, and Session History sections; connected ordinary-chat producer, topics, watchlist counts, and history remain incomplete. | ICP-05 |
| Automatic topics plus watchlist counts | Aggregate contract/UI/persistence are incomplete. | ICP-05 |
| Game-aware algorithmic candidates | Credential-free algorithmic generation now prefers Minecraft-aware templates when Minecraft is selected or evidenced, and remains game-neutral for other games. Final evaluation/testing remains open. | ICP-06 |
| Game-aware deterministic fallback | Role 3 deterministic fallback now prefers Minecraft-aware safe definitions when Minecraft is selected or evidenced, and remains game-neutral for other games. Final evaluation/testing remains open. | ICP-06 |
| Correct weak-evidence OpenAI prompt | Source now keeps weak exact evidence strict while allowing safe Minecraft-aware, non-state-claiming provider instructions for selected/evidenced Minecraft sessions. Final provider/evaluation execution remains open. | ICP-06 |
| Automatic eligible-cycle candidate call | Accepted live gameplay ingress now asks the server runtime for one policy-gated proposal per session/cycle/revision; denied moments do not call candidate generation. Final tests and real-input evidence remain open. | ICP-06 |
| Dedicated Live Quests page | ICP-01 route shell exists with Now, Recommendations, Why, Voting, and Results sections; full recommendation/review/voting/result workspace remains incomplete. | ICP-06 |
| Realtime client subscriptions | Studio/viewer/hosted/OBS normally poll every 1.5–2 seconds. | ICP-07 |
| Persistent private viewer points | Recovery returns `sessionPoints: 0`. | ICP-07 |
| OBS `Up next` rendering | OBS overlay source now renders the public `upNext` field while staying read-only; final tests and real OBS Browser Source proof remain open. | ICP-07 |
| Authoritative Home surface previews | Home now has concise current-state compositions and gated Start/End controls; deeper tabbed previews remain incomplete. | ICP-07 |
| Streamer-facing Test Lab route | ICP-01 route shell exists with Sample/Live Source, Capture Controls, Observed/Unknown, and Recovery sections; sample/live controls and policy-backed recovery remain incomplete. | ICP-08 |
| Complete history/recovery experience | Read models exist in parts; dedicated product flow is incomplete. | ICP-08 |
| Canonical `/` routing | `/` still mounts the legacy Control Room. | ICP-08 after parity |
| Real Twitch/OBS/Supabase/provider proof | Source and fixture tests do not prove the external workflow. | ICP-09 |

### Intentionally unavailable until a later owner decision

| Capability | Current rule |
| --- | --- |
| Streamer audio/speech interpretation | Deferred; no microphone or transcript controls. |
| Public semantic `Now` activity | Excluded for the current MVP; OBS may show only validated `Up next`. |
| Starting OBS or Twitch broadcasting from ChatXPT | Out of current scope; `Start Stream` starts ChatXPT only. |
| YouTube, Discord, or other platform adapters | Coming Soon only until Twitch is complete. |
| Persistent cross-stream viewer economy or profiling | Excluded; points/hype remain session-scoped. |
| Provider/model picker | Excluded from normal streamer controls. |
| Raw-chat panel, usernames, or persistent raw messages | Excluded by privacy policy. |
| Generic growth analytics or causal retention claims | Excluded. |
| Automatic quest activation without streamer approval | Disabled for the current MVP; Role 3 may enable it only after the accepted safety and integration evidence gates pass. |

## Cross-role delivery matrix

| Slice | Role 1 | Role 2 | Role 3 | Role 4 | Role 5 |
| --- | --- | --- | --- | --- | --- |
| ICP-01 | Availability/view contracts; thin routes | — | — | Studio shell/copy/navigation | Preview compatibility |
| ICP-02 | Twitch/session/capture authority; persistence | Frame consumer and capture health | Readiness-safe lifecycle input | Connection/start/capture UX | Viewer/overlay health status |
| ICP-03 | Profile/preset/override contracts and persistence | Consume effective context | Consume hard/soft preferences | Profile, presets, Stream Settings | Reward display compatibility |
| ICP-04 | Scheduler/context composition/projection | Gameplay intelligence | Suitability/cue consumer checks | Gameplay Engine/Home Live Director | `Up next` projection consumer |
| ICP-05 | Ordinary-chat adapter/persistence | Audience aggregation | Audience suitability consumer checks | Live Analytics | No raw audience leakage |
| ICP-06 | Provider/coordinator composition | Provider and algorithmic candidates | Validation/fallback/lifecycle | Live Quests/review | Exactly-three consumer states |
| ICP-07 | Realtime/rewards/participation authority | — | Reward/progress decisions | Home previews/status | Extension/hosted/chat/OBS |
| ICP-08 | History/routing/integration | Test Lab analysis | History semantics | Test Lab/history/recovery | Result/history consistency |
| ICP-09 | Golden run and evidence | Real intelligence/provider evidence | Lifecycle/safety evidence | Streamer walkthrough | Two-viewer/OBS walkthrough |

## Branch, review, and landing discipline

- Work from current `main` only after the local tree is clean or existing work has been deliberately preserved.
- Prefer one short-lived `role-<n>/<slice-summary>` branch per slice or smaller coherent sub-slice.
- Before editing, inspect `docs/TEAM_CONTEXT.md`, open branches/PRs, and the affected role TODOs for overlap.
- Put implementation in the directory matching runtime responsibility even when one contributor implements across roles.
- Each change includes the affected role TODO/execution evidence, one change fragment, producer/consumer tests, and any migration notes.
- A pull request is the normal coordination record. D-076 permits deliberate direct integration after deconfliction, checks, and material-risk review.
- Never commit credentials, private chat exports, personal viewer data, raw frames, `.env.local`, or unreviewed generated artifacts.

## Handoff for another computer

After pulling the commit containing this plan:

1. Read `AGENTS.md`, `docs/DECISIONS.md`, this plan, `INTEGRATION-CONTRACT.md`, the relevant role guide/TODO/plan, and `docs/TEAM_CONTEXT.md`.
2. Confirm whether the owner-approved snapshot gate is complete. If it is not, generate/review the proposed snapshots and do not claim UI implementation.
3. Select the first incomplete slice and the smallest end-to-end outcome inside it; do not pick an isolated component from a later slice merely because code already exists.
4. Audit current source before editing because this plan records the 20 August state and other branches may have landed later.
5. Preserve unavailable states until the complete authoritative path for that capability works.
6. Report technical readiness separately from real-input verification and owner acceptance.

## Plan maintenance

Update this file only when scope, slice order, acceptance criteria, or the unavailable inventory materially changes. Routine code details belong in the affected role plan/TODO and change fragment. A later source change must never silently mark a listed capability complete; completion requires D-083 evidence and owner acceptance.
