# Final Studio Live Test and Recording Runbook

**Updated:** 2026-08-21
**Purpose:** Prove the final one-Studio ChatXPT product with real Twitch activity, real OBS Virtual Camera gameplay, real viewer participation, and a real OBS Browser Source while keeping automated, fixture, local, and external evidence separate.

## What this test must prove

The final test is not a tour of unrelated pages. It is one uninterrupted working segment:

```text
saved streamer profile + Twitch connection + OBS Virtual Camera Minecraft
-> current gameplay and audience understanding
-> one suitable private cue
-> exactly three validated sidequests
-> two viewers vote through the best available Twitch/fallback surfaces
-> one authoritative winner reaches OBS
-> progress and a terminal result update Studio, viewers, rewards, and overlay
-> one controlled failure recovers without fabricated state
```

Every material feature must complete the proof chain in `docs/research/PRODUCT-VALIDATION.md`: targeted pain, best supporting evidence, and the built response visibly working. Automated tests prove source behaviour; this run proves the external product path.

## Product surfaces

ChatXPT Studio is one app. Its internal pages are navigation destinations, not five separate products or five required browser tabs.

| Surface | How to open it | Test purpose |
| --- | --- | --- |
| ChatXPT Studio | `http://localhost:3000/studio` | Primary streamer setup, status, gameplay, analytics, quests, preferences, settings, and Test Lab |
| Persistent Game Capture | Open **Gameplay Engine -> Open capture controls** or **Test Lab -> Run live capture check** | Keeps OBS Virtual Camera capture running while the streamer navigates Studio |
| Twitch Extension viewer | Open the installed panel in Twitch Local or Hosted Test | Primary viewer identity and voting proof; direct `/viewer.html` access does not create Twitch identity |
| Second viewer | Separate browser profile, private window, or second device in Twitch Local/Hosted Test | Same-session multi-viewer and private-recovery proof |
| Hosted Quest Board | Use the authorised link issued for the current session | First participation fallback; do not invent a room or treat a static page as authorised proof |
| Twitch chat | Team-controlled channel | Real aggregate chat intelligence and final `1`/`2`/`3` voting fallback |
| OBS Browser Source | Generate the key-free session URL in **Studio -> Test Lab** | Public voting/winner/active/progress/result output; never record or expose the fragment token |

Diagnostic routes may reproduce failures or fixtures, but they do not replace this product run and must never be presented as live evidence.

## Required people and equipment

- Streamer machine with ChatXPT, OBS Studio, and owned vanilla Minecraft Java Survival using the default HUD.
- Twitch broadcaster account with the ChatXPT Extension in Local or Hosted Test.
- Viewer A and Viewer B in isolated Twitch/browser sessions.
- One raw-game OBS scene for ChatXPT capture with no ChatXPT overlay inside it.
- One broadcast scene with Minecraft below the ChatXPT Browser Source overlay.
- Screen recording that can show Studio and OBS without exposing credentials, access tokens, private viewer identity, or the overlay fragment grant.

If a required external resource is unavailable, mark the affected row `NOT RUN`; do not substitute a fixture and call it live.

## Preflight

1. Record the exact release candidate:

   ```bash
   git status --short --branch
   git rev-parse HEAD
   npm run check
   ```

2. Start ChatXPT from that exact commit:

   ```bash
   npm run dev
   ```

3. Confirm server-only Twitch, Supabase, and optional provider values are configured without displaying them. The provider may remain unavailable because the credential-free path is mandatory.
4. Upload or serve `release/chatxpt-twitch-extension-finals.zip` through Twitch Local or Hosted Test and configure the deployed ChatXPT EBS origin.
5. In OBS, confirm the raw-game source does not contain the ChatXPT overlay. This prevents recursive analysis.
6. Open only Studio initially. Open the persistent capture tab, Twitch viewer sessions, and OBS Browser Source when the corresponding step calls for them.
7. Start recording before the first Twitch connection or session action.

## One uninterrupted final test

### 1. One Studio, saved identity, and readiness

1. Open `/studio` and show the single navigation.
2. Connect Twitch through Studio OAuth. Confirm the connected channel/game state appears without entering a server setup key in the UI.
3. Open **Profile & Defaults**.
4. Save a clearly recognisable test configuration:
   - game: Minecraft;
   - one named stream preset;
   - a distinctive but safe intensity/creativity balance;
   - one preferred quest style;
   - one forbidden quest style that can be checked later;
   - one accessibility constraint;
   - a small keyword watchlist used in the chat step.
5. Reload Studio and confirm the saved values return.
6. On Home, confirm Twitch, Game Capture, viewer participation, and Broadcast Overlay readiness are separate and honest. Session start must remain unavailable if a required service is genuinely not ready.

**Pass:** One Studio owns setup and the saved configuration returns after reload.
**Fail:** A second full Studio is required, readiness claims a missing service is ready, or saved safety/accessibility data disappears.

### 2. Real Minecraft Game Capture and gameplay understanding

1. In OBS, start the raw Minecraft scene and OBS Virtual Camera.
2. From Studio, open the persistent Game Capture tab and select OBS Virtual Camera.
3. Keep the capture tab open. Return to **Gameplay Engine**.
4. Exercise distinguishable owned-game periods:
   - quiet/standing still;
   - exploration/movement;
   - inventory or menu;
   - safe combat or visible damage if practical;
   - recovery/quiet after the action.
5. On Gameplay Engine, verify:
   - frames processed, analysis rate, last frame, processing latency, and coverage move;
   - the stream-period timeline changes only for accepted evidence;
   - gameplay tempo is separate from Stream vibe and Audience mood;
   - supported facts appear as observed/inferred with freshness and confidence;
   - ambiguous health, hunger, hostile, biome, damage-cause, or exact activity facts remain unknown instead of being guessed;
   - raw frames retained remains zero.

**Pass:** Real frames cross the capture boundary and at least universal activity plus one supported Minecraft fact change truthfully.
**Fail:** Metrics remain static, a fixture is shown as live, the overlay is recursively analysed, or an unsupported exact fact is asserted.

### 3. Real Twitch activity and Live Analytics

Use pre-agreed harmless messages so the result can be checked without leading the product toward unsafe content.

1. Viewer A sends two messages containing one watchlist term and one proposed topic.
2. Viewer B independently mentions the same proposed topic using different wording.
3. Send a short energetic burst, then allow a quiet interval.
4. Let Viewer A become inactive long enough for the current-session lifecycle to change, then send one new message.
5. Open **Live Analytics** and verify:
   - Audience mood changes only when enough evidence exists;
   - previous mood and previous message rate remain distinguishable from current state;
   - keywords and repeated topics reflect qualifying messages;
   - one person or repeated spam is not labelled community consensus;
   - active/new/returning/recently inactive participants are current-session aggregates;
   - Stream vibe still names the selected streamer preset/style rather than duplicating Audience mood;
   - raw messages, usernames, and persistent viewer profiles are absent.

**Pass:** Planned multi-participant changes produce the expected privacy-safe aggregate transitions.
**Fail:** Mood/vibe are conflated, one participant becomes consensus, identities leak, or the displayed state cannot be tied to current-session evidence.

### 4. Private cue and exactly three validated sidequests

1. Continue Minecraft until ChatXPT identifies a suitable, non-disruptive moment.
2. Open the private streamer Live Director view or Live Quests.
3. Inspect the cue reason and source-labelled context.
4. Turn the cue into a vote or request a proposal through the authorised flow.
5. Confirm the official proposal contains exactly three options—not two, four, or a partial loading batch.
6. For each option, check:
   - it is understandable in one glance;
   - it is distinct from the other two;
   - it fits Minecraft or uses honest game-neutral wording;
   - it does not contradict a current known fact;
   - it respects the saved forbidden type and accessibility constraint;
   - it is safe, non-wagering, and feasible within the current stream.
7. Exercise manual approval. If an option is unsuitable, reject it and record why instead of forcing the demo forward.

**Pass:** One suitable moment yields exactly three safe, distinct, context-compatible options through the authoritative path.
**Fail:** A partial batch reaches viewers, an option relies on an unknown/contradicted fact, or the saved hard boundary is ignored.

### 5. Two viewers, private acknowledgement, and one tally

1. Open the installed Twitch Extension for Viewer A and Viewer B in isolated sessions.
2. Confirm both see the same three options and voting deadline.
3. Viewer A selects and confirms one option. Viewer B selects and confirms another.
4. Verify each viewer receives only their own accepted choice and session points state.
5. Attempt a duplicate or late vote and confirm it is rejected without changing the tally.
6. Reconnect one viewer and confirm permitted personal state and the shared cycle recover.
7. If the Extension is unavailable, exercise the hosted Quest Board; if that is unavailable, exercise `1`/`2`/`3` Twitch-chat voting. Record which surface actually accepted each vote.

**Pass:** Two viewers share one authoritative tally while private receipts remain private, and the fallback does not create separate vote authority.
**Fail:** Tally/winner differs between viewers, another viewer's personal state leaks, or a fallback produces an independent result.

### 6. Real OBS payoff, progress, result, and rewards

1. In **Studio -> Test Lab**, generate the current session's OBS Browser Source URL.
2. Add the complete URL to OBS without exposing its fragment token in the recording.
3. Close the vote through the authorised time/control path.
4. Show the same winner in Studio, both viewer sessions, and the real OBS Browser Source.
5. Activate the winning sidequest.
6. Update progress through a permitted real/manual path. Do not claim automatic completion unless the predicate-bearing evidence path is actually demonstrated.
7. Mark one honest terminal result: succeeded, failed, cancelled, skipped, or expired.
8. Verify result, non-monetary session points, community hype, and overlay state update consistently.
9. Confirm the public overlay contains no private cue rationale, raw chat, usernames, provider detail, personal vote, or personal points.

**Pass:** The same cycle and winner reach Studio, two viewers, persistence/realtime when configured, and OBS; progress and one terminal result propagate without privacy leakage.
**Fail:** Any surface disagrees, OBS is only a browser preview rather than a real Browser Source, or private data appears publicly.

### 7. Current-stream override and controlled recovery

1. In **Stream Settings** or Twitch Live Config, apply an unmistakable temporary intensity/creativity override.
2. Confirm the current stream changes while saved defaults remain unchanged.
3. Reset to saved defaults and confirm the temporary value disappears.
4. Run one controlled recovery case:
   - disable the optional model provider and confirm algorithmic/deterministic continuation on the same real inputs; or
   - stop/restart OBS Virtual Camera and confirm live capture readiness drops then recovers; or
   - disconnect/reconnect a viewer and confirm state recovery.
5. Exercise skip or cancellation with confirmation, then begin another cycle and confirm the old confirmation cannot carry into it.

**Pass:** The override is reversible and the selected failure becomes visible, honest, recoverable, and non-destructive.
**Fail:** Saved defaults are overwritten, Studio keeps claiming a lost input is live, provider failure stops the credential-free workflow, or stale confirmation affects a new cycle.

### 8. End the session

1. End ChatXPT from Home.
2. Verify the ended state is visible and no page continues to claim an active session.
3. Do not present the current-session Live Analytics screen as implemented post-stream analytics or history; that capability remains deferred.

## Per-feature evidence record

Record `PASS`, `FAIL`, or `NOT RUN` for every row. A source or automated test result cannot be substituted for a missing live result.

| Feature | Required artifact or observation | Result |
| --- | --- | --- |
| One Studio/setup | Recording of OAuth/readiness/navigation plus saved profile reload |  |
| Gameplay Engine | Real OBS Virtual Camera recording with moving processing metrics and known/unknown facts |  |
| Live Analytics | Planned two-participant chat sequence and aggregate state transitions |  |
| Live Quests | Cue evidence and exactly-three review, including restrictions check |  |
| Profile & presets | Reload/new-session persistence and forbidden/accessibility enforcement |  |
| Stream Settings/Live Config | Apply/reset current-stream override and one lifecycle control |  |
| Viewer participation | Two isolated viewers, private receipts, duplicate/late rejection, reconnect |  |
| Participation fallback | Hosted board or Twitch-chat vote on the same authoritative cycle |  |
| OBS overlay | Real OBS Browser Source showing winner, active, progress, result, reconnect |  |
| Rewards | Viewer-private session points plus public community hype after result |  |
| Recovery/fallback | Provider, capture, token, or viewer recovery without fabricated state |  |
| Ended state | Session ends consistently; no post-stream analytics overclaim |  |

For every passed row, retain the exact branch/commit, input source, interaction, timestamp, artifact reference, reviewer, evidence class, and limitation in `docs/evidence/manifest.json`. Keep recordings outside Git if they contain gameplay identity, account details, chat identity, or tokens.

## Five-minute final edit

The complete run may be longer than five minutes. Cut it into this judge-visible sequence without changing its chronology or hiding failures:

| Time | Segment | Minimum visible proof |
| --- | --- | --- |
| 0:00-0:25 | Pain and promise | Playing, understanding chat, and operating interactions compete for attention; ChatXPT closes that loop without claiming to create viewers |
| 0:25-0:55 | One-time setup | One Studio, Twitch connected, saved Minecraft preset, OBS raw-game source and Browser Source |
| 0:55-1:35 | Real understanding | Minecraft through OBS Virtual Camera; processing metrics, current period, supported facts, honest unknowns |
| 1:35-2:05 | Audience understanding | Real planned Twitch messages update mood, rate, keywords/topics, and participant aggregates |
| 2:05-2:45 | Three quests | One source-supported cue becomes exactly three safe options with streamer review |
| 2:45-3:35 | Viewer agency | Two viewers vote; private acknowledgement and one shared tally/winner |
| 3:35-4:20 | Broadcast payoff | Winner, active quest, progress, result, points/hype appear through real OBS and viewer surfaces |
| 4:20-5:00 | Control and resilience | Current-stream override/reset plus one provider/capture/viewer recovery; close on the honest limitation boundary |

## Claims the final run may support

Only when visibly executed and recorded:

- Real OBS Virtual Camera gameplay reaches ChatXPT's extraction boundary.
- Real Twitch activity produces privacy-safe current-session aggregates.
- Exactly three validated quests are proposed from current supported context.
- Two viewers participate in one authoritative cycle with private acknowledgement.
- The winning quest, progress, and result reach a real OBS Browser Source.
- Saved streamer boundaries persist and current-stream overrides are reversible.
- Missing provider or interrupted capture/viewer state recovers without fabricated facts.

## Claims it must not make

- ChatXPT is proven to increase retention, revenue, subscriptions, growth, or product-market fit.
- Twitch/OBS/Extension source code or fixtures alone prove a live integration.
- ChatXPT understands every game, mod, HUD, biome, mob, health value, damage cause, or objective.
- Exactly three is research-proven as the optimal number of choices.
- Audience mood is the same as the streamer-selected Stream vibe.
- A current-session returning participant is a persistent cross-stream viewer profile.
- Manual progress demonstrates automatic predicate-based completion.
- Current-session Live Analytics is post-stream analytics/history.
