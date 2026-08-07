# Role 1 private viewer recovery seam

- Added a server-side `ViewerRecoveryReader` contract for UI-X10 so reconnecting viewer clients can recover their own accepted vote without reading shared broadcast state.
- Wired the memory fallback and Supabase service-role adapter to return accepted candidate, accepted time, participation source, and current session points for the supplied session-scoped voter key.
- Documented that personal reward persistence is not implemented yet, so the recovery seam returns `sessionPoints: 0` until the reward read model is wired.

Verification is fixture/static adapter evidence only. This does not claim live Supabase cloud execution, Twitch identity, hosted-board discovery, chat delivery, or real multi-viewer evidence.
