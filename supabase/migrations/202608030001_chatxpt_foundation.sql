-- ChatXPT Role 1 persistence and realtime foundation.
-- Clients never write these tables directly. The service role reaches them
-- through the server-side repositories and restricted RPC functions below.

create table public.streamer_profiles (
  streamer_id text primary key,
  profile_id text not null unique,
  contract_version text not null,
  revision bigint not null check (revision >= 0),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(streamer_id) between 1 and 128),
  check (char_length(profile_id) between 1 and 128)
);

create table public.stream_sessions (
  session_id text primary key,
  broadcaster_id text not null references public.streamer_profiles(streamer_id),
  room_code text not null unique check (room_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  platform text not null default 'twitch' check (platform = 'twitch'),
  status text not null check (status in ('offline', 'preparing', 'live', 'ended')),
  revision bigint not null check (revision >= 0),
  contract_version text not null,
  current_quest_cycle_id text,
  current_state jsonb not null check (jsonb_typeof(current_state) = 'object'),
  last_activity_at timestamptz not null,
  last_heartbeat_at timestamptz,
  reconnect_deadline_at timestamptz,
  created_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  updated_at timestamptz not null default now(),
  check (char_length(session_id) between 1 and 128),
  check (char_length(broadcaster_id) between 1 and 128),
  check (reconnect_deadline_at is null or status = 'live'),
  check (ended_at is null or status in ('offline', 'ended'))
);

create unique index stream_sessions_one_active_broadcaster
  on public.stream_sessions (broadcaster_id)
  where status in ('preparing', 'live');
create index stream_sessions_room_lookup on public.stream_sessions (room_code);
create index stream_sessions_due_preparing
  on public.stream_sessions (last_activity_at)
  where status = 'preparing';
create index stream_sessions_due_reconnect
  on public.stream_sessions (reconnect_deadline_at)
  where status = 'live' and reconnect_deadline_at is not null;

create table public.quest_cycles (
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  quest_cycle_id text not null,
  revision bigint not null check (revision >= 0),
  status text not null check (
    status in (
      'idle', 'evaluating', 'proposed', 'voting', 'active', 'succeeded',
      'failed', 'cancelled', 'skipped', 'expired', 'cooldown'
    )
  ),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, quest_cycle_id),
  check (char_length(quest_cycle_id) between 1 and 128)
);

create index quest_cycles_current_revision
  on public.quest_cycles (session_id, revision desc);

create table public.quest_candidate_batches (
  batch_id text primary key,
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  quest_cycle_id text,
  revision bigint not null check (revision >= 0),
  contract_version text not null,
  candidate_count smallint not null check (candidate_count = 3),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  check (char_length(batch_id) between 1 and 128)
);

create index quest_candidate_batches_session_revision
  on public.quest_candidate_batches (session_id, revision desc);

create table public.command_receipts (
  command_id text primary key,
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  quest_cycle_id text,
  command_type text not null,
  command_fingerprint text not null,
  expected_revision bigint not null check (expected_revision >= 0),
  committed_revision bigint not null check (committed_revision = expected_revision + 1),
  accepted_at timestamptz not null,
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  created_at timestamptz not null default now(),
  check (char_length(command_id) between 1 and 128)
);

create index command_receipts_session_revision
  on public.command_receipts (session_id, committed_revision desc);

create table public.quest_events (
  event_id text primary key,
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  quest_cycle_id text,
  command_id text not null references public.command_receipts(command_id) on delete cascade,
  revision bigint not null check (revision >= 0),
  event_index smallint not null check (event_index >= 0),
  event_type text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (command_id, event_index),
  check (char_length(event_id) between 1 and 128)
);

create index quest_events_session_revision
  on public.quest_events (session_id, revision, event_index);

create table public.accepted_participation (
  command_id text primary key references public.command_receipts(command_id) on delete cascade,
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  quest_cycle_id text,
  participation_type text not null check (participation_type in ('vote', 'reaction')),
  actor_kind text not null check (actor_kind in ('viewer', 'anonymous')),
  actor_id text,
  candidate_id text,
  reaction text,
  accepted_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  check (
    (participation_type = 'vote' and candidate_id is not null and reaction is null)
    or (participation_type = 'reaction' and reaction is not null and candidate_id is null)
  )
);

create index accepted_participation_session_cycle
  on public.accepted_participation (session_id, quest_cycle_id, accepted_at);

create table public.public_session_snapshots (
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  view_role text not null check (view_role in ('streamer', 'viewer', 'overlay')),
  revision bigint not null check (revision >= 0),
  contract_version text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  updated_at timestamptz not null,
  primary key (session_id, view_role)
);

create table public.realtime_access_grants (
  grant_id uuid primary key default gen_random_uuid(),
  principal_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  view_role text not null check (view_role in ('streamer', 'viewer', 'overlay')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (principal_id, session_id, view_role),
  check (revoked_at is null or revoked_at >= created_at)
);

create index realtime_access_grants_authorization
  on public.realtime_access_grants (principal_id, session_id, view_role, expires_at)
  where revoked_at is null;

create table public.session_operations (
  operation_id text primary key,
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  action text not null check (action in ('start', 'end', 'expire')),
  expected_revision bigint not null check (expected_revision >= 0),
  committed_revision bigint not null check (committed_revision = expected_revision + 1),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (char_length(operation_id) between 1 and 128)
);

create or replace function public.bootstrap_chatxpt_session(
  p_room_code text,
  p_state jsonb,
  p_created_at_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id text := p_state #>> '{session,sessionId}';
  v_broadcaster_id text := p_state #>> '{session,broadcasterId}';
  v_profile_id text := p_state #>> '{profile,profileId}';
  v_quest_cycle_id text := p_state #>> '{questCycle,envelope,questCycleId}';
  v_revision bigint := (p_state #>> '{session,revision}')::bigint;
  v_created_at timestamptz := to_timestamp(p_created_at_ms / 1000.0);
begin
  if p_room_code !~ '^[A-HJ-NP-Z2-9]{8}$' then
    raise exception using errcode = '22023', message = 'invalid-room-code';
  end if;
  if v_session_id is null or v_broadcaster_id is null or v_profile_id is null or v_quest_cycle_id is null then
    raise exception using errcode = '22023', message = 'invalid-bootstrap-state';
  end if;
  if p_state #>> '{session,status}' <> 'preparing' or v_revision <> 0 then
    raise exception using errcode = '22023', message = 'bootstrap-state-must-be-preparing-revision-zero';
  end if;
  if (p_state #>> '{session,createdAt}')::bigint <> p_created_at_ms then
    raise exception using errcode = '22023', message = 'bootstrap-created-at-mismatch';
  end if;
  if (p_state #>> '{questCycle,envelope,revision}')::bigint <> v_revision then
    raise exception using errcode = '22023', message = 'bootstrap-revisions-disagree';
  end if;
  if p_state #>> '{profile,streamerId}' <> v_broadcaster_id then
    raise exception using errcode = '22023', message = 'bootstrap-profile-owner-mismatch';
  end if;

  insert into public.streamer_profiles (
    streamer_id, profile_id, contract_version, revision, profile, created_at, updated_at
  ) values (
    v_broadcaster_id,
    v_profile_id,
    p_state #>> '{questCycle,envelope,contractVersion}',
    (p_state #>> '{profile,revision}')::bigint,
    p_state -> 'profile',
    v_created_at,
    v_created_at
  )
  on conflict (streamer_id) do update set
    profile_id = excluded.profile_id,
    contract_version = excluded.contract_version,
    revision = excluded.revision,
    profile = excluded.profile,
    updated_at = excluded.updated_at;

  insert into public.stream_sessions (
    session_id, broadcaster_id, room_code, platform, status, revision,
    contract_version, current_quest_cycle_id, current_state, last_activity_at,
    created_at, started_at, ended_at, updated_at
  ) values (
    v_session_id,
    v_broadcaster_id,
    p_room_code,
    'twitch',
    'preparing',
    v_revision,
    p_state #>> '{questCycle,envelope,contractVersion}',
    v_quest_cycle_id,
    p_state,
    v_created_at,
    v_created_at,
    null,
    null,
    v_created_at
  );

  insert into public.quest_cycles (
    session_id, quest_cycle_id, revision, status, state, created_at, updated_at
  ) values (
    v_session_id,
    v_quest_cycle_id,
    v_revision,
    p_state #>> '{questCycle,status}',
    p_state -> 'questCycle',
    v_created_at,
    v_created_at
  );

  return jsonb_build_object(
    'sessionId', v_session_id,
    'roomCode', p_room_code,
    'revision', v_revision,
    'status', 'preparing'
  );
end;
$$;

create or replace function public.commit_authoritative_state(
  p_session_id text,
  p_command_id text,
  p_command_fingerprint text,
  p_expected_revision bigint,
  p_command jsonb,
  p_next_state jsonb,
  p_events jsonb,
  p_accepted_at_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_revision bigint;
  v_broadcaster_id text;
  v_session_status text;
  v_receipt jsonb;
  v_quest_cycle_id text := p_next_state #>> '{questCycle,envelope,questCycleId}';
  v_committed_revision bigint := p_expected_revision + 1;
  v_accepted_at timestamptz := to_timestamp(p_accepted_at_ms / 1000.0);
  v_event record;
begin
  -- Command IDs are globally unique. Serialize same-ID commits even when they
  -- target different sessions so a race resolves as duplicate, not 23505.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_command_id, 0));

  select receipt into v_receipt
  from public.command_receipts
  where command_id = p_command_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'receipt', v_receipt);
  end if;

  select revision, broadcaster_id, status
  into v_current_revision, v_broadcaster_id, v_session_status
  from public.stream_sessions
  where session_id = p_session_id
  for update;
  if not found then
    return jsonb_build_object('status', 'stale', 'currentRevision', 0);
  end if;

  select receipt into v_receipt
  from public.command_receipts
  where command_id = p_command_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'receipt', v_receipt);
  end if;

  if v_current_revision <> p_expected_revision then
    return jsonb_build_object('status', 'stale', 'currentRevision', v_current_revision);
  end if;
  if v_session_status not in ('preparing', 'live') then
    raise exception using errcode = '22023', message = 'session-is-not-active';
  end if;
  if p_command #>> '{sessionId}' <> p_session_id or p_command #>> '{commandId}' <> p_command_id then
    raise exception using errcode = '22023', message = 'command-identity-mismatch';
  end if;
  if p_next_state #>> '{session,sessionId}' <> p_session_id then
    raise exception using errcode = '22023', message = 'next-state-session-mismatch';
  end if;
  if p_next_state #>> '{session,broadcasterId}' <> v_broadcaster_id
    or p_next_state #>> '{profile,streamerId}' <> v_broadcaster_id then
    raise exception using errcode = '22023', message = 'next-state-broadcaster-mismatch';
  end if;
  if (p_next_state #>> '{session,revision}')::bigint <> v_committed_revision
    or (p_next_state #>> '{questCycle,envelope,revision}')::bigint <> v_committed_revision then
    raise exception using errcode = '22023', message = 'next-state-revision-mismatch';
  end if;
  if jsonb_typeof(p_events) <> 'array' then
    raise exception using errcode = '22023', message = 'events-must-be-an-array';
  end if;

  v_receipt := jsonb_build_object(
    'command', p_command,
    'commandFingerprint', p_command_fingerprint,
    'state', p_next_state,
    'events', p_events,
    'acceptedAt', p_accepted_at_ms
  );

  update public.streamer_profiles set
    profile_id = p_next_state #>> '{profile,profileId}',
    contract_version = p_next_state #>> '{questCycle,envelope,contractVersion}',
    revision = (p_next_state #>> '{profile,revision}')::bigint,
    profile = p_next_state -> 'profile',
    updated_at = v_accepted_at
  where streamer_id = p_next_state #>> '{profile,streamerId}';

  update public.stream_sessions set
    status = p_next_state #>> '{session,status}',
    revision = v_committed_revision,
    contract_version = p_next_state #>> '{questCycle,envelope,contractVersion}',
    current_quest_cycle_id = v_quest_cycle_id,
    current_state = p_next_state,
    last_activity_at = v_accepted_at,
    started_at = case
      when p_next_state #>> '{session,startedAt}' is null then null
      else to_timestamp((p_next_state #>> '{session,startedAt}')::bigint / 1000.0)
    end,
    ended_at = case
      when p_next_state #>> '{session,endedAt}' is null then null
      else to_timestamp((p_next_state #>> '{session,endedAt}')::bigint / 1000.0)
    end,
    updated_at = v_accepted_at
  where session_id = p_session_id;

  insert into public.quest_cycles (
    session_id, quest_cycle_id, revision, status, state, created_at, updated_at
  ) values (
    p_session_id,
    v_quest_cycle_id,
    v_committed_revision,
    p_next_state #>> '{questCycle,status}',
    p_next_state -> 'questCycle',
    v_accepted_at,
    v_accepted_at
  )
  on conflict (session_id, quest_cycle_id) do update set
    revision = excluded.revision,
    status = excluded.status,
    state = excluded.state,
    updated_at = excluded.updated_at;

  insert into public.command_receipts (
    command_id, session_id, quest_cycle_id, command_type, command_fingerprint,
    expected_revision, committed_revision, accepted_at, receipt
  ) values (
    p_command_id,
    p_session_id,
    p_command #>> '{questCycleId}',
    p_command #>> '{type}',
    p_command_fingerprint,
    p_expected_revision,
    v_committed_revision,
    v_accepted_at,
    v_receipt
  );

  for v_event in
    select value as payload, ordinality - 1 as event_index
    from jsonb_array_elements(p_events) with ordinality
  loop
    insert into public.quest_events (
      event_id, session_id, quest_cycle_id, command_id, revision, event_index,
      event_type, payload, occurred_at
    ) values (
      v_event.payload #>> '{envelope,messageId}',
      p_session_id,
      v_event.payload #>> '{envelope,questCycleId}',
      p_command_id,
      v_committed_revision,
      v_event.event_index,
      v_event.payload #>> '{event,eventType}',
      v_event.payload,
      to_timestamp((v_event.payload #>> '{envelope,occurredAt}')::bigint / 1000.0)
    );
  end loop;

  if p_command #>> '{type}' in ('viewer.vote', 'viewer.react') then
    insert into public.accepted_participation (
      command_id, session_id, quest_cycle_id, participation_type, actor_kind,
      actor_id, candidate_id, reaction, accepted_at, payload
    ) values (
      p_command_id,
      p_session_id,
      p_command #>> '{questCycleId}',
      case when p_command #>> '{type}' = 'viewer.vote' then 'vote' else 'reaction' end,
      p_command #>> '{actor,kind}',
      p_command #>> '{actor,actorId}',
      p_command #>> '{candidateId}',
      p_command #>> '{reaction}',
      v_accepted_at,
      p_command
    );
  end if;

  return jsonb_build_object('status', 'committed', 'receipt', v_receipt);
end;
$$;

create or replace function public.persist_role_snapshots(
  p_session_id text,
  p_revision bigint,
  p_views jsonb,
  p_recorded_at_ms bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_snapshot jsonb;
  v_recorded_at timestamptz := to_timestamp(p_recorded_at_ms / 1000.0);
begin
  perform 1
  from public.stream_sessions
  where session_id = p_session_id and revision = p_revision;
  if not found then
    raise exception using errcode = '40001', message = 'snapshot-revision-is-not-current';
  end if;

  foreach v_role in array array['streamer', 'viewer', 'overlay']
  loop
    v_snapshot := p_views -> v_role;
    if v_snapshot is null
      or v_snapshot #>> '{envelope,sessionId}' <> p_session_id
      or (v_snapshot #>> '{envelope,revision}')::bigint <> p_revision then
      raise exception using errcode = '22023', message = 'invalid-role-snapshot';
    end if;

    insert into public.public_session_snapshots (
      session_id, view_role, revision, contract_version, snapshot, updated_at
    ) values (
      p_session_id,
      v_role,
      p_revision,
      v_snapshot #>> '{envelope,contractVersion}',
      v_snapshot,
      v_recorded_at
    )
    on conflict (session_id, view_role) do update set
      revision = excluded.revision,
      contract_version = excluded.contract_version,
      snapshot = excluded.snapshot,
      updated_at = excluded.updated_at
    where public.public_session_snapshots.revision <= excluded.revision;
  end loop;

  return true;
end;
$$;

create or replace function public.commit_session_lifecycle(
  p_session_id text,
  p_operation_id text,
  p_action text,
  p_expected_revision bigint,
  p_next_state jsonb,
  p_occurred_at_ms bigint,
  p_end_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_revision bigint;
  v_current_status text;
  v_last_activity_at timestamptz;
  v_reconnect_deadline_at timestamptz;
  v_existing jsonb;
  v_committed_revision bigint := p_expected_revision + 1;
  v_occurred_at timestamptz := to_timestamp(p_occurred_at_ms / 1000.0);
  v_result jsonb;
begin
  if p_action not in ('start', 'end', 'expire') then
    raise exception using errcode = '22023', message = 'invalid-lifecycle-action';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_operation_id, 0));

  select result into v_existing
  from public.session_operations
  where operation_id = p_operation_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'result', v_existing);
  end if;

  select revision, status, last_activity_at, reconnect_deadline_at
  into v_current_revision, v_current_status, v_last_activity_at, v_reconnect_deadline_at
  from public.stream_sessions
  where session_id = p_session_id
  for update;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  select result into v_existing
  from public.session_operations
  where operation_id = p_operation_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'result', v_existing);
  end if;
  if v_current_revision <> p_expected_revision then
    return jsonb_build_object('status', 'stale', 'currentRevision', v_current_revision);
  end if;
  if p_action = 'start' and (
    v_current_status <> 'preparing'
    or v_last_activity_at <= v_occurred_at - interval '2 hours'
  ) then
    return jsonb_build_object('status', 'expired');
  end if;
  if p_action in ('end', 'expire') and v_current_status not in ('preparing', 'live') then
    return jsonb_build_object('status', 'expired');
  end if;
  if p_action = 'expire' and not (
    (v_current_status = 'preparing' and v_last_activity_at <= v_occurred_at - interval '2 hours')
    or (
      v_current_status = 'live'
      and v_reconnect_deadline_at is not null
      and v_reconnect_deadline_at <= v_occurred_at
    )
  ) then
    return jsonb_build_object('status', 'not-due');
  end if;
  if p_next_state #>> '{session,sessionId}' <> p_session_id
    or (p_next_state #>> '{session,revision}')::bigint <> v_committed_revision
    or (p_next_state #>> '{questCycle,envelope,revision}')::bigint <> v_committed_revision then
    raise exception using errcode = '22023', message = 'invalid-lifecycle-next-state';
  end if;
  if (p_action = 'start' and p_next_state #>> '{session,status}' <> 'live')
    or (
      p_action in ('end', 'expire')
      and v_current_status = 'preparing'
      and p_next_state #>> '{session,status}' <> 'offline'
    )
    or (
      p_action in ('end', 'expire')
      and v_current_status = 'live'
      and p_next_state #>> '{session,status}' <> 'ended'
    ) then
    raise exception using errcode = '22023', message = 'invalid-lifecycle-status-transition';
  end if;

  update public.stream_sessions set
    status = p_next_state #>> '{session,status}',
    revision = v_committed_revision,
    current_state = p_next_state,
    current_quest_cycle_id = p_next_state #>> '{questCycle,envelope,questCycleId}',
    last_activity_at = v_occurred_at,
    reconnect_deadline_at = null,
    started_at = case
      when p_next_state #>> '{session,startedAt}' is null then null
      else to_timestamp((p_next_state #>> '{session,startedAt}')::bigint / 1000.0)
    end,
    ended_at = case
      when p_next_state #>> '{session,endedAt}' is null then
        case when p_action in ('end', 'expire') then v_occurred_at else null end
      else to_timestamp((p_next_state #>> '{session,endedAt}')::bigint / 1000.0)
    end,
    end_reason = case when p_action in ('end', 'expire') then p_end_reason else null end,
    updated_at = v_occurred_at
  where session_id = p_session_id;

  insert into public.quest_cycles (
    session_id, quest_cycle_id, revision, status, state, created_at, updated_at
  ) values (
    p_session_id,
    p_next_state #>> '{questCycle,envelope,questCycleId}',
    v_committed_revision,
    p_next_state #>> '{questCycle,status}',
    p_next_state -> 'questCycle',
    v_occurred_at,
    v_occurred_at
  )
  on conflict (session_id, quest_cycle_id) do update set
    revision = excluded.revision,
    status = excluded.status,
    state = excluded.state,
    updated_at = excluded.updated_at;

  v_result := jsonb_build_object(
    'sessionId', p_session_id,
    'action', p_action,
    'revision', v_committed_revision,
    'state', p_next_state,
    'occurredAt', p_occurred_at_ms
  );

  insert into public.session_operations (
    operation_id, session_id, action, expected_revision, committed_revision,
    result, occurred_at
  ) values (
    p_operation_id,
    p_session_id,
    p_action,
    p_expected_revision,
    v_committed_revision,
    v_result,
    v_occurred_at
  );

  return jsonb_build_object('status', 'committed', 'result', v_result);
end;
$$;

create or replace function public.touch_session_presence(
  p_session_id text,
  p_action text,
  p_occurred_at_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurred_at timestamptz := to_timestamp(p_occurred_at_ms / 1000.0);
  v_result jsonb;
begin
  if p_action not in ('heartbeat', 'disconnect') then
    raise exception using errcode = '22023', message = 'invalid-presence-action';
  end if;

  update public.stream_sessions set
    last_activity_at = v_occurred_at,
    last_heartbeat_at = case when p_action = 'heartbeat' then v_occurred_at else last_heartbeat_at end,
    reconnect_deadline_at = case
      when p_action = 'heartbeat' then null
      else coalesce(reconnect_deadline_at, v_occurred_at + interval '10 minutes')
    end,
    updated_at = v_occurred_at
  where session_id = p_session_id and status = 'live' and last_activity_at <= v_occurred_at
  returning jsonb_build_object(
    'sessionId', session_id,
    'status', status,
    'revision', revision,
    'lastActivityAt', floor(extract(epoch from last_activity_at) * 1000)::bigint,
    'lastHeartbeatAt', case when last_heartbeat_at is null then null else floor(extract(epoch from last_heartbeat_at) * 1000)::bigint end,
    'reconnectDeadlineAt', case when reconnect_deadline_at is null then null else floor(extract(epoch from reconnect_deadline_at) * 1000)::bigint end
  ) into v_result;

  if not found then
    select jsonb_build_object(
      'sessionId', session_id,
      'status', status,
      'revision', revision,
      'lastActivityAt', floor(extract(epoch from last_activity_at) * 1000)::bigint,
      'lastHeartbeatAt', case when last_heartbeat_at is null then null else floor(extract(epoch from last_heartbeat_at) * 1000)::bigint end,
      'reconnectDeadlineAt', case when reconnect_deadline_at is null then null else floor(extract(epoch from reconnect_deadline_at) * 1000)::bigint end
    ) into v_result
    from public.stream_sessions
    where session_id = p_session_id and status = 'live';
    if found then
      return jsonb_build_object('status', 'ignored', 'result', v_result);
    end if;
    return jsonb_build_object('status', 'not-live');
  end if;
  return jsonb_build_object('status', 'updated', 'result', v_result);
end;
$$;

create or replace function public.broadcast_chatxpt_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'sessionId', new.session_id,
      'viewRole', new.view_role,
      'revision', new.revision,
      'snapshot', new.snapshot
    ),
    'snapshot',
    'chatxpt:' || new.session_id || ':' || new.view_role,
    true
  );
  return new;
end;
$$;

create or replace function public.can_receive_chatxpt_snapshot(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.realtime_access_grants as access
    where access.principal_id = auth.uid()
      and p_topic = 'chatxpt:' || access.session_id || ':' || access.view_role
      and access.revoked_at is null
      and access.expires_at > now()
  );
$$;

create trigger public_session_snapshots_broadcast
after insert or update on public.public_session_snapshots
for each row execute function public.broadcast_chatxpt_snapshot();

alter table public.streamer_profiles enable row level security;
alter table public.stream_sessions enable row level security;
alter table public.quest_cycles enable row level security;
alter table public.quest_candidate_batches enable row level security;
alter table public.command_receipts enable row level security;
alter table public.quest_events enable row level security;
alter table public.accepted_participation enable row level security;
alter table public.public_session_snapshots enable row level security;
alter table public.realtime_access_grants enable row level security;
alter table public.session_operations enable row level security;

revoke all on table public.streamer_profiles from anon, authenticated;
revoke all on table public.stream_sessions from anon, authenticated;
revoke all on table public.quest_cycles from anon, authenticated;
revoke all on table public.quest_candidate_batches from anon, authenticated;
revoke all on table public.command_receipts from anon, authenticated;
revoke all on table public.quest_events from anon, authenticated;
revoke all on table public.accepted_participation from anon, authenticated;
revoke all on table public.public_session_snapshots from anon, authenticated;
revoke all on table public.realtime_access_grants from anon, authenticated;
revoke all on table public.session_operations from anon, authenticated;

grant all on table public.streamer_profiles to service_role;
grant all on table public.stream_sessions to service_role;
grant all on table public.quest_cycles to service_role;
grant all on table public.quest_candidate_batches to service_role;
grant all on table public.command_receipts to service_role;
grant all on table public.quest_events to service_role;
grant all on table public.accepted_participation to service_role;
grant all on table public.public_session_snapshots to service_role;
grant all on table public.realtime_access_grants to service_role;
grant all on table public.session_operations to service_role;

revoke all on function public.bootstrap_chatxpt_session(text, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.commit_authoritative_state(text, text, text, bigint, jsonb, jsonb, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.persist_role_snapshots(text, bigint, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.commit_session_lifecycle(text, text, text, bigint, jsonb, bigint, text) from public, anon, authenticated;
revoke all on function public.touch_session_presence(text, text, bigint) from public, anon, authenticated;
revoke all on function public.can_receive_chatxpt_snapshot(text) from public, anon;

grant execute on function public.bootstrap_chatxpt_session(text, jsonb, bigint) to service_role;
grant execute on function public.commit_authoritative_state(text, text, text, bigint, jsonb, jsonb, jsonb, bigint) to service_role;
grant execute on function public.persist_role_snapshots(text, bigint, jsonb, bigint) to service_role;
grant execute on function public.commit_session_lifecycle(text, text, text, bigint, jsonb, bigint, text) to service_role;
grant execute on function public.touch_session_presence(text, text, bigint) to service_role;
grant execute on function public.can_receive_chatxpt_snapshot(text) to authenticated;
revoke all on function public.broadcast_chatxpt_snapshot() from public, anon, authenticated;

-- Realtime is read-only for clients. The server grants an authenticated
-- Supabase principal one short-lived session/view membership. No INSERT policy
-- is created, so browser clients cannot publish authoritative messages.
create policy chatxpt_private_snapshot_read
on realtime.messages
for select
to authenticated
using (
  (select public.can_receive_chatxpt_snapshot((select realtime.topic())))
);

comment on table public.public_session_snapshots is
  'Role-sanitised reconnect snapshots. Direct client table access is denied; server APIs and private Realtime broadcasts expose authorised views.';
comment on table public.accepted_participation is
  'Audit facts for server-accepted vote/reaction commands. Quest winner and vote-change rules remain Role 3 decisions.';
