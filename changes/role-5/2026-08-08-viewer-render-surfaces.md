# Role 5 viewer render surfaces

- Added Role 5-owned render modules for the Twitch Extension viewer panel, hosted Quest Board, chat fallback instructions, and read-only OBS overlay.
- The modules consume the public design system and canonical viewer/overlay view models, retain degraded snapshots while disabling commands, keep chat fallback as presentation only, and keep the inactive OBS overlay visually quiet.
- Tightened the reviewed interaction contract: controls are disabled unless the matching authorised handler exists, influential tallies stay hidden until personal acknowledgement or later authoritative state, normal viewer UI uses viewer-facing connection copy instead of revision/raw status labels, and the whole card is the selection target.
- Added committed fixture-only server-render tests for compact voting, hosted room copy, handler-gated controls, tally reveal rules, reconnect disabling, chat option mapping, inactive overlay, and active overlay.
- Captured fixture-only visual evidence for compact Twitch, hosted desktop/mobile, and active/inactive overlay viewports under `docs/evidence/artifacts/` and recorded it in `docs/evidence/manifest.json`.

No real Twitch Extension, hosted-board access, realtime vote dispatch, Supabase, or OBS Browser Source run is claimed by this change.
