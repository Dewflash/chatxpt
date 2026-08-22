# Stream History and Retained Analytics Execution Plan

**Status:** Required separate initiative; begins after the persistent-profile ownership exit

**Decision authority:** D-012, D-024, D-037 through D-041, D-074, D-075, D-079, D-083, D-087, D-088, D-090, and D-092

**Prerequisite:** `STREAMER-PROFILE-PERSISTENCE-PLAN.md` SPP-01 through SPP-03 accepted against the linked Supabase project

**Primary responsibility:** Role 1 stream identity, persistence, analytics read models, authorization, APIs, migrations, retention, and deployment

**UI responsibility:** Role 4 Stream History list/detail presentation inside Studio

## User outcome

A verified Twitch broadcaster can open Stream History, see only streams that
actually went live and ended, and inspect one privacy-safe analytics page per
stream. Reconnects, OAuth retries, duplicated EventSub delivery, and repeated
end requests do not create duplicate history entries. Another broadcaster
cannot see or infer those streams.

## Golden-flow boundary

- Stream History is an optional Studio destination, not a setup or demo-flow
  prerequisite.
- Active streams remain in Live Analytics. A stream appears in History only
  after terminal finalization.
- No history data enters OBS, Twitch viewer surfaces, Twitch Live Config, quest
  choice, voting, or lifecycle authority.
- The existing Twitch/capture/quest/viewer/overlay workflow must remain unchanged.
- Failure of history recording or history UI may report degraded history, but it
  must not fabricate data or interrupt the live stream flow.

## Current baseline and compatibility findings

Already implemented:

- `stream_sessions` is a durable session row with broadcaster, status, revision,
  start/end timestamps, end reason, current state, and one-active-session
  uniqueness.
- `session_operations` makes lifecycle start/end/expire commands idempotent.
- Quest cycles, candidate batches, command receipts, accepted participation,
  viewer rewards, and current gameplay snapshots are persisted.
- The current session-history contract represents terminal quest-cycle outcomes
  with privacy-safe aggregate votes/rewards.
- Memory and Supabase history readers build terminal quest history from accepted
  command receipts.
- Twitch EventSub already parses the Twitch stream ID for `stream.online`.
- Studio Live Analytics renders current-session aggregate audience/gameplay state.

Incomplete or unsafe for this initiative:

- The parsed Twitch stream ID is dropped before Studio session synchronization
  and never persisted.
- Re-authenticating during the same Twitch broadcast can therefore create a new
  ChatXPT session after the old mapping ends.
- Existing history entries are quest-cycle rows derived from receipts, not one
  stream list item per ended stream.
- Receipt-limited reconstruction can truncate old history and is unsuitable as
  the permanent stream read model.
- Only the latest gameplay snapshot is retained; a detailed timeline cannot be
  reconstructed after the stream unless aggregate windows are recorded live.
- There is no finalized one-per-stream summary, authorized history API, Studio
  history route, navigation item, or detail page.
- Historical rows without a recorded Twitch stream ID or aggregate windows may
  be valid but necessarily have limited analytics.

## Settled behavior

| Subject | Required behavior |
| --- | --- |
| Visible history eligibility | Session reached `live`, then reached a terminal end |
| Excluded | Twitch connection, setup attempt, Test Lab activity, abandoned `preparing` session |
| Current live stream | Remains in Live Analytics; absent from past Stream History |
| Durable identity | Existing `stream_sessions.session_id`, deduplicated by Twitch `platform_stream_id` when available |
| End behavior | Manual end, confirmed Twitch offline, and reconnect-grace expiry finalize the same row/summary |
| Legacy incomplete stream | Show `Limited analytics`; do not hide or invent data |
| Detailed-window retention | 90 days |
| Private vote/dedup retention | 30 days after stream end |
| Final summary/quest/result aggregates | 365 days |
| Profile/account/identity | Managed by the profile initiative until explicit deletion |
| Privacy | No frames, recordings, raw chat, usernames, persistent viewer profiles, provider payloads, or causal growth claims |

## Target architecture

```text
Verified Twitch online event with streamId
  -> Role 1 resolves/reuses one stream_sessions row
  -> live normalized gameplay/audience/quest events update authoritative state
  -> bounded aggregate analytics windows are upserted during the stream
  -> lifecycle end transaction updates stream_sessions once
  -> same transaction finalizes one stream_session_summaries row
  -> server-authorized history reader filters by internal account ownership
  -> Studio history list/detail renders sanitized read models
```

The history read model consumes canonical normalized/persisted data. It does not
import Role 2/3 private implementation or recalculate quest lifecycle, winners,
rewards, or unsupported gameplay facts.

## Data model and migrations

### Migration SHA-M01 — stream identity and finalized summary

Likely file:

`supabase/migrations/<next>_stream_history_identity_and_summary.sql`

Extend `stream_sessions`:

```text
platform_stream_id text null
session_game_snapshot jsonb
history_schema_version text
```

Indexes/constraints:

- Partial unique `(platform, platform_stream_id)` when
  `platform_stream_id is not null`.
- History list index on `(account_id, ended_at desc, session_id desc)` restricted
  to sessions with `started_at is not null` and terminal status.
- Preserve `stream_sessions_one_active_broadcaster`.

Add:

```text
stream_session_summaries
  session_id primary key -> stream_sessions
  schema_version
  finalized_revision
  evidence_class
  summary jsonb
  limitations jsonb
  finalized_at, updated_at
```

Finalization rules:

- Upsert by `session_id` only for a terminal stream that reached live.
- Same final revision/hash returns the existing summary.
- Conflicting final revision fails closed for reconciliation.
- Lifecycle operation and summary finalization commit atomically.
- Existing `stream_sessions` remains the sole stream/history identity; the
  summary is a 1:1 projection, not another history record.

### Migration SHA-M02 — retained aggregate analytics windows

Likely file:

`supabase/migrations/<next>_stream_analytics_windows.sql`

Add:

```text
stream_analytics_windows
  session_id -> stream_sessions
  metric_kind gameplay|audience|participation|quest|runtime
  window_start, window_end
  schema_version
  aggregate jsonb
  evidence_class
  limitations jsonb
  created_at, updated_at
  primary key(session_id, metric_kind, window_start, schema_version)
```

Window rules:

- Use bounded fixed windows chosen in implementation, preferably one minute for
  the MVP unless measured write load requires five minutes.
- Upsert deterministic aggregate values; do not append raw events.
- Store supported/known/unknown/stale counts, confidence/freshness aggregates,
  activity rates, quest/vote/reward counts, and runtime/fallback status only.
- Do not store raw chat, chat excerpts, usernames, viewer keys, frames, OCR
  crops/text, provider prompts/outputs, or exception payloads.

### Migration SHA-M03 — retention maintenance

Likely file:

`supabase/migrations/<next>_history_retention_maintenance.sql`

Add one server/service-role-only retention function that:

- Purges expired private participation/deduplication/receipt detail after 30 days
  only for ended streams.
- Purges detailed analytics windows after 90 days.
- Purges final summaries/quest/result aggregates after 365 days according to
  account deletion/retention policy.
- Never purges an active or reconnecting stream.
- Returns counts only and logs no private row contents.
- Is idempotent for the same cutoff.

Scheduling remains a Role 1 deployment concern. Verify the existing Vercel or
Supabase scheduler capability before configuration; do not create a second
project or assume an unavailable paid feature.

## Retained analytics contract

### List item

```ts
interface StreamHistoryListItem {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  game: { gameId: string | null; gameName: string | null };
  endReason: string | null;
  questSummary: {
    proposed: number;
    activated: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    skipped: number;
    expired: number;
  };
  acceptedVoteCount: number;
  rewardPointsAwarded: number;
  analyticsAvailability: "complete" | "limited";
  evidenceClass: "live" | "diagnostic";
  limitations: string[];
}
```

### Detail

```ts
interface StreamAnalyticsDetail {
  stream: StreamHistoryListItem;
  questHistory: SessionHistoryEntry[];
  gameplay: {
    captureCoverage: number | null;
    knownFactCount: number;
    unknownFactCount: number;
    confidenceSummary: Record<string, number>;
  } | null;
  audience: {
    activitySummary: Record<string, number>;
    moodDistribution: Record<string, number>;
    topicCounts: Array<{ topic: string; count: number }>;
  } | null;
  participation: {
    acceptedVotes: number;
    questParticipation: number;
    rewardsAwarded: number;
  };
  timeline: StreamAnalyticsWindow[];
  privacy: StreamHistoryPrivacy;
  retention: StreamHistoryRetention;
}
```

Exact schemas must use the current Core Zod conventions. The existing terminal
quest-history schema/builder is reused or refactored into the detail projection;
it is not duplicated under a competing definition.

## API/read-model contracts

### `GET /api/studio/history`

Query:

```text
cursor=<opaque server cursor>
limit=1..50 (default 20)
```

Response:

```text
items: StreamHistoryListItem[]
nextCursor: string | null
retention/privacy summary
```

Rules:

- Verify the signed HttpOnly Twitch broadcaster-connection grant.
- Resolve broadcaster -> internal `account_id` server-side.
- Filter by `account_id`; never accept broadcaster/account authority from query.
- Return only sessions that reached live and ended.
- Cursor orders by `(ended_at desc, session_id desc)` and is signed/opaque.
- Bound response size and disable shared caching.

### `GET /api/studio/history/[sessionId]`

Rules:

- Apply the same verified-account authorization before reading detail.
- Query by both `session_id` and resolved `account_id`.
- Return non-enumerating not-found behavior for another account's session.
- Return `Limited analytics` plus limitations for valid incomplete legacy data.
- Do not return current authoritative state JSON, raw receipts, viewer keys,
  provider payloads, or internal account IDs.

No browser write API is added for history or summaries. Analytics recording and
finalization remain internal Role 1 server/orchestrator operations.

## Ordered passes

### SHA-00 — Prerequisite and remote compatibility audit

**Outcome:** History work begins only after profile/account ownership works and
the linked Supabase/Vercel projects are understood.

Work:

- Confirm the profile initiative's A/B/restart/account-ownership acceptance.
- Recheck remote migration history and schema diff after profile migrations.
- Count started/ended/preparing sessions, rows missing game data, and potential
  historical duplicates without exposing streamer data.
- Decide the next collision-free migration timestamps from current main/remote.
- Preserve unrelated dirty Studio/capture work.

Exit evidence:

- Zero account-less new sessions.
- Historical limitations/backfill report.
- No unresolved remote drift or migration collision.

### SHA-01 — Preserve Twitch stream identity and deduplicate lifecycle

**Outcome:** One Twitch broadcast maps to one durable ChatXPT stream row.

Likely files:

- `src/integrations/twitch/eventsub.ts`
- `src/integrations/twitch/oauth.ts`
- `src/app/api/twitch/eventsub/route.ts`
- `src/app/api/twitch/oauth/callback/route.ts`
- `src/app/server/twitch-local-eventsub.ts`
- `src/app/server/studio-session.ts`
- `src/realtime/types.ts`
- `src/realtime/supabase.ts`
- `src/realtime/memory.ts`
- SHA-M01 migration and tests

Work:

- Carry Twitch `streamId` through OAuth/Helix and EventSub synchronization.
- Add repository lookup by `(platform, platformStreamId)`.
- Reuse an existing matching row before active-broadcaster lookup or creation.
- Attach a stream ID to the current preparing row when it goes live.
- Prevent reauthentication/retry from creating another row for the same stream.
- Preserve lifecycle operation idempotency and active-session uniqueness.

Tests:

- Duplicate online delivery, OAuth recovery, and reconnect reuse one session.
- Separate Twitch stream IDs create separate sessions.
- Broadcasters A and B cannot collide.
- A manually ended ChatXPT session cannot silently create a second history row
  for the same still-live Twitch stream.

### SHA-02 — Record bounded aggregate analytics during the stream

**Outcome:** History can show truthful timelines without storing raw inputs.

Likely files:

- New `src/core/contracts/stream-history.ts`
- `src/core/contracts/index.ts`
- `src/core/index.ts`
- `src/core/application/ports.ts`
- New `src/realtime/stream-analytics.ts`
- `src/realtime/types.ts`
- `src/realtime/supabase.ts`
- `src/realtime/memory.ts`
- `src/app/server/runtime.ts`
- `src/app/server/gameplay-ingress.ts`
- existing audience/quest publication composition points
- SHA-M02 migration and tests

Work:

- Define versioned aggregate-window schemas and privacy assertions.
- Add an injected analytics recorder port to Role 1 composition.
- Record only from accepted normalized gameplay/audience/quest/runtime state.
- Upsert at bounded cadence; do not increase authoritative session revision for
  each analytics write.
- Preserve evidence class, unknown/stale counts, and source limitations.
- Keep Role 2 analysis and Role 3 quest mechanics outside the recorder.

Tests:

- Same window/source update is idempotent.
- Stale/cross-session/unaccepted data is rejected.
- No raw text/frame/viewer/provider fields parse or persist.
- Analytics write failure degrades history health without interrupting live
  session/capture/quest execution.

### SHA-03 — Finalize one stream summary and backfill legacy rows

**Outcome:** Every qualifying ended stream has zero or one deterministic summary;
normal future streams have exactly one.

Likely files:

- `src/realtime/session-lifecycle.ts`
- `src/realtime/supabase.ts`
- `src/realtime/memory.ts`
- `src/realtime/session-history.ts`
- New `src/realtime/stream-history.ts`
- SHA-M01 migration/RPC tests

Work:

- Finalize summary in the lifecycle end/expire transaction.
- Reuse the existing terminal quest-history builder inside the stream detail.
- Derive final aggregate counts from authoritative persisted data.
- Backfill ended historical sessions idempotently.
- Mark missing stream IDs/windows or incomplete quest evidence as limitations.
- Exclude preparing/offline-never-live sessions from user history.

Tests:

- End retry/duplicate operation returns the same summary.
- Manual/offline/grace ending converges on one row.
- Summary revision/hash conflict fails closed.
- Legacy backfill rerun changes no accepted row.
- Legacy incomplete row displays limited, never live-complete, evidence.

### SHA-04 — Add authorized history list/detail APIs

**Outcome:** History is readable only by its verified Twitch-backed account.

Likely files:

- New `src/app/server/stream-history.ts`
- New `src/app/server/stream-history.test.ts`
- New `src/app/api/studio/history/route.ts`
- New `src/app/api/studio/history/route.test.ts`
- New `src/app/api/studio/history/[sessionId]/route.ts`
- New detail-route tests
- `src/app/server/twitch-connection-grant.ts`
- `src/realtime/types.ts`
- `src/realtime/supabase.ts`
- `src/realtime/memory.ts`

Work:

- Implement account-scoped list/detail readers.
- Authorize from verified broadcaster-connection cookie, not fake login, setup
  key, request path, query, or body identity.
- Add bounded/signed cursor parsing.
- Sanitize contracts and error responses.
- Rate-limit expensive detail/timeline reads through the existing server policy
  or a bounded application guard.

Tests:

- A sees A only; B sees B only.
- A's guessed B session ID returns non-enumerating not found.
- Fake account, expired/altered cookie, diagnostic grant, and missing cookie fail.
- Pagination is stable for equal end timestamps.
- Response contains no secret, account ID, raw receipt, viewer key, or current
  state JSON.

### SHA-05 — Add Studio Stream History and analytics detail

**Outcome:** Streamers can browse the required History surface without making it
part of the live workflow or current Live Analytics.

Likely files:

- New `src/app/studio/history/page.tsx`
- New `src/app/studio/history/[sessionId]/page.tsx`
- New `src/streamer/stream-history-pages.tsx`
- New `src/streamer/stream-history-pages.test.tsx`
- New scoped stylesheet or existing design-system styles
- `src/streamer/index.ts`
- `src/streamer/studio-product-pages.tsx`
- `src/streamer/studio-product-pages.test.tsx`
- `src/app/streamer-authorized-client.tsx` only if the shared Studio mount
  requires it after dirty-work reconciliation

Visible states:

- History navigation link; never the default landing page.
- Loading, empty/new streamer, error/retry, pagination, and expired-auth states.
- Stream list ordered newest first.
- Detail summary, terminal quests, bounded analytics timeline, privacy/retention
  notice, and explicit limitations.
- `Limited analytics` for valid legacy/incomplete rows.
- Current live stream remains linked to Live Analytics, not past History.

Tests/evidence:

- Keyboard/focus, mobile/narrow, long game/title text, reduced motion, and screen
  reader labels.
- No flash of another account's cached data.
- No raw chat/user identity/causal growth language.
- History route is optional and demo setup/start remains unchanged.

### SHA-06 — Enforce retention

**Outcome:** Detailed private data expires while final bounded history remains
for the approved duration.

Likely files:

- SHA-M03 migration and database tests
- New `src/app/server/history-retention.ts`
- Optional protected scheduled route only after scheduler verification
- `vercel.json` only if the existing plan supports a safe scheduler
- `.env.example` only if a new server-only scheduler secret is required
- `docs/deployment/VERCEL_PREVIEW.md`

Work:

- Implement and test retention function first.
- Verify scheduler availability/cost before configuration.
- Require server-only scheduler authorization.
- Record only counts/timestamps, no private deleted contents.
- Surface maintenance failure through server health without blocking live flow.

Tests:

- 30/90/365-day boundaries.
- Active/reconnecting streams protected.
- Repeated purge idempotent.
- Final summaries survive detailed-window purge until day 365.
- Account deletion boundary removes only the explicitly deleted account.

### SHA-07 — Supabase Cloud, Vercel Preview, and regression acceptance

**Outcome:** Real hosted history survives restart and remains isolated without
breaking the current product.

Automated gates:

- SQL schema/RLS/function/backfill/retention tests.
- Memory/Supabase repository contract tests.
- Twitch stream-ID and lifecycle idempotency tests.
- API authorization and privacy tests.
- Studio UI tests.
- Existing OAuth, gameplay capture, quest, voting, rewards, realtime, OBS,
  environment, Vercel, and golden-flow tests.
- `npm run check` before merge handoff.

Real evidence:

- Broadcaster A completes one live stream and receives one history entry.
- Reconnect/OAuth/offline retries do not duplicate it.
- Vercel restart/redeployment preserves the entry.
- Browser 2 for A reads the same history.
- Broadcaster B cannot list/read A data and has separate history.
- Legacy/incomplete stream shows `Limited analytics`.
- Retention dry-run and controlled test rows prove cutoff behavior.
- Browser/client artifact scan contains no server secret or private retained data.

## Security and privacy boundaries

- History authorization requires verified Twitch-backed account ownership.
- Fake local account has no cloud-history access.
- All history writes and reads remain behind server APIs/repositories; browser
  clients never query authoritative tables directly.
- RLS/revokes keep browser roles from tables/functions even if a publishable key
  is present.
- Read authorization occurs before detail fetch to prevent ID enumeration or
  accidental cross-account caching.
- Internal account IDs, Twitch IDs, voter keys, raw receipts, OAuth tokens,
  frames, raw chat, usernames, provider payloads, and signing secrets are absent
  from read models.
- Aggregate participant counts remain session-scoped and cannot become persistent
  viewer profiling.
- Analytics describe observed aggregates and limitations; they never claim
  ChatXPT caused growth, retention, engagement, or a gameplay outcome.

## Deployment sequence

1. Finish SHA-00 and record backup plus migration audit.
2. Apply additive stream-identity/summary migration while UI remains disabled.
3. Deploy stream-ID propagation and deduplication; verify no live regression.
4. Apply analytics-window migration and deploy bounded recorder.
5. Verify write volume, privacy, and failure isolation.
6. Deploy summary finalization and idempotent legacy backfill.
7. Compare counts/invariants before enabling history APIs.
8. Deploy APIs with UI unavailable to clients; verify A/B authorization.
9. Deploy Studio routes/nav, then enable in Vercel Preview.
10. Apply/enable retention only after scheduler and cutoff evidence.
11. Run complete cloud, browser, restart, separate-broadcaster, and golden-flow
    acceptance before marking complete.

## Rollback

- Disable history recording/API/UI feature boundaries without disabling live
  Twitch/session/quest flow.
- Redeploy the previous Vercel revision while leaving additive columns/tables.
- Do not remove stream IDs or finalized summaries during application rollback.
- If aggregate writes cause load, disable the recorder and retain terminal
  session metadata; report analytics as limited.
- If summary finalization fails, end the stream normally and queue server-side
  reconciliation; do not create a second session/history row.
- Use forward migrations for schema/data corrections. Destructive table/column
  rollback requires a separately reviewed recovery decision and backup.

## Acceptance matrix

| Case | Required proof |
| --- | --- |
| A ends stream | One durable `stream_sessions` row and one finalized summary |
| Retry/reconnect | Same Twitch stream ID reuses the same row; no duplicate history |
| B connects | Separate account/session/history; no cross-read |
| Restart | Supabase/Vercel restart retains list/detail |
| Current live | Present in Live Analytics, absent from past history |
| Never-live setup | Absent from Stream History |
| Legacy incomplete | Visible as `Limited analytics` with honest limitations |
| Privacy | Only bounded aggregates; no raw or persistent viewer data |
| Authorization | Fake login/query/path/session guess grants no history access |
| Retention | 30/90/365-day rules execute without touching active streams |
| Demo regression | Twitch/capture/quest/vote/overlay/result flow remains unchanged |
| External claims | Supabase Cloud and Vercel are claimed only after recorded runtime evidence |

## Completion record

This initiative is complete only when D-083 evidence covers lifecycle
idempotency, persistent summaries, authorized list/detail APIs, visible Studio
states, retention, restart, second browser, separate broadcaster, real Supabase
Cloud, Vercel Preview, and golden-flow regression. Source inspection, static SQL,
component rendering, and fixture-only tests are supporting evidence, not hosted
completion proof.
