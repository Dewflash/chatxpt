-- Session-scoped, private viewer rewards for ICP-07.
-- The voter key is an opaque session-derived pseudonym and is never published.

create table public.viewer_cycle_rewards (
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  quest_cycle_id text not null,
  voter_key text not null,
  reward_points integer not null check (reward_points > 0 and reward_points <= 100000),
  awarded_at timestamptz not null,
  primary key (session_id, quest_cycle_id, voter_key),
  check (char_length(voter_key) between 1 and 128)
);

create table public.viewer_session_points (
  session_id text not null references public.stream_sessions(session_id) on delete cascade,
  voter_key text not null,
  session_points integer not null default 0 check (session_points >= 0 and session_points <= 100000),
  updated_at timestamptz not null default now(),
  primary key (session_id, voter_key),
  check (char_length(voter_key) between 1 and 128)
);

create or replace function public.award_chatxpt_viewer_session_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward_points integer;
begin
  if new.payload #>> '{event,attributes,outcome}' <> 'succeeded' then
    return new;
  end if;
  v_reward_points := coalesce((new.payload #>> '{event,attributes,rewardPointsAwarded}')::integer, 0);
  if v_reward_points <= 0 or new.quest_cycle_id is null then
    return new;
  end if;

  with newly_awarded as (
    insert into public.viewer_cycle_rewards (
      session_id, quest_cycle_id, voter_key, reward_points, awarded_at
    )
    select
      new.session_id,
      new.quest_cycle_id,
      participation.payload #>> '{voterKey}',
      least(v_reward_points, 100000),
      new.occurred_at
    from public.accepted_participation participation
    where participation.session_id = new.session_id
      and participation.quest_cycle_id = new.quest_cycle_id
      and participation.participation_type = 'vote'
      and participation.payload ? 'voterKey'
    on conflict (session_id, quest_cycle_id, voter_key) do nothing
    returning session_id, voter_key, reward_points
  )
  insert into public.viewer_session_points (session_id, voter_key, session_points, updated_at)
  select session_id, voter_key, reward_points, new.occurred_at
  from newly_awarded
  on conflict (session_id, voter_key) do update set
    session_points = least(
      100000,
      public.viewer_session_points.session_points + excluded.session_points
    ),
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create trigger quest_events_award_viewer_session_points
after insert on public.quest_events
for each row execute function public.award_chatxpt_viewer_session_points();

alter table public.viewer_cycle_rewards enable row level security;
alter table public.viewer_session_points enable row level security;
revoke all on table public.viewer_cycle_rewards from anon, authenticated;
revoke all on table public.viewer_session_points from anon, authenticated;
grant all on table public.viewer_cycle_rewards to service_role;
grant all on table public.viewer_session_points to service_role;

comment on table public.viewer_session_points is
  'Private session-scoped points keyed by an opaque viewer pseudonym; no cross-stream economy.';
