# Role 1 hosted-board access seam

- Added `HostedBoardAccessService` as the UI-X08 server-side seam for room-code lookup, viewer realtime grant creation, direct viewer path, share copy, and QR payload data.
- Wired memory and Supabase hosted-board session directories over the existing session room-code records.
- Added integration coverage for valid access grants, invalid/missing/inactive room states, and Supabase row parsing.

Verification is fixture/static adapter evidence only. This does not claim a rendered hosted Quest Board, live Supabase cloud grants, Twitch identity, or real multi-viewer evidence.
