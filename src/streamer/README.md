# Streamer public entrypoint

Role 4 owns the Studio and compact Twitch configuration modules exported here. They consume `StreamerViewModel` and emit canonical streamer commands without implementing backend, permission, or quest-engine rules.

Role 1 created this additive boundary under the recorded integration override. No visual, component, navigation, accessibility, or interaction decision is made by this scaffold.

## Phase 2 setup shell

`StudioSetupShell` is the first Role 4-owned Studio module. It renders:

- a guided first-time or returning-streamer setup journey;
- the authoritative `StreamerViewModel.services` list without calculating an overall readiness score;
- read-only profile groups for game, streamer style, quest intensity, safety, and accessibility;
- gameplay capability, signal status, confidence, method, source, and evidence class;
- explicit fixture/diagnostic, reconnecting, loading, and missing-snapshot states.

The current merged contract does not yet provide an accepted setup-command result or overall readiness view. The shell therefore keeps connection, permission, profile-save, and session controls unavailable. Role 1 can mount the render-only module now and later supply validated gateway state without Role 4 importing integration internals.

## Phase 3 status surface

`StudioStatusSurface` is an additive Role 4-owned status module beside the accepted setup shell. It consumes `StreamerViewModel`, shows per-service integration health, gameplay/audience evidence status, quest state, and emergency pause without deriving an overall ready/demo verdict or creating backend authority.

## Finalist memory and live-control pass

Issue [#140](https://github.com/Dewflash/chatxpt/issues/140) adds three Role 4-owned public modules without changing Role 1 routes or contracts:

- `StudioManagementSurface` is the full streamer workspace for supported saved defaults, explicit session-override provenance, per-layer health/recovery, three-option quest review, manual progress, terminal controls, and emergency pause.
- `TwitchConfigSurface` keeps infrequent channel/Extension setup compact and sends detailed management back to Studio.
- `TwitchLiveConfigSurface` keeps stream-time status, proposed/active quest state, allowed actions, emergency pause, and a quick-intensity boundary in one responsive column.

The modules emit only canonical commands created by the exported Role 4 command builders. The current `streamer.profile-settings` contract can persist numeric experience, voting, and reward settings. Game, restriction, preferred/forbidden quest-type, and accessibility edits remain visibly read-only because their mutation fields are not public yet. Session intensity shows its saved source and remains disabled until Role 1 publishes a session-override view, patch, and clear command. Role 4 does not use browser storage as a substitute.

All health and generation labels are provider-neutral. No API key, raw model/provider selector, viewer-personality profile, or viewer account requirement is exposed.
