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
