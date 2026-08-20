# Minecraft-aware Implementation Plan

**Status:** Fixture implementation expanded; real Minecraft evidence pending
**Decision authority:** D-086
**Primary responsibility:** Role 2 extraction and AI context
**Integration responsibilities:** Role 1 gameplay ingress/runtime, Role 3 deterministic validation, Role 4/5 truthful display if surfaced
**Primary demo target:** Vanilla Minecraft Java Survival, default HUD

## Goal

Upgrade ChatXPT from layout-level Minecraft awareness to an evidence-gated Minecraft-aware engine that can:

1. Detect Minecraft-like HUD and activity cues from pixels without depending only on fixed vanilla regions.
2. Represent Minecraft game facts, streamer intent, and active ChatXPT quest state separately.
3. Send AI a typed known/unknown fact context instead of vague prose, with a general game-state layer plus selected-game specialization.
4. Keep weak and strong AI models inside the same deterministic validation and fallback boundary.
5. Demonstrate modded/altered HUD graceful degradation without claiming unsupported accuracy.

This plan does not approve raw frames or screenshots being sent to a provider. That remains a separate owner decision.

## Current Baseline

Already built:

- `src/extraction/game-profiles.ts` has generic, Brawl Stars, and Minecraft profile registration.
- `src/extraction/minecraft-hud.ts` fingerprints fixed vanilla HUD anchor regions.
- `src/extraction/multi-game-vision.ts` runs bounded pixel analysis with temporal confirmation.
- `src/extraction/game-vision-snapshot.ts` projects analysis into canonical flat `GameplaySnapshot` signals.
- `src/ai/openai-candidate-strategy.ts` sends normalized gameplay/audience/profile/recent-history context and requires strict exactly-three JSON output.
- `src/quest-engine/validation.ts` rejects unsupported evidence, unknown-dependent facts, unsafe quests, duplicates, stale evidence, and lifecycle conflicts.

Not good enough yet:

- Minecraft exact crafting distinction, exact mining/building/combat activity, exact hostile mob type, exact biome, and exact damage cause are not modeled deeply. Broad fixture-level scene hints now exist and remain evidence-gated before live claims.
- Minecraft detection relies too heavily on configured fixed regions.
- AI must receive both a cross-game known/unknown game-state object and, when Minecraft is selected, a clear Minecraft-specific known/unknown object.
- Real vanilla or modded Minecraft OBS evidence is not recorded.

## Definition of Done

R2-010 is complete when:

- A Role 2 internal Minecraft state schema exists and separates `gameFacts`, `streamerIntent`, and `activeChatXptQuest`.
- The detector can search for Minecraft-like hearts, hunger, hotbar, and menu/sleep cues with UI-scale tolerance rather than only checking fixed regions.
- Health, hunger, armor, hotbar, menu/sleep, activity, damage, likely damage cause, hostile presence, biome/environment, supported facts, and unknown facts are represented with confidence, freshness, method, and source signal ids.
- The canonical `GameplaySnapshot` remains game-neutral and flat unless a deliberate shared-contract change is required.
- The provider context builds a typed generic `gameState` block for every game, then adds a typed Minecraft block from canonical/Role 2 facts when Minecraft is selected.
- Algorithmic and provider paths both consume the same bounded context.
- Role 3 tests prove unsupported Minecraft facts cannot justify a candidate.
- Real evidence is recorded only after implementation passes fixture/component tests and a privacy-reviewed Minecraft run exists.

Current implementation status on 2026-08-20:

- Implemented: Role 2 Minecraft fact schema, reusable cross-game `generic-game-state-v1` schema and mapper, pixel-aware lower-HUD search for Minecraft-like hearts/hunger/armor/hotbar, conservative selected-hotbar-category detection, conservative visual menu/sleep detection, conservative runtime facts for recent health drops, low-health danger, sleep/inventory/recovery/exploration activity, flat canonical Minecraft fact signals, typed AI context with generic `gameState` plus Minecraft specialization when selected, active ChatXPT quest context from Role 1 candidate composition, and Role 3 dependency validation for Minecraft-specific claims.
- Covered by fixture tests: generic game-state schema invariants, Minecraft and Brawl-shaped generic fact mapping, stale/unsupported fact handling, Minecraft schema invariants, shifted Minecraft-like HUD detection, armor and selected-hotbar-category projection when visual evidence is distinct, menu/sleep visual detection and arbitrary-noise rejection, temporal projection into `GameplaySnapshot`, generic game-state AI context for Minecraft and Brawl-shaped calibrated facts, Minecraft-specific known/unknown model context separation, active ChatXPT quest transport, recent-damage-vs-damage-cause separation, and rejection of unsupported Minecraft sleep/hostile-mob/fall-damage-cause claims.
- Still evidence-gated: exact real-world health/hunger/armor accuracy, selected item category accuracy beyond conservative visual classes, menu/sleep OCR or text reading, exact inventory-vs-crafting distinction, specific mining/building/combat classification, exact damage cause, hostile-mob type, biome/environment, and any live or modded Minecraft accuracy claim.

## Architecture

Keep three layers separate:

```text
Ephemeral OBS/browser frame
  -> Role 2 private pixel-aware Minecraft analysis
  -> Role 2 private selected-game facts
  -> Canonical flat GameplaySnapshot signals
  -> Role 2 AI context builder assembles generic gameState plus selected-game known/unknown facts
  -> Role 3 deterministic validation/replacement
  -> Role 1 persistence/broadcast/view models
```

Important constraint:

- `SignalValue` currently accepts only `string | number | boolean`.
- Therefore, do not push a nested Minecraft object directly into `GameplaySnapshot` in the first pass.
- Instead, publish multiple flat signals such as `minecraft-health-hearts`, `minecraft-hunger-shanks`, `minecraft-menu-state`, and `minecraft-activity`, then assemble a typed nested AI context from those signals. The nested AI context now has two layers: generic `gameState.facts` for cross-game reasoning, and `minecraft.gameFacts` when Minecraft is the selected calibrated game.

Only propose a core contract change if flat signals block required product behavior.

## Phase 0: Deconflict and Branch Hygiene

**Outcome:** Work starts from current `origin/main` without colliding with Live Director or gameplay-ingress branches.

Work:

- Inspect active branches touching `src/extraction/`, `src/ai/`, `src/core/contracts/signals.ts`, `src/quest-engine/validation.ts`, `src/app/server/gameplay-ingress.ts`, and `docs/evidence/manifest.json`.
- Keep D-086 changes on a short branch, preferably `role-2/minecraft-aware-schema`.
- Preserve current `codex/minecraft-schema-decisions` documentation changes or merge/rebase them before code work.

Acceptance:

- `git status` is clean except intended changes.
- Any overlapping branch intent is recorded in the PR or handoff.

## Phase 1: Minecraft State Schema

**Outcome:** Role 2 has a typed private schema for Minecraft facts before adding more detectors.

Recommended files:

- Add `src/extraction/minecraft-state.ts`
- Add `src/extraction/minecraft-state.test.ts`
- Export public Role 2 types from `src/extraction/index.ts` only if consumers need them.

Schema shape:

```ts
type MinecraftFactStatus = "known" | "unknown" | "stale" | "conflicting" | "unsupported";

interface MinecraftFact<T> {
  status: MinecraftFactStatus;
  value: T | null;
  confidence: number;
  observedAt: number;
  expiresAt: number;
  method: string;
  sourceSignalIds: string[];
  reason?: string;
}

interface MinecraftGameFacts {
  edition: MinecraftFact<"java">;
  mode: MinecraftFact<"survival" | "creative" | "hardcore">;
  hudLayout: MinecraftFact<"vanilla-like" | "minecraft-like" | "modified" | "hidden">;
  healthHearts: MinecraftFact<number>;
  hungerShanks: MinecraftFact<number>;
  armorPoints: MinecraftFact<number>;
  hotbarVisible: MinecraftFact<boolean>;
  selectedHotbarCategory: MinecraftFact<"tool" | "weapon" | "food" | "block" | "empty">;
  menuState: MinecraftFact<"inventory" | "crafting" | "sleeping" | "pause" | "none">;
  activity: MinecraftFact<"exploring" | "mining" | "building" | "combat" | "crafting" | "inventory" | "sleeping" | "recovering">;
  danger: MinecraftFact<"none" | "nearby-hostile" | "taking-damage" | "low-health" | "environmental-risk">;
  recentDamage: MinecraftFact<boolean>;
  likelyDamageCause: MinecraftFact<"mob" | "fall" | "fire" | "drowning" | "lava">;
  visibleHostile: MinecraftFact<"skeleton" | "zombie" | "creeper" | "spider" | "unknown-hostile">;
  biomeOrEnvironment: MinecraftFact<string>;
}

interface MinecraftIntentContext {
  streamerGoal: string | null;
}

interface MinecraftAwareContext {
  gameId: "minecraft";
  gameFacts: MinecraftGameFacts;
  streamerIntent: MinecraftIntentContext;
  activeChatXptQuest: string | null;
  supportedFacts: string[];
  unknownFacts: string[];
}
```

Implementation notes:

- Start with `edition: java` only when selected game identity is trusted.
- Start with `mode: survival` only from streamer config or demo setup, not visual guessing.
- Represent all unsupported fields explicitly as `unknown` or `unsupported`.
- Add helpers:
  - `knownFact`
  - `unknownFact`
  - `unsupportedFact`
  - `staleFact`
  - `isKnownFact`
  - `minecraftUnknownFacts`

Tests:

- Parses a complete known vanilla survival state.
- Rejects invalid confidence, expired facts, unknown facts with non-null values, and duplicate source ids.
- Marks unsupported facts explicitly instead of omitting them.
- Keeps game facts, streamer intent, and active ChatXPT quest separate.

## Phase 2: Pixel-aware HUD Search

**Outcome:** Detector finds Minecraft-like HUD elements by searching likely screen areas, with relative layout as a confidence boost.

Recommended files:

- Add or extend `src/extraction/minecraft-hud.ts`
- Add focused tests in `src/extraction/minecraft-hud.test.ts` or `multi-game-vision.test.ts`

Work:

- Replace fixed-region-only logic with a two-stage detector:
  1. Search lower third / lower half for repeated heart-like and hunger-like icon bands.
  2. Score relative layout of hearts, hunger, hotbar, crosshair, and bottom-HUD structure.
- Keep existing fixed regions as hints for vanilla default HUD, not the sole detector.
- Add normalized candidate bounding boxes privately:
  - `minecraft-health-band`
  - `minecraft-hunger-band`
  - `minecraft-armor-band`
  - `minecraft-hotbar-band`
  - `minecraft-crosshair`
- Use pattern features:
  - red/warm pixel ratio
  - repeated icon cadence
  - edge density
  - row-band continuity
  - spacing consistency
  - relative lower-screen location
- Add statuses:
  - `vanilla-like`
  - `minecraft-like`
  - `modified-or-unknown`
  - `hud-hidden`
  - `insufficient-resolution`

Acceptance:

- Vanilla fixture still passes.
- Shifted/scaled HUD fixture passes as `minecraft-like`.
- Hidden HUD fixture downgrades to universal/unknown.
- Arbitrary noisy pixels do not pass as Minecraft.
- Modded-like heart/hunger colors pass only if visual pattern confidence is high.
- Heavily altered texture pack fixture becomes `modified-or-unknown`.

## Phase 3: Health, Hunger, Armor, and Hotbar Facts

**Outcome:** Specific HUD values become known only when evidence is strong enough.

Recommended file:

- Add `src/extraction/minecraft-hud-values.ts`

Work:

- Count approximate hearts from the detected health band.
- Count approximate hunger shanks from the detected hunger band.
- Detect armor band only if visual structure is clear.
- Detect hotbar visible and selected-slot position from repeated slot boundaries.
- Detect selected item category only conservatively:
  - `food` when color/shape evidence is reliable enough.
  - `weapon/tool/block/empty` only when a simple template or high-confidence visual rule exists.
  - otherwise `unknown`.

Acceptance:

- Known health/hunger require temporal confirmation across at least two recent frames.
- One-frame changes become `unknown` or `candidate-unconfirmed`.
- Health/hunger are never emitted when HUD is hidden or modified beyond recognition.
- Hotbar visible can be known even when selected item category is unknown.

Important:

- Do not claim exact hearts/shanks in the demo until at least one real OBS run validates the thresholds.
- Before evidence, tests prove component behavior only.

## Phase 4: Menu, Sleep, Inventory, Crafting, and Activity Classification

**Outcome:** Minecraft activity state is more useful than generic active/quiet.

Recommended files:

- Add `src/extraction/minecraft-activity.ts`
- Add `src/extraction/minecraft-activity.test.ts`

Signals:

- `minecraft-menu-state`
- `minecraft-activity`
- `minecraft-danger`
- `minecraft-recent-damage`
- `minecraft-likely-damage-cause`
- `minecraft-visible-hostile`
- `minecraft-biome-environment`

Detection rules:

- Inventory/crafting/menu:
  - large centered UI panel, item-grid structure, or pause/menu-like overlay.
- Sleeping:
  - dark sleep overlay plus lower-screen controls can be known from visual structure.
  - bed/sleep text OCR remains unsupported unless added separately.
  - otherwise only `unknown`.
- Mining:
  - repeated local motion near crosshair plus hotbar/tool evidence or block-break visual cadence.
- Building:
  - repeated local change near crosshair plus selected block/hotbar evidence.
- Combat:
  - recent health drop plus hostile/projectile/attack-like visual evidence.
- Exploring:
  - coherent movement without combat/mining/building evidence.
- Recovering:
  - low health or recent damage plus reduced motion or food/consumption evidence.

Damage cause policy:

- `mob`: health drop plus visible hostile/projectile/combat cue.
- `fall`: health drop plus recent rapid vertical/global motion and no hostile/fire/lava evidence.
- `fire`/`lava`/`drowning`: only if strong visual cue exists.
- otherwise `unknown`.

Acceptance:

- Fall damage and skeleton damage do not collapse to the same state unless evidence is insufficient.
- If evidence is insufficient, `recentDamage` may be known while `likelyDamageCause` remains unknown.
- No psychological inference such as panic, fear, or intent is emitted from pixels alone.

## Phase 5: Canonical Signal Projection

**Outcome:** Role 2 emits flat game-neutral snapshots that preserve the richer Minecraft facts.

Recommended file:

- Extend `src/extraction/game-vision-snapshot.ts`

Flat signal names:

- `minecraft-hud-layout`
- `minecraft-health-hearts`
- `minecraft-hunger-shanks`
- `minecraft-armor-points`
- `minecraft-hotbar-visible`
- `minecraft-selected-hotbar-category`
- `minecraft-menu-state`
- `minecraft-activity`
- `minecraft-danger`
- `minecraft-recent-damage`
- `minecraft-likely-damage-cause`
- `minecraft-visible-hostile`
- `minecraft-biome-environment`

Capabilities:

- Add known signal kinds to `supportedSignals` only when the detector supports and proves them.
- Unknown or unsupported facts still appear as `unknown` signals when useful for AI/context transparency.
- Keep stale/freshness at current 3-second gameplay expiry unless real runs prove it too short.

Tests:

- A confirmed vanilla-like state projects known `minecraft-hud-layout`.
- Known health/hunger project only after temporal confirmation.
- Hidden/modded-unknown HUD projects `unknown` facts and does not advertise unsupported capabilities.
- Generic game snapshots contain no Minecraft signals.
- Frame timestamp and assessment timestamp mismatch still throws.

## Phase 6: AI Context Upgrade

**Outcome:** Weak and strong AI models receive a structured Minecraft-specific contract.

Recommended files:

- Extend `src/ai/openai-candidate-strategy.ts`
- Consider adding `src/ai/model-context.ts`
- Add `src/ai/model-context.test.ts`

Provider context should include:

```json
{
  "game": {
    "gameId": "minecraft",
    "gameName": "Minecraft Java Edition",
    "supportTier": "calibrated-hud",
    "supportedFacts": ["healthHearts", "activity"],
    "unknownFacts": ["likelyDamageCause", "visibleHostile"]
  },
  "minecraft": {
    "gameFacts": {
      "healthHearts": { "status": "known", "value": 7.5, "confidence": 0.84, "sourceSignalIds": ["minecraft-health-hearts"] },
      "likelyDamageCause": { "status": "unknown", "value": null, "reason": "insufficient-evidence" }
    },
    "streamerIntent": {
      "streamerGoal": "gather iron before night",
      "activeChatXptQuest": null
    }
  },
  "questRules": {
    "mustUseOnlyKnownFacts": true,
    "mustListSourceSignalIds": true,
    "fallbackWhenUnknown": true
  }
}
```

Instruction updates:

- Tell the model it may use Minecraft-specific wording only when the relevant fact is `known`.
- Tell it to avoid exact mob, biome, damage-cause, health, hunger, item, or objective claims when those fields are `unknown`.
- Require one lower-risk, one skill/tactical, and one audience/personality option.
- Keep exactly three candidates.

Tests:

- Provider request includes typed Minecraft block when game id is Minecraft.
- Provider request explicitly lists unknown facts.
- Raw chat, raw frames, usernames, Twitch IDs, and secrets are absent.
- Provider output citing `minecraft-likely-damage-cause` is rejected when that source id is unknown.
- Weak/disabled provider path still produces algorithmic candidates from the same known signal ids.

## Phase 7: Role 3 Validation Hardening

**Outcome:** Minecraft-specific candidate claims cannot bypass deterministic validation.

Recommended file:

- Extend `src/quest-engine/validation.ts`
- Add cases to `src/quest-engine/validation.test.ts` and `director-cue-conversion.test.ts`

Add fact dependency checks for:

- health/hearts
- hunger
- armor
- hotbar/item category
- inventory/crafting/menu/sleeping
- mining/building/combat/exploring
- damage cause
- mob type/hostile
- biome/environment

Examples:

- Reject "survive the next skeleton hit" unless visible hostile/mob evidence supports it.
- Reject "recover from fall damage" unless likely damage cause is known as fall.
- Accept "play safe while health is low" when `minecraft-health-hearts` is known low.
- Accept game-neutral alternatives when damage cause is unknown.

Acceptance:

- AI-provider provenance never bypasses these rules.
- Algorithmic candidates do not cite unsupported Minecraft facts.
- Deterministic fallback fills exactly three options when provider candidates are rejected.

## Phase 8: UI and Runtime Disclosure

**Outcome:** Users see stronger Minecraft awareness without overclaiming.

Role 1:

- Ensure gameplay ingress stores/serves current flat Minecraft signals and capability status.
- Keep raw frames out of persistence.
- Preserve evidence class and source in snapshots.

Role 4:

- Studio should show "Minecraft-aware" only with supported/unknown fact detail.
- Display "Unknown" or "Unsupported" for unproven facts.
- Show streamer goal and active ChatXPT quest separately from game facts.

Role 5 / OBS:

- Viewer and OBS should receive only quest-relevant public state.
- Do not expose raw detection internals, private reasoning, or unproven facts.

Acceptance:

- Studio can distinguish known health from unknown damage cause.
- OBS does not show private Live Director context or raw detector detail.
- Viewer quests do not include unsupported facts.

## Phase 9: Evidence Runs

**Outcome:** Real evidence exists only after detector and validation behavior are built.

Required evidence assets:

1. Vanilla Minecraft Java Survival, default HUD, quiet/exploring.
2. Vanilla mining/building.
3. Vanilla mob damage, preferably skeleton or zombie.
4. Vanilla fall damage.
5. Inventory/crafting/menu.
6. Sleep/bed UI if available.
7. One modded or altered HUD example.

Evidence rules:

- Keep raw clips local/private unless explicitly privacy-reviewed.
- Store only hashes, annotations, screenshots if privacy-reviewed, and result summaries in Git.
- Separate human annotations from production analyzer input.
- Record p50/p95 analyzer latency and resource observations.
- Add evidence entries to `docs/evidence/manifest.json` only after privacy review.

Acceptance:

- The vanilla run supports the final claim.
- The modded run demonstrates either partial detection or graceful degradation.
- Unknown facts remain unknown in the evidence report.

## Phase 10: Demo Script Impact

Primary demo line:

> ChatXPT reads Minecraft through a conservative game-state schema: it can detect supported HUD and activity signals, sends only known facts to the AI, and degrades unsupported or modded evidence to unknown.

What to show:

1. Vanilla HUD detected.
2. Health or hunger fact detected only if evidence supports it.
3. A Minecraft-specific quest generated from known facts.
4. A rejected or replaced quest when it cites unsupported damage/mob/biome evidence.
5. Modded/altered HUD downgrades to partial/unknown instead of hallucinating.

What not to claim:

- Do not claim universal Minecraft understanding.
- Do not claim exact mob type, biome, damage cause, health, hunger, or item category without recorded evidence.
- Do not claim raw-frame AI vision unless separately approved and implemented.

## Suggested Implementation Order

1. `minecraft-state.ts` schema and tests.
2. Pixel-aware HUD search and temporal confirmation.
3. Health/hunger/hotbar known/unknown projection.
4. Activity/menu/sleep/damage policy.
5. Flat canonical signal projection.
6. AI context builder and provider instruction updates.
7. Role 3 fact-dependency validation.
8. Runtime/UI disclosure checks.
9. Real evidence capture and manifest entries.
10. Demo script update.

## Checks

Run focused checks during implementation:

```bash
npm run test -- src/extraction/minecraft-state.test.ts
npm run test -- src/extraction/minecraft-hud.test.ts src/extraction/multi-game-vision.test.ts
npm run test -- src/extraction/game-vision-snapshot.test.ts
npm run test -- src/ai/openai-candidate-strategy.test.ts
npm run test -- src/quest-engine/validation.test.ts src/quest-engine/director-cue-conversion.test.ts
npm run test:integration
npm run check
```

For evidence-only updates:

```bash
npm run check:evidence
npm run test:evidence
```

## Open Follow-up Decisions

No decision is required before starting the schema and detector work.

Decisions required only if the team wants to expand beyond D-086:

1. Whether raw frames or screenshots may be sent to a vision-capable provider.
2. Whether to add a nested object-valued canonical `GameplaySnapshot` contract instead of flat signals.
3. Whether exact biome, mob type, or item classification must be implemented before finals rather than treated as future calibrated facts.
