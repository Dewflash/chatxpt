# Streamer public entrypoint

Role 4 owns the Studio and compact Twitch configuration modules exported here. They consume `StreamerViewModel` and emit canonical streamer commands without implementing backend, permission, or quest-engine rules.

Role 1 created this additive boundary under the recorded integration override. No visual, component, navigation, accessibility, or interaction decision is made by this scaffold.

## Current surfaces

The public streamer entrypoint includes:

- `StudioManagementSurface` is the full streamer workspace for supported saved defaults, explicit session-override provenance, per-layer health/recovery, three-option quest review, manual progress, terminal controls, and emergency pause.
- `StudioProductPageSurface` provides the routed Home, Gameplay, Analytics, Live Quests, Profile & Defaults, Stream Settings, and Test Lab pages.
- `TwitchConfigSurface` keeps infrequent channel/Extension setup compact and sends detailed management back to Studio.
- `TwitchLiveConfigSurface` keeps stream-time status, proposed/active quest state, allowed actions, emergency pause, and a quick-intensity boundary in one responsive column.
- `StudioStatusSurface` and `PersistentStreamOverlaySurface` render read-only live state without becoming lifecycle or persistence authorities.

The modules emit only canonical commands created by the exported Role 4 command builders. `streamer.profile-settings` persists experience, voting, reward, default game, restrictions, preferred/forbidden quest types, accessibility settings, presets, and watchlists through the authoritative orchestrator. `streamer.session-override` applies and clears temporary intensity/creativity overrides without rewriting saved defaults. Connected-account persistence never relies on browser storage.

All health and generation labels are provider-neutral. No API key, raw model/provider selector, viewer-personality profile, or viewer account requirement is exposed.

## Persistent profile and local recovery

Studio now distinguishes three independent facts: whether Twitch identity is verified, whether live Twitch/gameplay inputs are fresh, and whether profile changes reached account storage. A verified Twitch account does not imply cloud persistence, and configured services do not imply fresh live input.

The normal server path loads the complete saved profile before creating a new session, so custom presets, safety boundaries, accessibility needs, and the saved default game survive stream boundaries. Twitch's current game is session context and cannot silently replace that saved default. Ordinary Profile & Defaults commands use `gameApplication: "saved-only"`; Gameplay Capture is the explicit owner of `"saved-and-current"` when the streamer changes the active capture profile.

The existing local login presentation selects one established device-local fallback profile. Its validated, size-bounded envelope stores only profile defaults and presets. It cannot authorize Twitch, server commands, OBS, the Extension, Supabase, or history. When local edits and an account profile diverge, Studio requires an explicit local-versus-account choice and never auto-merges safety or accessibility settings.

Owner decision D-061 permits future automatic learning only for soft streamer preferences, with visible learned provenance, explanation, and reset. The current public view/command contracts do not expose that provenance or reset authority, so these modules do not infer or store learned values. Identity, selected game, safety, accessibility, and forbidden quest types remain explicit streamer-owned settings.
