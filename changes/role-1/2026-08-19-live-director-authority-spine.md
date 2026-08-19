# Canonical Live Director authority spine

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** #150 / pending
- **Summary:** ChatXPT can now represent declared intent, source-separated private Live Context, a privacy-safe audience pointer, an expiring Director Cue, approved public viewer context, and a non-causal intervention record behind one canonical authority.
- **Integration impact:** Adds optional `LiveDirectorState` to authoritative state and streamer/viewer projection inputs, four permission-scoped command types, additive fixtures, and a fail-closed default-engine compatibility boundary for the paired Role 3 lifecycle pass. OBS receives no Live Director field.
- **Verification:** `npm.cmd run test:contracts` (30 passed); `npm.cmd run test:orchestrator` (20 passed); integration suite (22 files/131 tests passed); `npm.cmd run check` (79 files/563 tests plus production build passed); `git diff --check`.
- **Reality status:** Fixture-only contract, privacy, revision, expiry, permission, duplicate, and stale-command evidence (`E-20260819-R1-001`). No real Twitch, OBS, Supabase Cloud, Vercel, provider, or product-value run is claimed.
