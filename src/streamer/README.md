# Streamer Public Entrypoint

Role 4 owns the Studio and compact Twitch configuration modules exported here. They consume `StreamerViewModel` and emit canonical streamer commands without implementing backend, permission, or quest-engine rules.

Role 1 owns the thin route/session wiring; Role 4 owns the streamer-facing surfaces and shared visual-system choices. This module must not derive readiness, winners, health truth, profile persistence, or provider authority from local UI state.

## Current Product Surfaces

- `StudioProductHome` and the dedicated Studio product pages provide the current `/studio` management experience for readiness, Game Capture, Live Analytics, Live Quests, Profile & Defaults, Stream Settings, and Test Lab.
- `TwitchConfigSurface` keeps infrequent channel/Extension setup compact and sends detailed management back to Studio.
- `TwitchLiveConfigSurface` keeps stream-time status, proposed/active quest state, allowed actions, emergency pause, and a quick-intensity boundary in one responsive column.
- `StudioStatusSurface`, `StudioSetupShell`, and `StudioManagementSurface` are retained only while existing routes and tests finish migrating; do not document them as the final demo entry unless the route explicitly mounts them.

## State And Commands

The modules emit only canonical commands created by the exported Role 4 command builders. Profile settings, session overrides, quest controls, emergency controls, Twitch/Game Capture setup, and OBS URL generation must pass through Role 1's browser-safe gateway and authoritative orchestrator.

Readiness and health displays must point at the same projected services, gameplay, audience, generation, session, and quest-cycle state used by the viewer and overlay surfaces. Component-local loading or optimistic UI state can only explain pending UI feedback; it cannot become product truth.

Role 4 does not use browser storage as a substitute for authoritative settings. Browser storage is allowed only for non-authoritative UI convenience such as local panel preference.

All health and generation labels are provider-neutral. No API key, operational provider selector, viewer-personality profile, or viewer account requirement is exposed. Studio may show a display-only AI model selector: the approved server model is selected, future model options are disabled as `Coming soon`, and runtime switching remains server controlled.

Owner decision D-061 permits future automatic learning only for soft streamer preferences, with visible learned provenance, explanation, and reset. The current public view/command contracts do not expose that provenance or reset authority, so these modules do not infer or store learned values. Identity, selected game, safety, accessibility, and forbidden quest types remain explicit streamer-owned settings.
