## Summary

- Restored the persistent left-ribbon identity as `ChatXPT` with `Streamer Studio` directly beneath it.
- Replaced stale page-specific hero copy with the accepted shared page header: `ChatXPT`, then the current page name.
- Kept Account, Twitch, and Game Capture status together on the right side of the header.
- Added the real divider below the header and kept page section tabs beneath that divider.
- Removed the obsolete hero-copy data and analytics-only hero exceptions so every Studio page uses the same shell.

## Evidence

- `npm run test -- src/streamer/studio-product-pages.test.tsx` — 39 tests passed.
- `npm run check` — 117 test files / 940 tests passed, including lint, TypeScript, role boundaries, hygiene/evidence/runbook checks, production build, and client-secret scans.
- Local HTTPS browser inspection at 1280 px confirmed the ribbon identity, shared header hierarchy, right-side status block, solid 1 px divider, section controls below the divider, zero horizontal overflow, and no console errors.

## Boundary

- The rendered check used the real local application with its current local fallback account state.
- No external Twitch-live or Game Capture connection was claimed by this shell-only correction.
