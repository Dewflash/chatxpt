## Role 1 - private viewer and fallback seams

- Added private viewer participation receipt contracts for accepted choice, source mode, session-scoped points, and reconnect expiry without adding those fields to shared viewer broadcasts.
- Added hosted Quest Board room-access/share results that resolve room codes, grant authorised viewer reads, and provide direct/share/optional QR payloads without requiring QR or account creation.
- Added bounded Twitch-chat fallback copy, delivery, and vote-acknowledgement contracts that never claim counted/duplicate/rejected/late acknowledgement unless a delivered Twitch message is recorded.
- Added a Role 1-owned Twitch outbound delivery adapter seam with injected sender support, credential-free unavailable reporting, and fixed-window rate limiting.
- Wired memory and Supabase persistence runtimes to expose the new private receipt and hosted-board access seams.
- Added diagnostic API mounts for private receipt recovery, hosted-board access/share data, and Twitch-chat fallback presentation.
- Bound private receipt recovery to server-derived principal voter keys instead of caller-supplied voter keys, added cross-principal isolation coverage, preserved duplicate acknowledgement accepted choices, and restored accumulated session-scoped points across completed cycles.
- Verified two-viewer private recovery, cross-surface duplicate vote recovery, hosted access grants, route-level access, chat acknowledgement overclaim protection, outbound unavailable/success/rate-limited delivery, and multi-cycle point recovery with focused integration tests and `npm run check`.
