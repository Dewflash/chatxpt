## Role 1 - OBS capture lifecycle policy

- Accepted D-057 for OBS Virtual Camera setup readiness and capture-session lifecycle.
- Added a Role 1 OBS capture setup resolver that maps browser permission, source selection, raw-game confirmation, overlay-exclusion confirmation, and last-frame freshness into setup readiness.
- Preserved the existing ephemeral `FrameSource` boundary and documented that raw frames, device IDs, and source labels are not persisted as product data.
- Added focused integration coverage for permission, source, recursion, missing-frame, stale-frame, ended-session, undersized-frame, and ready states.
