## Role 1 - OBS overlay snapshot seam

- Added a Role 1-owned OBS Browser Source snapshot reader that authorises a session-bound overlay read key before returning the canonical read-only `OverlayViewModel`.
- Added a bounded OBS overlay read-grant issuer that stores only an `overlay` access grant, returns the Browser Source snapshot URL, and rejects expired, overlong, invalid, or missing-session grants.
- Added a production-shaped `/api/overlay/grant` route guarded by a server-only `CHATXPT_OBS_OVERLAY_SETUP_KEY` so OBS Browser Source URLs are not minted from public session IDs alone.
- Added a thin `/api/overlay/snapshot` route that fails closed on invalid requests, misconfigured persistence, missing grants, stale revisions, or unavailable snapshots.
- Added URL-building and reconnect metadata for the eventual Role 5 overlay mount without adding command, lifecycle, vote, timer, or persistence authority to the UI.
- Verified grant issuance, overlay-only permission scope, server-only setup-key protection, authorised overlay-only reads, denied read keys, stale revision protection, and route validation with focused integration tests. This is fixture/runtime seam evidence only; real OBS Browser Source rendering and live overlay proof remain unverified.
