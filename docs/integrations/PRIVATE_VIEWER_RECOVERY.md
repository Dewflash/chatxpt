# Private Viewer Recovery Policy

D-061 resolves D1-06D for the Role 1 participation service.

## Accepted Policy

Viewer vote acknowledgement, accepted choice, vote source, session points, and reconnect expiry are private per-viewer state. They are exposed only through an authorised session-scoped receipt path for the matching authenticated viewer or anonymous reconnect token.

Shared viewer snapshots, tally broadcasts, overlay state, and session history remain sanitised. They may show the current cycle, candidate options, shared vote tallies, progress, terminal result, and aggregate rewards, but must not include another viewer's identifier, accepted choice, source mode, receipt, reconnect token, or personal points.

Duplicate viewer votes are idempotent by voter key and preserve the first accepted choice. A duplicate from another surface must not increment tallies or replace the receipt. Stale, late, expired, or unauthorised viewer commands fail closed and return typed errors/current revision through the Role 1 command gateway.

Reconnect restores only permitted personal state while the viewer grant remains valid. Expired grants must return an expired/forbidden result and require the viewer to re-enter through an allowed Twitch Extension, hosted-board, or chat fallback path.

## Required Evidence

- Private receipt route returns accepted choice, source mode, session points, and bounded reconnect expiry only to the matching principal.
- Shared viewer snapshots and history omit viewer identifiers, accepted choices, and personal points.
- Two-viewer isolation proves both viewers see the same shared tally while each sees only their own receipt.
- Duplicate vote handling preserves the first accepted choice and does not increment tallies.
- Session points accumulate from terminal reward events without leaking through shared read models.
- Anonymous-token reconnect is supported through the same private receipt contract.
- Expired reconnect grants fail closed.

## Limitations

This is fixture and local integration evidence. It does not claim live Twitch Extension, hosted-board, Twitch-chat, Supabase cloud, or production browser evidence. Those remain part of the real workflow evidence gate and the later Role 5 UI consumption pass.
