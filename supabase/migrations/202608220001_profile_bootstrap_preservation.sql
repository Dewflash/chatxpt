-- Preserve saved streamer profiles when a new session is bootstrapped.

create or replace function public.enforce_streamer_profile_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.revision < old.revision then
    raise exception using errcode = '22023', message = 'profile-revision-cannot-move-backwards';
  end if;
  if new.revision > old.revision + 1 then
    raise exception using errcode = '22023', message = 'profile-revision-must-advance-once';
  end if;
  if new.revision = old.revision and (
    new.profile_id is distinct from old.profile_id
    or new.contract_version is distinct from old.contract_version
    or new.profile is distinct from old.profile
  ) then
    raise exception using errcode = '22023', message = 'profile-content-requires-new-revision';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_streamer_profile_revision on public.streamer_profiles;
create trigger enforce_streamer_profile_revision
before update on public.streamer_profiles
for each row execute function public.enforce_streamer_profile_revision();

revoke all on function public.enforce_streamer_profile_revision() from public, anon, authenticated;

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
  v_profile_rows integer;
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
    updated_at = public.streamer_profiles.updated_at
  where public.streamer_profiles.profile_id = excluded.profile_id
    and public.streamer_profiles.contract_version = excluded.contract_version
    and public.streamer_profiles.revision = excluded.revision
    and public.streamer_profiles.profile = excluded.profile;

  get diagnostics v_profile_rows = row_count;
  if v_profile_rows <> 1 then
    raise exception using errcode = '22023', message = 'profile-bootstrap-mismatch';
  end if;

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

revoke all on function public.bootstrap_chatxpt_session(text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.bootstrap_chatxpt_session(text, jsonb, bigint) to service_role;
