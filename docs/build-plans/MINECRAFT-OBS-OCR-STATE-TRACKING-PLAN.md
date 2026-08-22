# Minecraft OBS/OCR State-Tracking Execution Plan

**Status:** Implementation in progress; foundation and local recording diagnostics complete, live evidence pending
**Decision authority:** D-086
**Parent plan:** `docs/build-plans/MINECRAFT-AWARE-IMPLEMENTATION-PLAN.md`
**Primary responsibility:** Role 2 gameplay extraction and temporal intelligence
**Integration responsibilities:** Role 1 frame ingress/runtime, Role 3 deterministic validation, Role 4 truthful status display
**Primary target:** Vanilla Minecraft Java Survival, default HUD, single-player Normal difficulty

## Purpose

Turn a connected OBS Virtual Camera or browser-selected screen/window into a stable, explainable Minecraft state timeline before optimising AI prompts or quest generation.

This is an execution addendum to the D-086 Minecraft-aware plan. It operationalises and, for the current evidence pass, supersedes that plan's detector/runtime work in Phases 2 through 5 and its real-input evidence work in Phase 9. It does not replace the parent plan's schema, AI-context, Role 3, privacy, or truthful-disclosure boundaries.

The implementation must distinguish four different claims:

1. A frame source is connected.
2. Minecraft is visible in the sampled viewport.
3. A HUD or screen-state observation is stable enough to trust.
4. A gameplay event or situation is supported by a temporal sequence.

No layer may promote the claim made by the layer before it without its own evidence.

## Scope

In scope:

- The existing OBS Virtual Camera path and the existing browser screen/window picker.
- Aspect-preserving viewport normalisation and Minecraft game-area localisation.
- Minecraft screen-state classification using local pixels, templates, and selective OCR.
- Stable health, hunger, armor, air/oxygen, experience, hotbar, menu, pause, furnace, sleep, death, and respawn observations.
- Temporal inference for damage, recovery, eating, mining, pickup, experience gain, crafting, cooking/smelting, block placement, swimming, attack, confirmed hit, sleep/wake, daylight transition, death, respawn, movement, and cautious jump hints.
- Replay calibration against owner-authorised, separately annotated recordings.
- Truthful runtime states such as `confirmed`, `reconfirming`, `stale`, `unknown`, and `unsupported`.
- Projection into existing flat canonical signals, typed AI context, and Role 3 validation.

Out of scope for this pass:

- A Minecraft mod, server plugin, telemetry bridge, memory reader, packet inspection, or game-process hook.
- Sending raw frames or screenshots to an AI provider.
- Exact mob, biome, item, recipe, or damage-cause recognition without separately evidenced support.
- Redesigning Studio, Twitch, voting, OBS overlays, or the quest engine.
- Treating recordings or synthetic fixtures as live OBS evidence.

## Current-State Findings

The repository already has useful pieces:

- `src/extraction/multi-game-vision.ts` selects the trusted game profile and drives bounded visual analysis.
- `src/extraction/minecraft-hud.ts` searches lower-screen HUD regions and estimates health, hunger, armor, hotbar visibility, and coarse selected-item category.
- `src/extraction/minecraft-menu.ts` and `src/extraction/minecraft-scene.ts` provide conservative menu and scene hints.
- `src/extraction/minecraft-runtime.ts` promotes confirmed observations into recent-damage, danger, recovery, and activity facts.
- `src/extraction/game-vision-snapshot.ts` projects Role 2 results into game-neutral canonical signals.
- `src/extraction/selective-ocr.ts` and `src/extraction/tesseract-ocr.ts` provide local, selective OCR seams.
- `src/extraction/recording-replay.ts` can replay authorised recordings through production analysis without presenting them as live input.

The current implementation is still too brittle for the promised experience:

- Capture frames are sampled into a fixed analysis size. A source whose aspect ratio includes desktop chrome or differs from 16:9 can be stretched, shrinking and distorting the HUD.
- Exact HUD facts depend on adjacent matching readings. A single ambiguous frame can clear candidate history and make a valid value flicker back to unknown.
- The newest per-frame verdict can overwrite the last stable state even when the detector is merely reconfirming.
- Health colour rules are too narrow for Minecraft status-effect variants such as poisoned hearts.
- Menu, HUD, and action cues are not yet composed through one explicit state machine, so comparisons may cross pause, inventory, death, respawn, or hidden-HUD boundaries.
- Pixel activity can show that something changed, but it cannot by itself distinguish attacking, mining, placing, eating, taking damage, or healing.
- Real Vanilla Minecraft accuracy, flicker, event precision, and end-to-end latency have not been measured against an annotated OBS/browser recording set.

## Owner-Provided Evidence Set

Recording A is an owner-authorised Vanilla Minecraft Java Survival, single-player, Normal-difficulty, default-visuals recording. The raw recording and sampled frames remain outside Git.

Its supplied annotation windows cover:

- turning;
- breaking a block and picking up the result;
- two crafting sequences;
- jumping while moving;
- attacking;
- attacking while being attacked;
- a separate damage event;
- eating;
- health recovery after eating;
- the pause menu;
- death; and
- respawn.

Initial local inspection establishes useful test targets, not accuracy claims:

- Crafting/inventory panels and their text are visually strong selective-OCR candidates.
- Block cracking, hand/tool motion, block disappearance, and pickup form a useful mining sequence.
- Target red flash, particles, disappearance, and drops form a stronger hit/kill sequence than motion alone.
- The attack/damage sequence includes a status-effect heart appearance that the current red-pixel heart rule can lose.
- Eating has a selected-food label, repeated use animation, food particles, and a later hunger increase.
- Recovery is a delayed health increase following food use; it must not be inferred from one brighter frame.
- Pause, death, and respawn are strong OCR/state-transition anchors.
- Jumping while moving remains a lower-confidence visual-only inference unless the temporal camera-motion pattern proves separable.
- The recording contains a desktop-sized frame rather than a clean 16:9 game feed, demonstrating why viewport localisation must precede HUD analysis.

Recording B is a second owner-authorised Vanilla Minecraft Java Survival, single-player, Normal-difficulty, default-visuals recording. It is 431.64 seconds of H.264 video at 3024×1964 and approximately 57.7 average frames per second. Like Recording A, it includes desktop chrome around the game and therefore strengthens the viewport-localisation requirement. Its raw video and sampled frames remain outside Git.

Its supplied annotation windows cover:

- swimming and submersion;
- ordinary mining;
- mining followed by a visible experience orb;
- repeated block placement;
- jumping, then jumping while moving;
- a gradual sunset/dusk transition;
- player-inventory and crafting-table crafting;
- a second eating sequence;
- a furnace/cooking sequence;
- extended hostile combat;
- attacking while taking damage; and
- sleeping, leaving the bed, and waking into daylight.

Local inspection adds these concrete detector requirements, not accuracy claims:

- Submersion has a strong blue underwater scene appearance and a separate oxygen-bubble HUD band above hunger. Seeing water alone is not sufficient to call swimming.
- Mining again shows repeated tool motion and progressive crack texture. The experience example adds block disappearance, a visible green experience orb, and an experience HUD that can later corroborate gain.
- Block placement is now directly evidenced: a selected dirt block is followed by a new stable block at the crosshair and a decreasing selected stack count. This is stronger than hand motion alone.
- The two jump windows are valuable positive annotations, but ordinary first-person walking bob remains a confounder. Jump should remain a hint until vertical-motion and landing features pass holdout evidence.
- Sunset is a slow sky and illumination transition across tens of seconds. Several frames also face dark nearby blocks, proving that raw whole-frame brightness must not be treated as time of day.
- The crafting sequence distinguishes the player inventory's 2×2 crafting grid from a crafting table's 3×3 grid and visibly changes ingredients/output. Panel geometry plus bounded title OCR is stronger than generic menu detection.
- The eating sequence again has a selected-food label, repeated use animation, food particles, and a later food-state change.
- The furnace sequence has a `Furnace` title, input/fuel/output layout, flame/progress indicators, and a lit furnace in the world. An open active furnace supports `cooking-in-progress`; completion still requires an output or inventory transition.
- Extended combat supplies repeated target red-flash, hit particles, hostile disappearance, drops, experience, and independent health loss. Damage animation temporarily changes/flashes heart appearance, reinforcing outline/cadence tracking instead of red-fill-only counting.
- Sleep has a distinctive bed view and `Leave Bed` button, then transitions to daylight. The visible chat history and advancement toast must be excluded from general OCR and provider context.

The two recordings complement one another as follows:

| Capability | Recording A | Recording B | Planning consequence |
| --- | --- | --- | --- |
| Viewport normalisation | Desktop-shaped source | Desktop-shaped source | Required before every calibrated detector |
| Health/hunger stability | Damage, poison/status hearts, eating, recovery | Damage flash, eating, sustained low health | Track icon structure and state over time, not red pixels per frame |
| Mining/pickup | Block break and pickup | Repeated mining plus experience orb | Separate attempt, completion, pickup, and experience gain |
| Block placement | Not cleanly isolated | Repeated clear placement | Add a calibrated placement/building state machine |
| Crafting | Crafting/inventory windows | 2×2 inventory and 3×3 table sequences | Distinguish screen type and confirm craft from slot transitions |
| Furnace/cooking | Missing | Active furnace UI and lit world block | Add furnace screen state and cooking-progress inference |
| Water/swimming | Missing | Surface/submerged transition and oxygen bubbles | Add submerged/air facts before swimming inference |
| Combat | Attack, attacked, damage, death | Long multi-hostile fight and mixed attack/damage | Track attack attempt, hit, damage, defeat, and XP independently |
| Time of day | Pause/death/respawn | Slow sunset and sleep-to-day transition | Add long-window sky/daylight state, not raw brightness |
| Sleep/wake | Missing | `Leave Bed` and night-to-day transition | Add explicit sleeping and waking transitions |
| Jump | Jump while moving | Jump-only and jump-while-moving labels | Keep lower-confidence until separated from walking bob |

Additional owner recordings should use the same evidence catalogue and annotation schema. They should extend calibration or holdout coverage rather than create a new detector architecture.

## Settled Processing Architecture

```text
OBS Virtual Camera or selected screen/window FrameSource
  -> aspect-preserving frame normaliser
  -> Minecraft viewport locator
  -> screen-state classifier and selective OCR
  -> raw HUD/action observations
  -> observation stabiliser with hysteresis and expiry
  -> temporal event state machines
  -> current Minecraft situation
  -> flat canonical GameplaySnapshot signals
  -> typed AI context
  -> Role 3 deterministic validation
```

Keep these data layers separate:

- **Raw observation:** what one analysed frame appears to contain.
- **Stable state:** the last supported value plus confidence, freshness, and tracking status.
- **Inferred event:** a bounded transition supported by multiple observations.
- **Situation:** the current gameplay context assembled from states and recent events.

The private tracker should model at least these screen states:

- `gameplay`
- `pause`
- `inventory`
- `crafting`
- `furnace`
- `sleeping`
- `death`
- `respawning-or-loading`
- `unknown`

The private tracker should model at least these fact-tracking states:

- `candidate`
- `confirmed`
- `reconfirming`
- `stale`
- `unknown`
- `unsupported`

## Detection Invariants

- Preserve source aspect ratio. Never non-uniformly stretch an input to the analysis grid.
- Locate and crop the actual game viewport before scaling when desktop chrome, borders, or letterboxing are present.
- Exclude desktop chrome, chat history, advancement/recipe toasts, and unrelated notification regions from general scene statistics and OCR; OCR only named bounded game-UI regions.
- Do not compare HUD values across pause, inventory, crafting, death, respawn/loading, hidden HUD, viewport relocation, source change, or game-profile change.
- Do not turn one missed observation into a confirmed-to-unknown transition.
- Do not infer damage, recovery, eating, combat, mining, pickup, crafting, or building from global pixel activity alone.
- Do not infer cause from correlation alone. For example, lower health proves damage, not mob damage; rising health proves recovery, not necessarily eating.
- Death-to-respawn health restoration is a reset transition, not healing.
- A configured single-player session plus a confirmed pause-menu screen may set `simulationPaused=true`. Inventory or crafting must not automatically be called paused.
- Poisoned, withered, absorption, hardcore, flashing, and partially obscured heart variants must either use supported templates/features or degrade honestly; they must not be counted as ordinary empty hearts.
- Do not infer swimming from water-coloured pixels alone, cooking from a furnace-shaped block alone, experience gain from a green particle alone, or sunset from one dark frame.
- Time-of-day inference requires a long-window sky/daylight trend and must suspend when the sky is absent, the player is submerged, or the view is mostly occluded.
- Raw frames remain ephemeral and local. Stored evidence contains annotations, hashes, aggregate metrics, sanitised OCR, and detector outputs only after privacy review.

## Implementation Progress — 22 August 2026

Completed foundation:

- Browser sampling now preserves the selected source aspect ratio with bounded `contain` sampling and removes only sampler-added letterboxing before analysis. A 3024×1964 source is no longer non-uniformly stretched into 640×360.
- Minecraft HUD search now includes a windowed/full-display geometry model and rejects partial-hotbar continuations that can make five icons look like ten smaller slots.
- A rolling two-of-three `MinecraftObservationTracker` separates raw candidates from stable facts, retains original evidence timestamps during short misses, exposes `confirmed`/`reconfirming`/`stale`/`unknown`, and expires carried facts after three seconds.
- Health bands support dominant red, poisoned-green, frozen-blue, and absorption-warm palettes while preserving repeated ten-slot structure.
- Hunger parsing combines the current red/brown and warm sprite families instead of assuming one orange palette.
- Air bubbles and `submerged` are separate from hunger and armor. Armor is withheld underwater when the blue scene can contaminate the armor region.
- Generic container and real sleep-screen proposals gate HUD, scene, damage, and gameplay-activity deltas. Exact inventory/crafting/furnace subtype remains unknown without the later selective-OCR phase.
- Stable fact timestamps and expiry now reach flat gameplay signals and the typed Minecraft AI context for health, hunger, air bubbles, and submersion.
- The minimum quest-facing state contract now uses independent concurrent axes for movement (`stationary`/`moving`/`walking`/`running`), turning, combat, eating, health trend, screen, environment, and life. Ambiguous walking-versus-running windows retain the truthful `moving` value.
- A local brightness tracker now adds an independent `day`/`night` environmental axis. Day requires a sustained bright window; night requires a much longer uninterrupted dark window; an abrupt darkness drop retains the last confirmed day state as an indoor, shadowed, or camera-occluded view until the earlier brightness returns.
- A bounded local camera-motion field replaces whole-frame pixel change for Minecraft movement and turning. A separate narrow action detector uses temporally confirmed target-hit flashes and vanilla item-use poses for attacking and eating.
- Vanilla pause, inventory/container, sleep, and death screens are projected explicitly and held briefly across one-frame misses so screen-state flicker cannot create action or health deltas.
- The Studio detector proof now exposes every minimum state axis instead of hiding them behind the legacy single activity label.

Local diagnostic evidence, not live capture evidence:

- A bounded frame sampled from Recording B's underwater window produced a confirmed rolling HUD with 10 hearts, 7 hunger, 9.5 air bubbles, `submerged=true`, and armor honestly unknown.
- Recording B's crafting and furnace frames produced `menuState=container`; the analyzer suppressed false HUD values and damage/action inference behind those overlays.
- Recording B's bed frame produced `menuState=sleeping` and `activity=sleeping`, while a nearby underwater gameplay frame remained non-sleeping.
- A third owner-authorised default Vanilla Java recording supplied isolated pause, stationary, left/right turning, walking, running/jumping, combined travel-plus-turning, and inventory/close windows. Product replay kept all 50 labelled stationary samples stationary, held pause for 18 of 20 sampled frames, and exposed combined travel and turning without forcing an unreliable pace label.
- Representative real frames passed through the complete analyzer as `gameplay`, `pause`, `inventory`, `sleeping`, and `dead`; the gameplay pair produced a confirmed vanilla-like HUD with known health and hunger. Separate annotated sequences produced temporally bounded attacking and eating states, while unsupported mixed-combat frames remained unknown.
- Raw recordings and sampled frames remain outside Git. These checks do not satisfy the live OBS/screen-picker acceptance gate or the calibration/holdout accuracy gate.

Still open:

- Stable-border/desktop-chrome localisation metadata and material-viewport-change reacquisition.
- Selective OCR for exact crafting/inventory/furnace subtype and furnace progress; respawn transition confirmation remains open even though the death screen has a visual state.
- Experience tracking, broader event machines, formal daylight/jump replay calibration, formal replay confusion matrices, and real OBS plus screen-picker proof.

## Ordered Implementation Phases

### Phase 0: Evidence Catalogue and Annotation Contract

**Outcome:** Every calibration claim can be traced to an authorised clip and a separate ground-truth timeline.

Work:

- Register Recordings A and B in the private/local evidence workflow without adding the raw files or sampled frames to Git.
- Define one machine-readable annotation seam for time ranges, screen state, visible HUD values when manually countable, event labels, confidence of the human label, and ambiguity notes.
- Add incoming owner recordings to the same schema.
- Split calibration and holdout ranges so thresholds are not accepted only because they fit the examples used to tune them.

Acceptance:

- Raw media and player-identifying pixels are absent from Git.
- Every measured result names a clip hash/id, annotation version, analyzer version, and calibration/holdout role.
- Ambiguous labels remain ambiguous rather than becoming false ground truth.

### Phase 1: Source and Viewport Normalisation

**Outcome:** OBS and screen-picker frames produce the same undistorted Minecraft analysis viewport when they show the same game.

Likely files:

- Extend `src/extraction/visual-measurements.ts`.
- Add `src/extraction/minecraft-viewport.ts` and focused tests.
- Integrate through `src/extraction/multi-game-vision.ts`.
- Use the existing Role 1 `FrameSource`; do not create a second capture authority.

Work:

- Preserve aspect ratio with letterbox-aware fit/crop rather than a forced fixed rectangle.
- Detect the likely game content bounds using stable borders, full-screen content, and Minecraft HUD/crosshair anchors.
- Return the source size, crop bounds, scale, and viewport confidence with every analysis result.
- Produce exclusion masks for desktop chrome and stable non-game regions before scene/HUD measurements.
- Reset temporal trackers only when the viewport materially changes, not on harmless one-pixel crop jitter.
- Mark the calibrated adapter unavailable when the usable viewport is too small; universal motion analysis may continue.

Acceptance:

- The desktop-sized Recordings A and B are analysed without geometric stretching.
- Clean 16:9 OBS input retains its full gameplay viewport.
- Letterboxed and desktop-with-chrome fixtures localise the same HUD positions after normalisation.
- A viewport change creates an explicit re-acquisition state rather than false damage/recovery/activity events.

### Phase 2: Screen-State Classifier and OCR Gating

**Outcome:** The analyzer knows when gameplay simulation and the ordinary HUD timeline are valid.

Likely files:

- Extend `src/extraction/minecraft-menu.ts`.
- Add `src/extraction/minecraft-screen-state.ts` and tests.
- Reuse `src/extraction/selective-ocr.ts` and `src/extraction/tesseract-ocr.ts`.

Work:

- Build cheap visual proposals first; invoke OCR only for bounded candidate regions and state transitions.
- Recognise high-value text anchors for pause, inventory/crafting, furnace, sleeping, death, and respawn.
- Distinguish player inventory/2×2 crafting, crafting table/3×3 crafting, and furnace layouts using panel geometry before selective title OCR.
- Recognise the fixed `Leave Bed` control without reading the chat-history region shown on the sleep screen.
- Combine text, panel geometry, crosshair visibility, HUD visibility, and transition history.
- Require matching OCR/state evidence before confirming a new non-gameplay screen.
- Gate HUD deltas and event machines while the screen is not confirmed gameplay.

Acceptance:

- Recording A's pause, death, and respawn windows and Recording B's crafting, furnace, sleep, and wake windows are distinguished.
- Inventory, crafting, furnace, and sleeping are not reported as normal gameplay.
- Brief menus or OCR misses do not create health, hunger, damage, recovery, or combat deltas.
- OCR remains local, cropped, rate-limited, and absent from provider input.

### Phase 3: Persistent HUD Tracking

**Outcome:** Health, hunger, armor, air/oxygen, experience, and hotbar state remain stable through normal visual noise and become unknown only for a clear reason.

Likely files:

- Extend `src/extraction/minecraft-hud.ts`.
- Add `src/extraction/minecraft-observation-tracker.ts` and tests.
- Integrate through `src/extraction/multi-game-vision.ts`.

Work:

- Separate raw HUD candidates from the last confirmed HUD state.
- Use confidence hysteresis: promotion requires stronger evidence than continued tracking.
- Start with the existing accepted `>= 0.75` promotion gate and two matching observations out of three; calibrate exact matching tolerances from real evidence.
- Keep a confirmed value in `reconfirming` during a short bounded dropout instead of immediately clearing it.
- Respect the existing three-second freshness expiry: after the dropout budget, move to `stale`, then `unknown` only when expiry or an explicit unsupported state requires it.
- Track icon cadence, outlines, filled/empty state, and status-effect-compatible appearance rather than red-pixel ratio alone.
- Track the oxygen-bubble band separately from hunger. Exact remaining air stays unknown unless repeated icon counting is reliable; the band may still strongly support `submerged=true`.
- Track the experience level number and green bar only when viewport resolution is sufficient. A visible orb is corroborating event evidence, not an exact XP value.
- Preserve value and tracking status separately so the UI can say “last confirmed 8 hearts; reconfirming” without pretending the current frame proved it.

Acceptance:

- One weak frame cannot cause `confirmed -> unknown -> confirmed` flicker.
- Status-effect hearts in Recording A do not disappear merely because their fill colour changes.
- Damage-flashing hearts in Recording B do not disappear or become false empty hearts.
- Recording B's oxygen band can support submerged state without being confused with armor or hunger.
- A genuinely hidden HUD becomes stale/unknown inside the bounded expiry window.
- Health/hunger comparisons resume only after the same viewport and gameplay state have been reacquired.

### Phase 4: State Delta Timeline

**Outcome:** Stable HUD and screen-state changes become a trustworthy ordered timeline before causes are inferred.

Likely files:

- Extend `src/extraction/minecraft-runtime.ts`.
- Add `src/extraction/minecraft-state-timeline.ts` and tests if keeping the logic separate improves clarity.

Work:

- Record bounded transitions for health, hunger, armor, air/oxygen, experience level/bar, selected slot/category/count, screen state, daylight state, HUD visibility, and source/viewport changes.
- Require the new value to be confirmed before emitting a delta event.
- Attach before/after values, confidence, observation window, source ids, and reason for suppression.
- Suppress impossible or context-invalid transitions.
- Reset or segment the timeline at death/respawn, source change, profile change, and material viewport change.

Acceptance:

- Recording A can produce separate supported transitions for damage, hunger increase, health recovery, pause, death, and respawn.
- Recording B can produce separate supported transitions for submersion, experience gain, selected-block count decrease, furnace state, sleeping, waking, and night-to-day reset.
- Respawn is not emitted as a large heal.
- Menu transitions never manufacture gameplay deltas.

### Phase 5: Temporal Event State Machines

**Outcome:** Supported sequences become useful Minecraft events without overclaiming from isolated pixels.

Likely files:

- Add `src/extraction/minecraft-events.ts` and tests.
- Extend `src/extraction/minecraft-runtime.ts` only for final fact/situation projection.
- Reuse motion/region measurements from `src/extraction/visual-measurements.ts`.

Initial event rules:

- **Eating:** selected item is food or food label OCR is supported; repeated use animation/food-particle activity occurs; hunger later rises. Emit `eating-attempt` early and `eating-confirmed` only after corroboration.
- **Recovery:** confirmed health rises across gameplay frames. Link to recent eating only as `likely food-related recovery` when the eating sequence is confirmed and temporally close.
- **Damage:** confirmed health decreases. Attack flashes, directional motion, or status effects may raise combat-risk confidence but do not prove cause.
- **Mining:** crosshair-local repeated tool/hand motion plus progressive crack/texture change. Confirm completion only with block disappearance and/or pickup evidence.
- **Pickup:** a new floating item/object disappears near the player or hotbar/inventory evidence changes; remain `likely` unless sufficiently corroborated.
- **Experience gain:** a visible experience orb supports a candidate; confirm only when the experience bar or level changes, or when a stable orb-contact sequence is sufficiently calibrated. Do not infer an exact amount.
- **Attack:** repeated hand/weapon motion toward a target is an attempt. Red target flash, hit particles, target knockback/disappearance, or drops support confirmed hit/kill.
- **Being attacked:** confirmed health loss plus hostile-like/impact evidence. Without both, retain `damage` only.
- **Crafting:** confirmed crafting screen plus recipe/output-slot interaction or output/inventory change. Do not infer crafting from an open inventory panel alone.
- **Cooking/smelting:** confirmed furnace screen plus active flame/progress evidence supports `cooking-in-progress`. Confirm completion only from an output-slot or corresponding inventory transition.
- **Building:** selected block evidence plus placement motion and a new stable block-like region at the crosshair support a placement candidate. Confirm when the selected stack count also decreases or the new block persists across the camera change demonstrated in Recording B.
- **Submerged/swimming:** oxygen-bubble HUD and underwater scene evidence support `submerged`. Add coherent player/camera translation before inferring `swimming`; water visibility without both remains environment only.
- **Daylight transition:** use a slow sky-region luminance/chroma trend with horizon/sky visibility over several seconds. Nearby darkness, caves, underwater tint, or a single camera turn cannot prove sunset. Sleep-to-day is a separate screen-state transition, not ordinary sunrise tracking.
- **Sleeping/waking:** confirm sleeping from the bed view plus `Leave Bed`; waking requires exit from that screen and reacquired gameplay. A sudden night-to-day transition immediately afterward supports `slept-through-night` without estimating exact time.
- **Movement/turning:** use global translation/camera motion only as a broad movement state.
- **Jumping:** remain a lower-confidence hint unless vertical camera-motion and landing patterns are distinguishable on holdout evidence.

Acceptance:

- Every event declares whether it is an attempt, confirmed event, likely event, or unsupported inference.
- No event is emitted solely because the entire frame changed.
- Overlapping sequences such as attacking while being attacked can emit independent attack-attempt and damage events.
- The owner-provided windows are replayed without merging eating, recovery, damage, pause, death, respawn, swimming, placement, furnace, daylight, or sleep/wake into one generic activity label.

### Phase 6: Situation Projection and Runtime Semantics

**Outcome:** The gameplay engine and downstream consumers receive stable, honest facts instead of a flickering latest-frame verdict.

Likely files:

- Extend `src/extraction/game-vision-snapshot.ts`.
- Extend `src/extraction/minecraft-state.ts`.
- Update `src/extraction/game-state-context.ts` only where the existing typed context lacks a required supported fact.
- Update Role 4 status rendering only through its public seam if `reconfirming`/`stale` disclosure is not currently expressible.

Work:

- Keep canonical `GameplaySnapshot` signals flat and game-neutral.
- Publish stable values, freshness, confidence, and evidence source separately from tracker status.
- Build current situations such as gameplay, paused, crafting, cooking, submerged/swimming, recovering, building, combat-risk, recently damaged, sleeping, waking, dusk/night, death, and respawning only from supported states/events.
- Preserve unknown and unsupported facts in AI context so the model cannot fill gaps.
- Keep Role 3 deterministic evidence validation authoritative.

Acceptance:

- A connected source with no confirmed Minecraft viewport says connected but not yet understood.
- A short visual miss says reconfirming rather than replacing a valid stable fact with unknown.
- Stale or weak events cannot justify AI citations or Role 3 candidate acceptance.
- Existing generic-game and non-Minecraft paths remain unchanged.

### Phase 7: Replay Calibration and Accuracy Gate

**Outcome:** Thresholds and temporal windows are chosen from real evidence and measured on held-out sequences.

Likely files:

- Extend `src/extraction/recording-replay.ts` and tests only if the current report lacks required timelines.
- Add sanitised aggregate results to the existing Role 2 evidence artefact/report path after privacy review.

Recommended initial acceptance targets for owner approval and calibration:

- Viewport localisation succeeds on at least 95% of annotated visible-Minecraft frames in the supported default setup.
- During confirmed gameplay HUD visibility, health and hunger are within half an icon on at least 90% of manually countable holdout observations.
- A single analysed-frame miss causes zero confirmed-to-unknown flickers.
- False confirmed damage, recovery, eating, pause, furnace, sleep, death, and respawn events are each below one per ten minutes of annotated negative footage.
- Pause, death, respawn, damage, eating, recovery, furnace, sleep, and wake each achieve at least 90% precision and 80% recall on the initial supported recording set.
- Confirmed HUD changes and high-value screen transitions appear within two seconds at the accepted analysis cadence.
- Mining, pickup, experience gain, attack, crafting, building, swimming, and daylight transition remain `likely` or `attempt` unless their individual precision gate is met; target at least 85% precision before exposing them as confirmed facts.

The exact numbers are an implementation gate proposal, not a live accuracy claim. Record the final accepted thresholds and machine/runtime conditions with the evidence.

Acceptance:

- Calibration and holdout results are separate.
- Confusion cases and unsupported sequences are listed, not hidden in averages.
- The analyzer version, source resolution, crop, cadence, processing p50/p95, and event latency are recorded.
- Failure to meet a fact's gate disables or downgrades that fact; it does not block safe generic capture and motion signals.

### Phase 8: Live Capture and Golden-Workflow Evidence

**Outcome:** The supported path works from a real live frame source through stable facts and quest inputs.

Work:

- Run the same supported Minecraft scenario once through OBS Virtual Camera and once through the screen/window picker.
- Verify source label, source dimensions, viewport bounds, current screen state, stable HUD state, tracker status, and recent events.
- Verify raw frames are released and never persisted or sent to AI.
- Verify typed known/unknown facts reach the candidate boundary.
- Verify Role 3 rejects unsupported claims and the credential-free fallback still produces safe options.
- Capture truthful evidence for capture health, analysis latency, known/unknown behaviour, and quest flow.

Acceptance:

- The live run proves more than connection: at least pause/death/respawn and one HUD delta/event cross the real frame boundary.
- OBS and screen-picker inputs use the same downstream analyzer and fact semantics.
- Existing Twitch, Studio, overlay, voting, and non-Minecraft flows are not broken.
- Source inspection alone is never presented as live evidence.

## Test Matrix

Unit/component tests:

- Aspect-preserving normalisation and viewport crop stability.
- Screen-state OCR positive, negative, ambiguous, and dropout cases.
- HUD promotion, hysteresis, expiry, status-effect hearts, hidden HUD, and source reset.
- Delta suppression across menu/death/respawn/source changes.
- Each temporal event's positive, negative, ambiguous, and overlapping sequence.
- Unknown/unsupported projection and freshness enforcement.

Replay tests:

- Recording A's supplied time windows.
- Recording B's supplied swimming, mining/XP, placement, jump, sunset, crafting, eating, furnace, combat/damage, and sleep/wake windows.
- Cross-recording checks that the same health, hunger, eating, crafting, mining, attack, and damage semantics survive different lighting and context.
- At least one negative/quiet sequence for false-positive measurement.
- At least one changed UI scale or resolution sequence.

Integration tests:

- Browser `FrameSource` to Role 2 analyzer.
- OBS Virtual Camera `FrameSource` to the same analyzer.
- Analyzer to `GameplaySnapshot` to typed AI context.
- AI context to Role 3 evidence validation and fallback.
- Capture source stop/change/reselect without stale state leakage.

Regression tests:

- Generic and Brawl Stars analyzers retain existing behaviour.
- Capture cancellation and picker recovery remain within the same Studio page.
- No raw frame, OCR crop, secret, Twitch identity, or local path reaches browser persistence, provider context, logs, or Git evidence.

## Rollout and Rollback

- Introduce the tracker behind the existing trusted Minecraft profile, not as a new public capture mode.
- Keep the current stateless observation path available internally until replay and live gates pass.
- Compare old and new outputs in local diagnostics without publishing both as authoritative facts.
- Promote one fact/event family at a time: viewport/screen state, HUD state, deltas, then temporal events.
- If a family fails its evidence gate, disable or downgrade only that family to `unknown`; retain capture, universal activity signals, and the deterministic quest fallback.
- Rollback must not require changing OBS Browser Sources, Twitch configuration, streamer identity, or saved profile data.

## Dependencies and Coordination

- Role 1 supplies one canonical ephemeral `FrameSource`, lifecycle reset signals, and the runtime route. Role 2 must not create a second source authority.
- Role 2 owns viewport, OCR policy, HUD tracking, event machines, thresholds, evidence, and known/unknown semantics.
- Role 3 owns whether supported facts are enough to validate or reject quest candidates.
- Role 4 only renders the public status/read model and must not infer game state from raw UI data.
- No new dependency is required for the first pass. Any OpenCV, ONNX, template package, or model proposal needs a separate dependency/cost/privacy review and must preserve the credential-free local path.

## Remaining Owner Inputs

No additional owner decision is required to begin Phases 0 through 3.

No more action-sequence recording is required before implementation begins. Recordings A and B now cover the first-pass event families.

Useful additional holdout evidence, if convenient later:

- changed Minecraft UI scale or capture resolution if the demo may use it;
- a quiet/idle negative interval with the HUD unchanged;
- any sequence where the detector visibly flickers despite an unchanged HUD; and
- a clean dawn/dusk view with the sky continuously visible, only if time-of-day classification becomes demo-critical.

A separate owner decision is required only before expanding to raw-frame provider vision, a Minecraft mod/plugin/telemetry adapter, a new paid dependency/service, or a broader promised support surface such as texture packs and modded HUD accuracy.

## Completion Gate

This execution plan is complete only when:

- capture-source connection, Minecraft visibility, stable observation, event inference, and situation projection are independently visible and testable;
- Recordings A and B pass the accepted calibration/holdout gates for every fact promoted beyond `likely`;
- at least one real OBS and one real screen-picker path produce stable supported facts;
- brief detector misses no longer erase a confirmed HUD state;
- pause/death/respawn correctly gate the state timeline;
- supported temporal events reach typed AI context while unsupported causes remain unknown;
- Role 3 still rejects unsupported quest claims;
- privacy, latency, and raw-frame-release evidence is recorded; and
- `npm run check` and the affected producer/consumer integration tests pass.
