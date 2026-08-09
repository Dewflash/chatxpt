# Role 1 change fragment

- Surfaced the judged MVP generator decision in Studio: no external model provider, credential-free algorithmic candidates, deterministic validation/replacement, and safe-library fallback.
- Expanded the demo Studio game model from three loose presets into explicit game categories, current game text, and category-specific phase labels.
- Strengthened the no-credential sidequest fallback with genre-aware quest patterns for racing, strategy, platformer, tactical, MOBA, battle royale, arena, and unknown game streams.
- Added a Studio style-direction note for the final CSS pass, recommending a Broadcast control room direction over generic AI-dashboard visuals.

Verification:

- `npm run test -- src/lib/mock-engine.test.ts`
- `npm run check`
- `curl -I http://localhost:3000/`
- `curl -I "http://localhost:3000/overlay?obs=1"`
- `curl -I http://localhost:3000/viewer.html`
- `curl -s -X POST http://localhost:3000/api/sidequests ...` with a Mario Kart request returned three racing-specific fallback quests.
