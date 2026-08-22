-- Add durable internal ownership without changing Twitch as the MVP authority.

do $$
begin
  if exists (
    select 1
    from public.streamer_profiles
    where profile #>> '{streamerId}' is distinct from streamer_id
      or profile #>> '{profileId}' is distinct from profile_id
      or (profile #>> '{revision}')::bigint is distinct from revision
  ) then
    raise exception using errcode = '22023', message = 'invalid-existing-streamer-profile';
  end if;
end;
$$;

alter table public.streamer_profiles
  add constraint streamer_profiles_json_owner_check
    check (profile #>> '{streamerId}' = streamer_id),
  add constraint streamer_profiles_json_profile_id_check
    check (profile #>> '{profileId}' = profile_id),
  add constraint streamer_profiles_json_revision_check
    check ((profile #>> '{revision}')::bigint = revision);

create table public.streamer_accounts (
  account_id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status = 'deleted') = (deleted_at is not null))
);

alter table public.streamer_profiles add column account_id uuid;
update public.streamer_profiles set account_id = gen_random_uuid() where account_id is null;

insert into public.streamer_accounts (account_id, created_at, updated_at)
select account_id, created_at, updated_at
from public.streamer_profiles;

alter table public.streamer_profiles
  alter column account_id set not null,
  add constraint streamer_profiles_account_id_key unique (account_id),
  add constraint streamer_profiles_account_id_fkey
    foreign key (account_id) references public.streamer_accounts(account_id);

create table public.connected_identities (
  identity_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.streamer_accounts(account_id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 32),
  provider_subject_id text not null check (char_length(provider_subject_id) between 1 and 128),
  display_name text not null check (char_length(display_name) between 1 and 80),
  verified_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subject_id),
  unique (account_id, provider)
);

insert into public.connected_identities (
  account_id, provider, provider_subject_id, display_name,
  verified_at, last_seen_at, created_at, updated_at
)
select
  account_id,
  'twitch',
  streamer_id,
  coalesce(nullif(profile #>> '{displayName}', ''), 'Streamer'),
  created_at,
  updated_at,
  created_at,
  updated_at
from public.streamer_profiles;

alter table public.stream_sessions add column account_id uuid;
update public.stream_sessions as sessions
set account_id = profiles.account_id
from public.streamer_profiles as profiles
where profiles.streamer_id = sessions.broadcaster_id;

do $$
begin
  if exists (select 1 from public.streamer_profiles where account_id is null)
    or exists (select 1 from public.stream_sessions where account_id is null)
    or exists (
      select provider, provider_subject_id
      from public.connected_identities
      group by provider, provider_subject_id
      having count(*) <> 1
    ) then
    raise exception using errcode = '22023', message = 'account-identity-backfill-incomplete';
  end if;
end;
$$;

alter table public.stream_sessions
  alter column account_id set not null,
  add constraint stream_sessions_account_id_fkey
    foreign key (account_id) references public.streamer_accounts(account_id);

create index stream_sessions_account_created
  on public.stream_sessions (account_id, created_at desc);

alter table public.streamer_accounts enable row level security;
alter table public.connected_identities enable row level security;
revoke all on table public.streamer_accounts from anon, authenticated;
revoke all on table public.connected_identities from anon, authenticated;
grant all on table public.streamer_accounts to service_role;
grant all on table public.connected_identities to service_role;

create or replace function public.get_or_create_streamer_profile(
  p_provider text,
  p_provider_subject_id text,
  p_display_name text,
  p_default_profile jsonb,
  p_verified_at_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_profile public.streamer_profiles%rowtype;
  v_created boolean := false;
  v_verified_at timestamptz := to_timestamp(p_verified_at_ms / 1000.0);
begin
  if p_provider <> 'twitch'
    or p_verified_at_ms < 0
    or p_provider_subject_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or char_length(btrim(p_display_name)) not between 1 and 80
    or jsonb_typeof(p_default_profile) <> 'object'
    or p_default_profile #>> '{streamerId}' <> p_provider_subject_id
    or (p_default_profile #>> '{revision}')::bigint <> 0 then
    raise exception using errcode = '22023', message = 'invalid-verified-profile-resolution';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_provider || ':' || p_provider_subject_id, 0)
  );

  select identity.account_id
  into v_account_id
  from public.connected_identities as identity
  where identity.provider = p_provider
    and identity.provider_subject_id = p_provider_subject_id
  for update;

  if found then
    select * into strict v_profile
    from public.streamer_profiles
    where account_id = v_account_id
    for update;
  else
    select * into v_profile
    from public.streamer_profiles
    where streamer_id = p_provider_subject_id
    for update;

    if found then
      v_account_id := v_profile.account_id;
      insert into public.connected_identities (
        account_id, provider, provider_subject_id, display_name,
        verified_at, last_seen_at, created_at, updated_at
      ) values (
        v_account_id, p_provider, p_provider_subject_id, btrim(p_display_name),
        v_verified_at, v_verified_at, v_verified_at, v_verified_at
      );
    else
      v_account_id := gen_random_uuid();
      insert into public.streamer_accounts (account_id, created_at, updated_at)
      values (v_account_id, v_verified_at, v_verified_at);
      insert into public.connected_identities (
        account_id, provider, provider_subject_id, display_name,
        verified_at, last_seen_at, created_at, updated_at
      ) values (
        v_account_id, p_provider, p_provider_subject_id, btrim(p_display_name),
        v_verified_at, v_verified_at, v_verified_at, v_verified_at
      );
      insert into public.streamer_profiles (
        streamer_id, profile_id, contract_version, revision, profile,
        account_id, created_at, updated_at
      ) values (
        p_provider_subject_id,
        p_default_profile #>> '{profileId}',
        '1.0.0',
        0,
        p_default_profile,
        v_account_id,
        v_verified_at,
        v_verified_at
      ) returning * into v_profile;
      v_created := true;
    end if;
  end if;

  update public.connected_identities
  set display_name = btrim(p_display_name),
      last_seen_at = v_verified_at,
      updated_at = v_verified_at
  where provider = p_provider
    and provider_subject_id = p_provider_subject_id;

  return jsonb_build_object(
    'accountId', v_account_id,
    'profile', v_profile.profile,
    'createdAt', floor(extract(epoch from v_profile.created_at) * 1000)::bigint,
    'updatedAt', floor(extract(epoch from v_profile.updated_at) * 1000)::bigint,
    'created', v_created
  );
end;
$$;

revoke all on function public.get_or_create_streamer_profile(text, text, text, jsonb, bigint)
  from public, anon, authenticated;
grant execute on function public.get_or_create_streamer_profile(text, text, text, jsonb, bigint)
  to service_role;

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
  v_account_id uuid;
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
  if (p_state #>> '{session,createdAt}')::bigint <> p_created_at_ms
    or (p_state #>> '{questCycle,envelope,revision}')::bigint <> v_revision
    or p_state #>> '{profile,streamerId}' <> v_broadcaster_id then
    raise exception using errcode = '22023', message = 'invalid-bootstrap-state';
  end if;

  select account_id into v_account_id
  from public.streamer_profiles
  where streamer_id = v_broadcaster_id
    and profile_id = v_profile_id
    and contract_version = p_state #>> '{questCycle,envelope,contractVersion}'
    and revision = (p_state #>> '{profile,revision}')::bigint
    and profile = p_state -> 'profile'
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'profile-bootstrap-mismatch';
  end if;

  insert into public.stream_sessions (
    session_id, broadcaster_id, account_id, room_code, platform, status, revision,
    contract_version, current_quest_cycle_id, current_state, last_activity_at,
    created_at, started_at, ended_at, updated_at
  ) values (
    v_session_id,
    v_broadcaster_id,
    v_account_id,
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
