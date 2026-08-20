# Minecraft-aware deterministic fallback

- **Owner:** Role 3
- **Summary:** Deterministic fallback assembly now uses only safe Minecraft-aware definitions when Minecraft is selected or evidenced. It returns typed `fallback-exhausted` instead of appending generic filler when three distinct valid Minecraft options cannot be assembled; non-Minecraft contexts retain the existing library.
- **Evidence:** Focused exhaustion and exactly-three tests pass, and the full `npm run check` passes with 717 tests. Real gameplay/provider quality evidence remains open.
