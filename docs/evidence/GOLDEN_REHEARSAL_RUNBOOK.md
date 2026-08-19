# Golden Rehearsal Runbook

**Owner:** Role 1 (`Dewflash`)

This runbook is the exact rehearsal path for turning separately verified modules into judged evidence. It is not evidence by itself. A run counts only after the artifact is captured, privacy-reviewed, and recorded in `docs/evidence/manifest.json`.

## Evidence Rules

- Use real Twitch, OBS, browser, and gameplay resources only when they are actually connected in the run.
- Keep deterministic fixtures and memory-backed diagnostics visibly labelled; never present them as live extraction or live Twitch evidence.
- Record unknown gameplay or audience facts as `unknown` rather than filling gaps from expectation or commentary.
- Do not commit account names, unrestricted links, raw chat exports, viewer identifiers, screenshots with credentials, `.env.local`, or secrets.
- Every captured artifact must name its evidence class: `real`, `memory-backed`, `fixture-only`, `inspection-only`, or `unverified`.

## Required Resources

These resource IDs must match the evidence manifest.

| Resource ID | Purpose | Ready means |
| --- | --- | --- |
| `twitch-broadcaster` | Broadcast account, Twitch developer app, Extension Local/Hosted Test, and chat channel | The account is privately configured with 2FA and the test Extension can be activated without committing credentials. |
| `viewer-session-a` | First viewer/browser profile | It is isolated from the broadcaster and can vote without sharing cookies or identity state. |
| `viewer-session-b` | Second viewer/browser profile | It is isolated from the broadcaster and viewer A. |
| `obs-gameplay-machine` | OBS, game capture, Virtual Camera, and Browser Source overlay | OBS captures raw gameplay without recursively capturing ChatXPT overlay output. |
| `streamer-desktop-browser` | ChatXPT Studio and Twitch Live Config evidence | It can load the current build and record viewport/browser metadata. |
| `viewer-mobile-browser` | Twitch panel/mobile or hosted-board narrow evidence | It can load the viewer surface and record viewport/device metadata. |
| `demo-recording` | Final rehearsal recording custody | The recording is privacy-reviewed before upload to the private team drive. |

## Preflight

1. Start from the release candidate commit or the PR head being rehearsed.
2. Run `npm ci` on a clean clone when proving setup instructions.
3. Run `npm run check`.
4. Run `git diff --check`.
5. Confirm `.env.local` exists only locally and contains no values copied into committed files or screenshots.
6. Confirm the evidence manifest resource statuses reflect the real current setup. If a resource is not ready, record it as `owner-action-required` or `blocked`, not as ready.

## Memory-Backed Dry Run

Use this when real Twitch, OBS, Supabase, Vercel, or provider access is not ready. It proves production-shaped local behaviour only.

The repeatable Role 5 server-boundary rehearsal is `npm run smoke:role-5-memory` against a local production server. Supply only disposable test values for the named setup/Extension/EventSub environment variables in the process that starts the server and runner; never write those values to an artifact. The command exercises locally signed viewer identities, hosted anonymous grants, signed chat delivery, and overlay state, but its output remains `memory-backed` rather than real Twitch/OBS/cloud evidence.

1. Start the local app with the documented command for the current branch.
2. Open Studio or diagnostic harness in the streamer desktop browser.
3. Open two viewer clients, preferably one desktop/narrow and one separate profile.
4. Confirm the same session ID, quest-cycle ID, and revision are visible or inspectable across streamer, viewer, and overlay states.
5. Exercise exactly three quest options, one vote from each viewer, duplicate or late vote handling when available, winner display, active quest, progress, terminal result, and reconnect.
6. Capture artifacts only as `memory-backed` or `fixture-only`, depending on the actual inputs used.
7. Record limitations explicitly: no real Twitch chat, no real OBS frame, no cloud persistence, no provider trial, or whatever remains true.

## Real Twitch And OBS Run

Use this only when every involved resource is actually configured.

1. Start OBS with a raw gameplay scene and OBS Virtual Camera enabled.
2. Verify the ChatXPT overlay is a separate OBS Browser Source and is not part of the captured gameplay source.
3. Start or prepare the Twitch stream/test channel using the Role 1-controlled account.
4. Open ChatXPT Studio in the streamer desktop browser and confirm Twitch, capture, AI/intelligence, realtime/persistence, and session health are displayed separately.
5. Start the ChatXPT session from the authorised runtime path.
6. Provide real team-owned gameplay. If the game is Brawl Stars or another phone game, document how the phone screen reaches OBS before claiming live frame evidence.
7. Confirm Role 2 emits timestamped gameplay observations with confidence/provenance and honest `unknown` fields.
8. Send real Twitch chat/activity from allowlisted viewer sessions and confirm Role 2 audience intelligence only uses permitted, privacy-safe data.
9. Confirm Role 2 emits exactly three candidates and Role 3 validates exactly three options before they reach viewers.
10. Vote from viewer A and viewer B. Include a duplicate, invalid, or late vote only when the current build safely supports the case.
11. Confirm Studio, both viewers, persistence, and OBS overlay share the same authoritative session, quest cycle, revision, winner, progress, result, points, and hype state.
12. Stop or end the session through the authorised runtime path.
13. Capture artifacts as `real` only for the portions actually using real Twitch, OBS, gameplay, and cloud/local runtime services. Mixed runs must split claims or state limitations.

## Failure Matrix

Run the safest available version of each case before final evidence:

| Case | Expected proof |
| --- | --- |
| OBS/capture unavailable | Studio shows capture unavailable or permission-denied; Role 2 does not invent gameplay facts. |
| Unknown gameplay fact | Signals stay `unknown`; candidates avoid unsupported HUD-specific claims or are rejected by Role 3. |
| Provider timeout/malformed/unavailable | Credential-free algorithmic candidate path and deterministic fallback continue without raw provider payloads. |
| Duplicate command ID | Role 1 returns the existing accepted result or duplicate error without applying twice. |
| Duplicate viewer vote | Authoritative vote state is not double-counted; viewer gets a clear duplicate/accepted state. |
| Stale revision | Client refreshes or disables the stale command path without mutating local authority. |
| Realtime disconnect/reconnect | Latest safe snapshot is retained, commands disable until authority returns, and newer revision wins. |
| Emergency pause | New quest proposals are blocked until the emergency latch is cleared. |
| Cancel, skip, fail, success, expiry | Terminal state, rewards, cooldown, and history reflect Role 3/Role 1 authority. |

## Evidence Manifest Entry

After each captured run:

1. Add exactly one entry per distinct claim to `docs/evidence/manifest.json`.
2. Use an ID like `E-20260808-R1-002`.
3. Set `resourceIds` to the resources actually used.
4. Name the source branch, commit, and PR number if applicable.
5. Include the exact command or interaction, input kind, device/surface/viewport, artifact reference, reviewer, and limitations.
6. Run `npm run check:evidence`, `npm run test:evidence`, and the role-specific checks.

## Stop Conditions

Stop the rehearsal and record the blocker instead of continuing if:

- A secret or personal viewer identifier appears in the recording or screenshot.
- OBS is capturing the ChatXPT overlay as gameplay input.
- A fixture or diagnostic state is visible but the spoken/demo claim calls it live.
- The same authoritative revision cannot be matched across the required surfaces.
- A command mutates local UI state before Role 1 authority accepts it.
- Any unsafe, impossible, humiliating, wagering, illegal, or offline physical quest reaches viewers.
