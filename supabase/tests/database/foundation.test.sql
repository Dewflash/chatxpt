begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

select has_table('public', 'streamer_profiles', 'streamer_profiles exists');
select has_table('public', 'stream_sessions', 'stream_sessions exists');
select has_table('public', 'quest_cycles', 'quest_cycles exists');
select has_table('public', 'quest_candidate_batches', 'quest_candidate_batches exists');
select has_table('public', 'command_receipts', 'command_receipts exists');
select has_table('public', 'quest_events', 'quest_events exists');
select has_table('public', 'accepted_participation', 'accepted_participation exists');
select has_table('public', 'public_session_snapshots', 'public_session_snapshots exists');
select has_table('public', 'realtime_access_grants', 'realtime_access_grants exists');
select has_table('public', 'session_operations', 'session_operations exists');

select ok(to_regclass('public.raw_chat') is null, 'raw chat is not persisted');
select has_index(
  'public',
  'stream_sessions',
  'stream_sessions_one_active_broadcaster',
  'one active session per broadcaster index exists'
);
select has_index(
  'public',
  'accepted_participation',
  'accepted_participation_one_vote_per_voter_cycle',
  'one accepted vote per private viewer identity and cycle index exists'
);
select ok(
  not exists (
    select 1
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname in (
        'streamer_profiles', 'stream_sessions', 'quest_cycles',
        'quest_candidate_batches', 'command_receipts', 'quest_events',
        'accepted_participation', 'public_session_snapshots',
        'realtime_access_grants', 'session_operations'
      )
      and not pg_class.relrowsecurity
  ),
  'RLS is enabled on every ChatXPT table'
);
select ok(
  not has_table_privilege('anon', 'public.stream_sessions', 'select'),
  'anon cannot read authoritative sessions directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.public_session_snapshots', 'select'),
  'authenticated clients cannot read snapshot rows directly'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'chatxpt_private_snapshot_read'
      and cmd = 'SELECT'
  ),
  'private snapshot receive policy exists'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and cmd = 'INSERT'
      and policyname like 'chatxpt%'
  ),
  'ChatXPT clients have no realtime publish policy'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.commit_authoritative_state(text,text,text,bigint,jsonb,jsonb,jsonb,bigint)'::regprocedure),
  'atomic command commit is security definer'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.commit_authoritative_state(text,text,text,bigint,jsonb,jsonb,jsonb,bigint)',
    'execute'
  ),
  'anon cannot execute atomic command commits'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.commit_authoritative_state(text,text,text,bigint,jsonb,jsonb,jsonb,bigint)',
    'execute'
  ),
  'service role can execute atomic command commits'
);

select * from finish();
rollback;
