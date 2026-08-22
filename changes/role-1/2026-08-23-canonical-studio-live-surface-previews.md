# Canonical Studio previews for public live surfaces

- **Type:** Fixed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Studio Home now shows only Twitch Extension and OBS Overlay tabs in its public live-surface section and mounts the real Role 5 components rather than hand-built approximations. Both previews are derived from the current authoritative streamer revision through the canonical public projector.
- **Integration impact:** The app composition layer supplies public surface nodes to Role 4 without creating a Role 4-to-Role 5 private import. The Twitch preview is anonymous and read-only in Studio; it excludes personal receipt, points, identity, and unrevealed open-vote tallies. Twitch's actual projection now also receives the same privacy-safe Live Director public context already used by OBS.
- **Verification:** Focused Studio preview and Studio product-page coverage passes at 2 files / 43 tests; lint and `git diff --check` pass. A full repository check passed through this surface implementation and production build before a concurrent unrelated Minecraft extraction edit introduced the current `src/extraction/multi-game-vision.ts:425` TypeScript failure; no real-platform claim is inferred from either run.
- **Reality status:** Automated rendering and same-revision contract evidence are complete. Owner-operated comparison against the installed Twitch Extension and OBS Browser Source remains required real-platform evidence.
