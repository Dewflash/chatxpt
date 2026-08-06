-- Expose only due canonical voting states to the trusted Role 1 scheduler.

create or replace function public.due_vote_cycle_states(p_due_at_ms bigint)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select current_state
  from public.stream_sessions
  where status = 'live'
    and current_state #>> '{questCycle,status}' = 'voting'
    and current_state #>> '{questCycle,endsAt}' is not null
    and (current_state #>> '{questCycle,endsAt}')::bigint <= p_due_at_ms
  order by (current_state #>> '{questCycle,endsAt}')::bigint,
           session_id;
$$;

revoke all on function public.due_vote_cycle_states(bigint) from public, anon, authenticated;
grant execute on function public.due_vote_cycle_states(bigint) to service_role;

comment on function public.due_vote_cycle_states(bigint) is
  'Returns due live voting states to the trusted system.vote-close scheduler only.';
