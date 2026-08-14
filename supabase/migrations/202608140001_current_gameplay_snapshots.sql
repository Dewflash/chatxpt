-- Bounded, server-only latest gameplay state. Frame observations never advance
-- the authoritative command revision; they are sampled into command state by
-- the Role 1 orchestrator only when a command is accepted.

create table public.current_gameplay_snapshots (
  session_id text primary key references public.stream_sessions(session_id) on delete cascade,
  quest_cycle_id text,
  revision bigint not null check (revision >= 0),
  evidence_class text not null check (evidence_class in ('live', 'diagnostic', 'fixture')),
  occurred_at_ms bigint not null check (occurred_at_ms >= 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.current_gameplay_snapshots enable row level security;
revoke all on table public.current_gameplay_snapshots from anon, authenticated;
grant all on table public.current_gameplay_snapshots to service_role;

create or replace function public.ingest_gameplay_snapshot(p_snapshot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id text := p_snapshot #>> '{envelope,sessionId}';
  v_quest_cycle_id text := p_snapshot #>> '{envelope,questCycleId}';
  v_revision bigint := (p_snapshot #>> '{envelope,revision}')::bigint;
  v_evidence_class text := p_snapshot #>> '{envelope,evidenceClass}';
  v_occurred_at_ms bigint := (p_snapshot #>> '{envelope,occurredAt}')::bigint;
  v_status text;
  v_state jsonb;
  v_existing public.current_gameplay_snapshots%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_session_id, 1));

  select status, current_state
    into v_status, v_state
  from public.stream_sessions
  where session_id = v_session_id
  for share;

  if not found then
    return jsonb_build_object('status', 'rejected', 'reason', 'session-missing');
  end if;
  if v_status not in ('preparing', 'live') then
    return jsonb_build_object('status', 'rejected', 'reason', 'session-inactive');
  end if;
  if v_revision is distinct from (v_state #>> '{session,revision}')::bigint
    or v_quest_cycle_id is distinct from (v_state #>> '{questCycle,envelope,questCycleId}')
    or v_evidence_class is distinct from (v_state #>> '{questCycle,envelope,evidenceClass}') then
    return jsonb_build_object('status', 'rejected', 'reason', 'state-mismatch');
  end if;

  select * into v_existing
  from public.current_gameplay_snapshots
  where session_id = v_session_id
  for update;

  if found and v_existing.snapshot = p_snapshot then
    return jsonb_build_object('status', 'duplicate', 'snapshot', v_existing.snapshot);
  end if;
  if found and (
    v_existing.revision > v_revision
    or (v_existing.revision = v_revision and v_existing.occurred_at_ms >= v_occurred_at_ms)
  ) then
    return jsonb_build_object('status', 'rejected', 'reason', 'older-snapshot');
  end if;

  insert into public.current_gameplay_snapshots (
    session_id,
    quest_cycle_id,
    revision,
    evidence_class,
    occurred_at_ms,
    snapshot,
    updated_at
  ) values (
    v_session_id,
    v_quest_cycle_id,
    v_revision,
    v_evidence_class,
    v_occurred_at_ms,
    p_snapshot,
    now()
  )
  on conflict (session_id) do update set
    quest_cycle_id = excluded.quest_cycle_id,
    revision = excluded.revision,
    evidence_class = excluded.evidence_class,
    occurred_at_ms = excluded.occurred_at_ms,
    snapshot = excluded.snapshot,
    updated_at = excluded.updated_at;

  return jsonb_build_object('status', 'accepted', 'snapshot', p_snapshot);
end;
$$;

revoke all on function public.ingest_gameplay_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_gameplay_snapshot(jsonb) to service_role;

comment on table public.current_gameplay_snapshots is
  'Latest canonical gameplay snapshot per session. Server-only and non-revisioned; no raw frames are stored.';
