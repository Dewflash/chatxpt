# Persistent Streamer Profile and Local Fallback Execution Plan

**Status:** In progress. SPP-01 through SPP-04 are implemented and locally verified; SPP-00 remote audit and SPP-05 real cloud/browser/restart evidence remain open.

**Decision authority:** D-013, D-037 through D-041, D-058, D-061, D-083, D-087, D-089, D-091, and D-092

**Primary responsibility:** Role 1 identity, persistence, lifecycle, authorization, migrations, and deployment

**UI responsibility:** Role 4 Studio account/preset selection, fallback status, and conflict recovery

**Initiative order:** First of two required initiatives; `STREAM-HISTORY-ANALYTICS-PLAN.md` begins only after this plan's ownership and profile-loading exit passes

## User outcome

A Twitch broadcaster connects from any browser or device and receives the same
saved ChatXPT profile, presets, restrictions, accessibility settings, and game
preferences. New sessions load that profile before constructing authoritative
state. Defaults are created exactly once for a genuinely new broadcaster.

If Supabase is unavailable, the streamer can explicitly choose the established
local demo account in the existing fake-login presentation and reuse its saved
local presets. The local account is a device/local-runtime recovery path, not
real authentication and not authority over Twitch or cloud data.

## Golden-flow boundary

- This initiative must not change the established Twitch -> capture -> analysis
  -> exactly-three quests -> voting -> overlay -> result workflow.
- The only normal-path behavior change is that a verified returning broadcaster
  receives saved presets instead of defaults.
- Existing Twitch OAuth, gameplay capture, quest, viewer, OBS overlay, hosted
  board, Twitch-chat fallback, and local memory-runtime behavior remain regression
  gates.
- The local recovery account is optional and failure-oriented. It must never
  become a prerequisite for the normal Twitch-backed path.

## Current baseline and compatibility findings

Already implemented:

- Twitch OAuth verifies the provider identity and uses Twitch `user_id` as the
  broadcaster ID.
- The OAuth callback issues signed HttpOnly Studio and broadcaster-connection
  grants.
- `streamer_profiles` persists versioned profile JSONB by `streamer_id`.
- `commit_authoritative_state` writes accepted profile changes with the current
  authoritative state.
- `stream_sessions` permits one active preparing/live session per broadcaster.
- Memory and Supabase persistence runtimes share the same Role 1 composition
  boundary.
- `StreamerProfile` already includes starter/custom presets, selected preset,
  experience settings, restrictions, quest preferences, accessibility,
  watchlist, voting, and reward preferences.
- The Studio profile UI already emits the canonical
  `streamer.profile-settings` command.

Resolved in the current implementation branch:

- `StudioSessionApplication` resolves the verified Twitch profile before session bootstrap.
- Forward migrations reject destructive profile bootstrap and add internal account/identity ownership.
- Memory and Supabase runtimes implement the same profile repository contract.
- Saved default game and current-session game are separate; only Gameplay Capture explicitly applies both.
- The established local profile uses a validated, versioned, size-bounded browser envelope with explicit cloud conflict handling.
- Studio exposes account, live-input, and profile-storage health independently.

Still open:

- Link and audit the existing Supabase and Vercel projects without creating replacements.
- Execute the pgTAP database tests against the linked Supabase project.
- Capture real Supabase Cloud, Vercel Preview, second-browser, server-restart, and separate-broadcaster evidence required by D-083.

## Settled behavior

| Subject | Required behavior |
| --- | --- |
| Real MVP identity | Verified Twitch broadcaster ID |
| First connection | Create one default profile only when no profile exists |
| Returning connection | Load complete saved profile and preserve its revision |
| Twitch metadata refresh | May update verified display/current-stream metadata; may not overwrite streamer-owned saved settings |
| Local fallback selection | Existing fake-login presentation offers one established local demo account with saved local presets |
| Local authority | Device/local recovery state only; never Twitch, hosted, or cloud authority |
| Local/cloud conflict | Apply local pending change only against its recorded base cloud revision; otherwise require explicit choice |
| Future account | Add internal ownership plus connected identities without adding ChatXPT Auth now |
| Disconnect | Preserve account, profile, and history |
| Delete | Explicit future action; schema supports it, visible deletion UI remains deferred |

## Target architecture

```text
Verified Twitch OAuth
  -> Twitch adapter returns verified provider subject
  -> Role 1 resolves connected identity and internal account
  -> profile repository loads existing profile or creates defaults once
  -> Studio session is constructed with that exact profile
  -> existing command/orchestrator path updates the profile by revision

Explicit local fallback
  -> existing fake-login presentation selects established local account
  -> versioned browser-local preset bundle is loaded
  -> Twitch OAuth or the existing diagnostic authority still authorises server actions
  -> memory runtime runs the same canonical session/quest flow
  -> accepted local profile changes update the local bundle
```

Core contracts remain platform-neutral. Twitch identity mapping stays in Role 1
integration/persistence code. The canonical session may continue exposing the
Twitch broadcaster ID during the compatibility phase; internal `account_id`
does not enter AI, viewer, or OBS projections.

## Public and private seams

Implemented under `src/realtime/types.ts` and the Role 1 server-only entry:

```ts
interface VerifiedStreamerIdentity {
  provider: "twitch";
  providerSubjectId: string;
  displayName: string;
  verifiedAt: number;
}

interface StreamerProfileRecord {
  accountId: string;
  profile: StreamerProfile;
  createdAt: number;
  updatedAt: number;
}

interface StreamerProfileRepository {
  loadByStreamerId(streamerId: string): Promise<StreamerProfileRecord | null>;
  getOrCreateForVerifiedIdentity(
    identity: VerifiedStreamerIdentity,
    defaults: StreamerProfile,
  ): Promise<StreamerProfileRecord & { created: boolean }>;
  getOrCreateForDiagnostic(
    defaults: StreamerProfile,
    at: number,
  ): Promise<StreamerProfileRecord & { created: boolean }>;
}
```

The exact TypeScript names may follow current repository conventions, but the
responsibilities and dependency direction are fixed:

- Twitch verifies the provider subject.
- Persistence resolves ownership and profile.
- Studio constructs a session from the returned profile.
- The existing authoritative profile command remains the only normal write path.
- Browser UI cannot choose a cloud broadcaster/account identifier.

## Data model and migrations

### Migration SPP-M01 — profile bootstrap preservation

Implemented file:

`supabase/migrations/202608220001_profile_bootstrap_preservation.sql`

Work:

- Preserve the existing `streamer_profiles` schema and data.
- Change bootstrap behavior so an existing profile cannot be replaced by a
  default or lower/mismatched revision.
- Reject a mismatched existing-profile bootstrap until the application loads
  and supplies the persisted profile.
- Keep the RPC server/service-role only.
- Add affected-row/revision checks to profile update behavior.
- Do not edit an already-applied historical migration.

### Migration SPP-M02 — internal accounts and connected identities

Implemented file:

`supabase/migrations/202608220002_streamer_accounts_connected_identities.sql`

Add:

```text
streamer_accounts
  account_id uuid primary key
  status active|deleted
  created_at, updated_at, deleted_at

connected_identities
  identity_id uuid primary key
  account_id -> streamer_accounts
  provider
  provider_subject_id
  verified_at, last_seen_at
  bounded non-secret display metadata
  unique(provider, provider_subject_id)

streamer_profiles.account_id
stream_sessions.account_id
```

Compatibility strategy:

1. Add nullable columns and new tables.
2. Backfill one internal account per existing `streamer_profiles.streamer_id`.
3. Add one Twitch connected identity per existing broadcaster.
4. Backfill sessions through their existing broadcaster/profile relationship.
5. Report and stop on invalid profile JSON, revision disagreement, duplicate
   provider subjects, or unmapped rows.
6. Add non-null/unique/foreign-key constraints only after the report is clean.
7. Keep existing `streamer_id`, `broadcaster_id`, profile IDs, session IDs, and
   OBS broadcaster mappings intact.

Do not store OAuth tokens, Supabase credentials, Twitch secrets, email/password
credentials, or fake-login passwords in these tables.

## Local fallback data contract

The browser-local fallback requires a new validated, versioned, non-secret
envelope. It supplements the existing local fake-account key; it does not turn
that key into authentication.

```ts
interface LocalFallbackProfileEnvelopeV1 {
  version: 1;
  localAccountId: "chatxpt-established-demo";
  profile: StreamerProfile;
  baseCloudRevision: number | null;
  pendingPatch: ProfileSettingsPatch | null;
  savedAt: number;
}
```

Rules:

- Seed the established demo account from the canonical starter presets when no
  valid local envelope exists.
- Preserve accepted custom local presets across browser reload and local server
  restart.
- Validate and size-bound every read; invalid data resets only after preserving
  a recoverable diagnostic message.
- Never store secrets, OAuth tokens, raw chat, frames, viewer identity, or cloud
  history.
- The fake password remains presentation-only and is never persisted or sent.
- Selecting the local account does not authorise server commands. Real Twitch
  OAuth remains required for real Twitch operations; the existing server-only
  diagnostic authority remains the separately labelled non-Twitch recovery path.
- When returning to cloud, resolve the Twitch account first, then compare
  `baseCloudRevision`. Apply the pending patch only on an exact match. A mismatch
  renders a clear local-versus-cloud choice and does not auto-merge safety or
  accessibility boundaries.

## Ordered passes

### SPP-00 — Preserve work and verify existing projects

**Outcome:** Implementation targets the existing Supabase and `chatxpt-demo`
Vercel projects without overwriting dirty work or creating duplicates.

Work:

- Reconcile or deliberately preserve current uncommitted Studio/capture changes.
- Reauthenticate Vercel and link only `chatxpt-demo` in its existing scope.
- Link only the existing Supabase project.
- Compare local and remote migration histories and produce a schema-only diff.
- Record backups, table counts, profile parse/revision checks, and active-session
  invariants without printing data or secrets.

Exit evidence:

- Exact existing project identities recorded without credentials.
- Local/remote migration matrix is understood.
- No remote-only/checksum/manual-drift blocker remains.
- No unrelated work was discarded.

### SPP-01 — Add safe profile lookup and first-create behavior

**Outcome:** Verified broadcaster lookup returns saved state; defaults are
created once only.

Likely files:

- `src/realtime/types.ts`
- `src/realtime/supabase.ts`
- `src/realtime/memory.ts`
- `src/realtime/server.ts`
- `src/realtime/server-runtime.ts`
- SPP-M01 migration and SQL tests

Work:

- Add profile reader/get-or-create behavior to both persistence runtimes.
- Use broadcaster uniqueness for first-create concurrency.
- Parse every loaded/default profile through the canonical schema.
- Preserve profile revision and selected/custom presets.
- Make concurrent first OAuth callbacks converge on one row.

Tests:

- New broadcaster creates one default profile.
- Existing broadcaster returns the saved profile unchanged.
- Broadcaster A and B remain isolated.
- Simultaneous first-create attempts return the same persisted profile.
- Invalid or lower-revision overwrite fails closed.

### SPP-02 — Hydrate every new session from persisted profile

**Outcome:** Ending and creating a new session cannot reset profile state.

Likely files:

- `src/app/server/studio-session.ts`
- `src/app/server/studio-session.test.ts`
- `src/app/api/twitch/oauth/callback/route.ts`
- `src/app/api/studio/session/route.ts`
- `src/realtime/session-lifecycle.ts`
- `src/realtime/supabase.ts`

Work:

- Resolve profile before constructing revision-zero session state.
- Construct defaults only when SPP-01 reports `created: true`.
- Reload the persisted authoritative state after bootstrap.
- Separate verified display/current-stream metadata from saved settings.
- Retain the existing active-session resume behavior and profile command path.

Tests:

- Save custom preset -> end -> reconnect -> same preset/revision.
- Restart server/runtime -> same profile.
- OAuth display-name change does not reset presets.
- Twitch current game does not silently rewrite saved preferred game settings.
- Failed bootstrap cannot leave a partially created session.

### SPP-03 — Introduce future-compatible ownership

**Outcome:** Existing Twitch identity owns the same data through a durable
internal account that future ChatXPT Auth can claim.

Likely files:

- SPP-M02 migration and SQL tests
- `src/realtime/types.ts`
- `src/realtime/supabase.ts`
- `src/realtime/memory.ts`
- `src/app/server/twitch-connection-grant.ts`
- `src/integrations/twitch/oauth.ts`

Work:

- Resolve verified Twitch identity to internal account and profile.
- Use `account_id` for private repository authorization/ownership checks.
- Keep current Twitch IDs in compatibility contracts and adapters.
- Allow future multiple provider identities at the schema level while exposing
  one active Twitch broadcaster in the MVP UI.
- Define explicit unlink/deletion transaction boundaries without adding the
  deferred deletion UI or another auth provider.

Tests:

- Existing IDs/counts survive backfill.
- Every profile/session maps to one account.
- An already-owned Twitch identity cannot be claimed by another account.
- Unlink preserves data; explicit test-only deletion transaction cascades only
  the intended account data.

### SPP-04 — Established local account, presets, and conflict recovery

**Outcome:** The owner can deliberately recover a Supabase failure inside the
app without rebuilding demo presets.

Likely files:

- `src/app/streamer-authorized-client.tsx`
- `src/app/streamer-authorized-client.test.tsx`
- New `src/streamer/local-fallback-profile.ts`
- New `src/streamer/local-fallback-profile.test.ts`
- `src/streamer/studio-product-pages.tsx`
- `src/streamer/studio-product-pages.test.tsx`
- `src/streamer/index.ts`
- `src/streamer/README.md`

Visible flow:

1. Existing fake-login presentation offers `Use local demo account`.
2. The established local account loads its saved preset bundle.
3. Studio visibly labels `Local fallback · this device only`.
4. `Profile & Defaults` selects/edits the local saved presets.
5. Real Twitch connection still supplies Twitch authority when available.
6. On cloud recovery, `Return to Twitch-backed account` authenticates Twitch,
   loads the cloud profile, and resolves any revision conflict explicitly.

Tests:

- Established account exists without first-time creation.
- Local presets survive browser reload and local server restart.
- Clean-start reset behavior is explicit: reset may sign out, but does not erase
  the established fallback preset bundle unless the dedicated local-data action
  is chosen.
- Fake login cannot access cloud profile/history or authorise server commands.
- Conflict choice preserves both versions until the streamer selects one.
- Invalid/oversized local data fails safely and exposes recovery.

### SPP-05 — Cloud, browser, restart, and regression acceptance

**Outcome:** The normal cloud path and local failure path are both genuinely
usable without breaking the demo.

Automated gates:

- SQL migration/RLS/function tests.
- Memory/Supabase repository contract tests.
- OAuth/session/profile authorization tests.
- Role 4 UI and local fallback tests.
- Existing Twitch, gameplay ingress, quest, viewer, overlay, reset, environment,
  and Vercel configuration suites.
- `npm run check` before merge handoff.

Real evidence:

- Broadcaster A saves preferences in Browser 1 and receives them in Browser 2.
- Broadcaster B receives a separate profile.
- Server restart preserves both cloud profiles.
- Vercel Preview restart/redeployment preserves the profile.
- Supabase-unavailable run selects established local account and loads presets.
- Local edits survive local restart.
- Supabase recovery exercises both clean sync and revision-conflict choice.
- Client bundle/response inspection finds no server secret.

## Security and privacy boundaries

- Twitch OAuth is the only real MVP account authority.
- Fake local login and local preset data never grant server, Twitch, Supabase,
  OBS, Extension, or cloud-history access.
- No client-provided broadcaster/account ID establishes ownership.
- Supabase writes remain server-only; browser roles cannot mutate tables.
- Only publishable Supabase URL/key may reach browser code; service/secret keys,
  Twitch secrets/tokens, signing secrets, OBS setup keys, and application secrets
  remain server-side or HttpOnly as appropriate.
- Local profile storage contains presets/preferences only and is bounded,
  validated, device-local, and clearable.
- Streamer identity/profile is never added to provider prompts beyond the
  bounded non-identifying preference context already permitted by D-072.

## Rollout

1. Finish SPP-00 and record a clean remote migration audit.
2. Apply SPP-M01 protection before enabling new profile creation.
3. Deploy SPP-01/SPP-02 together so new sessions load profiles immediately.
4. Verify A/B/restart behavior before SPP-M02.
5. Apply additive account/identity migration and backfill.
6. Deploy account-aware repositories while preserving compatibility keys.
7. Enable local fallback behind the existing local/preview presentation boundary.
8. Run cloud and local acceptance before marking the initiative complete.

## Rollback

- Fail profile/session creation closed rather than returning to destructive
  default overwrite behavior.
- Disable new account-aware/local-sync surfaces through a server/client feature
  boundary and redeploy the previous compatible application.
- Leave additive ownership columns/tables in place; do not destructively drop
  migrated data.
- Never restore the old profile-overwriting bootstrap function.
- Use forward migrations for schema/data correction.
- Restore from backup only for confirmed corruption after preserving evidence.

## Acceptance matrix

| Case | Required proof |
| --- | --- |
| A reconnects | A receives A's saved complete profile and revision |
| B connects | B receives independent defaults/profile and cannot read A |
| Restart | Cloud profiles remain; established local presets remain in the same browser |
| Default creation | Exactly once for a genuinely new verified broadcaster |
| OAuth refresh | Display/current-stream metadata may refresh; saved settings do not reset |
| Supabase failure | Explicit local account loads usable local presets |
| Local authority | Fake login alone cannot issue hosted/Twitch/cloud-authorised commands |
| Local recovery | Clean revision sync applies; conflict requires explicit choice |
| Future account | Existing Twitch data attaches to internal account without copying |
| Demo regression | Existing Twitch/capture/quest/vote/OBS workflow behaves the same except saved preset restoration |
| Secrets | No server secret appears in browser code, storage, history, logs, or responses |

## Completion record

This initiative is complete only when D-083 evidence covers the visible Studio
behavior, authoritative profile write/read, persistence, restart, second browser,
separate broadcaster, local failure recovery, and demo regression. Source
inspection, fixture-only tests, or static SQL do not prove Supabase Cloud or
Vercel behavior.
