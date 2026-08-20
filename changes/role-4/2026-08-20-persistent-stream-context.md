# Persistent private stream context surface

- Added a Studio-authenticated read-only persistent stream context surface for `/studio/live-director`, suitable for a private browser pop-out or OBS Custom Dock.
- Kept Twitch Live Config and full Studio as the command/control surfaces; the persistent context surface intentionally omits approve/reject/skip/cancel/progress/cue action controls.
- The new surface shows session/evidence revision, OBS capture health, gameplay/audience known-vs-unknown counts, sidequest generation state, realtime health, Director Cue state/reason, source-separated private context, and current sidequest/progress status.
- Updated Live Director plan language to distinguish private read-only stream context from public OBS Browser Source output and from Live Config controls.

Evidence: fixture/component tests only. Real OBS Custom Dock evidence remains required before a live dock-readiness claim.
