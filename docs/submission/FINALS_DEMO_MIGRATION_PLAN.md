# Finals Demo Migration Plan

**Purpose:** Make the canonical ChatXPT architecture the official finals story while keeping the current working OBS/local prototype available as a clearly labelled fallback until the canonical path proves demo parity.

**Decision posture:** Retire the legacy path from the main narrative before deleting or replacing it. The working local prototype remains a backup because the finals outcome depends on a reliable live demo.

## Current state

ChatXPT currently has two useful paths:

1. **Working local prototype path:** `/` plus `/overlay` show the complete local interaction loop: screen/window sampling, quest generation, viewer voting bridge, activation, result controls, and OBS-style output. This is reliable for the finals backup story but uses legacy mixed-responsibility files.
2. **Canonical production-shaped path:** Core contracts, Role 2 extraction/candidate ports, Role 3 deterministic engine, Role 1 orchestrator, authenticated viewer path, persistence/realtime adapters, and role-owned UI modules. This is the correct product architecture, but not every visible surface has replaced the legacy route.

The goal is not to throw away the working proof. The goal is to promote the canonical path wherever it can match or exceed the legacy path, and keep the legacy path as a rehearsed emergency fallback.

## Non-negotiable demo outcome

The primary finals flow must visibly complete:

1. Streamer opens ChatXPT.
2. Gameplay/screen or OBS signal is visible.
3. Exactly three safe sidequest options appear.
4. Viewer votes through the Extension-style or canonical viewer surface.
5. The winning quest reaches the OBS overlay.
6. Streamer completes/fails/cancels the quest.
7. Result, points/hype, or terminal state updates.

If the canonical path cannot complete all seven steps reliably after rehearsal, the final live demo uses the working prototype path and the slides explain the canonical architecture as the migration target already present in the codebase.

## Implementation phases

### Phase 1 - Label and protect the fallback

**Goal:** Make it impossible to confuse the old path with the final architecture, while preserving it for finals safety.

Work:

- Keep `/` and `/overlay` working until the canonical flow passes demo parity.
- Add or preserve visible copy in docs/runbooks calling this path `local prototype`, `diagnostic`, or `fallback`.
- Ensure the backup video can be recorded from this path if the canonical path fails.
- Do not delete `src/components/` or `src/lib/` legacy files before finals.

Acceptance:

- A teammate can launch the fallback path from a clean runbook.
- The fallback path completes the seven-step demo outcome.
- Slides and narration do not describe the fallback path as the full production architecture.

### Phase 2 - Define canonical parity

**Goal:** Decide the exact standard the new path must meet before it becomes the official live demo.

Canonical parity requires:

- One streamer-facing surface consumes `StreamerViewModel` or an accepted bridge to it.
- Viewer voting reaches the Role 1 command/orchestrator path or an explicitly accepted bridge.
- The overlay consumes authoritative or accepted bridge state rather than a client-owned winner.
- Role 2 candidate generation and Role 3 validation are either wired live or clearly separated as component-tested architecture.
- Every unavailable live dependency has an honest state: local, fixture, diagnostic, unavailable, or unknown.

Acceptance:

- The team can point to the exact route combination used for finals.
- The route combination has a script and fallback script.
- No presenter has to improvise whether a state is real, diagnostic, or future.

### Phase 3 - Promote the safest canonical surfaces

**Goal:** Use canonical pieces in the live demo where they are stable without forcing a risky full migration.

Recommended promotion order:

1. Use the canonical or authenticated viewer route if it reliably receives and submits votes.
2. Use canonical contracts/fixture harness in the technical explanation, not as the main product demo.
3. Keep the working overlay route if it is the most reliable OBS output.
4. Keep the local control room as the streamer cockpit unless the Role 4 canonical Studio can generate, review, vote, activate, and resolve quests end to end.

Acceptance:

- The visible demo remains smooth.
- The architecture explanation is truthful: working loop first, canonical migration path second.
- Any hybrid seam is named as a bridge or fallback, not hidden.

### Phase 4 - Rehearse and choose the live route

**Goal:** Pick the route that will be used on 23 August 2026.

Run two rehearsals:

1. **Canonical attempt:** exercise the newest canonical/hybrid flow against the seven-step outcome.
2. **Fallback attempt:** exercise the existing working prototype path against the same outcome.

Record:

- route URLs used;
- whether OBS was actually open and rendering the overlay;
- whether the viewer vote was local, Twitch Extension Local Test, hosted board, or chat fallback;
- whether gameplay capture was real screen/window, OBS Virtual Camera, fixture, or unavailable;
- failure points and recovery time.

Decision rule:

- If the canonical/hybrid flow completes the outcome twice without manual repair, use it as primary.
- If not, use the working prototype as primary live demo and present the canonical path as production architecture/finals implementation direction.

Acceptance:

- The final presenter has one primary script and one emergency script.
- The backup video is recorded from the chosen primary path.
- The alternate path remains loaded or one click away during finals.

### Phase 5 - Post-finals retirement

**Goal:** After finals, finish the migration cleanly instead of keeping two overlapping systems forever.

Work:

- Replace legacy generation with Role 2 candidate provider plus Role 3 candidate assembly.
- Replace local votes/timers with Role 1 command receipts, tally, vote-close, and authoritative revisions.
- Replace legacy overlay transport with `OverlayViewModel`.
- Move retained streamer UI behaviour behind Role 4 public modules.
- Move retained viewer/overlay UI behaviour behind Role 5 public modules.
- Delete or quarantine `src/lib/` and `src/components/` legacy files only after route parity and tests pass.

Acceptance:

- `/` mounts the canonical Studio/product surface.
- `/overlay` mounts the canonical Role 5 overlay surface.
- Legacy fallback is either removed or moved to a clearly protected diagnostic route.
- `npm run check`, route tests, and a multi-surface rehearsal pass.

## Slide and narration guidance

Use this framing:

> “Our first prototype proved the live interaction loop: gameplay signal, three quests, viewer vote, and OBS overlay. For finals, we are retiring that old path from the product story and using the canonical architecture wherever it has reached demo parity. The fallback remains available only to protect the live presentation. The long-term product path is the platform-neutral Core, tiered game understanding, deterministic quest engine, and authoritative participation service.”

For the game-understanding slide:

> “We start with universal OBS visual signals because they work across games without requiring official APIs. Streamer-selected game/category settings shape quest wording today. Calibrated HUD adapters can improve specific game facts later, but only when evidence proves reliability; unsupported facts stay unknown.”

## Risks

- **Risk:** Full migration breaks the live demo.
  **Mitigation:** Do not remove the working prototype before finals; rehearse the fallback.

- **Risk:** Judges see two paths as confusion.
  **Mitigation:** Explain them as iteration: proven prototype loop, then canonical production architecture.

- **Risk:** Team overclaims live extraction or calibrated HUD reading.
  **Mitigation:** Use evidence labels and say `unknown` for unsupported facts.

- **Risk:** Presenter loses time switching routes.
  **Mitigation:** Keep primary, viewer, overlay, and fallback tabs open before presenting.

## Owner checklist before final submission

- [ ] Pick primary live route: canonical/hybrid or fallback prototype.
- [ ] Record backup video from that primary route.
- [ ] Keep fallback route rehearsed and loaded.
- [ ] Add one slide or speaker note explaining old proof versus new architecture.
- [ ] Add one slide or speaker note explaining universal visual signals versus calibrated game adapters.
- [ ] Decide whether the OBS game-state upgrade is only a roadmap/deck point for finals or an implementation target after finals.
- [ ] If the OBS game-state upgrade becomes implementation work, assign the primary pass to Role 2 extraction/intelligence and involve other roles only for shared contract, quest-rule, UI-disclosure, or submission changes.
- [ ] Verify `npm run check` on the final commit.
- [ ] Record evidence limitations in the submission notes or evidence manifest.
