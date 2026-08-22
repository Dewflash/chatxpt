begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select has_table('public', 'streamer_accounts', 'streamer_accounts exists');
select has_table('public', 'connected_identities', 'connected_identities exists');
select has_column('public', 'streamer_profiles', 'account_id', 'profiles have internal account ownership');
select has_column('public', 'stream_sessions', 'account_id', 'sessions have internal account ownership');
select ok(
  to_regprocedure('public.get_or_create_streamer_profile(text,text,text,jsonb,bigint)') is not null,
  'verified profile resolver exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.streamer_accounts'::regclass),
  'RLS is enabled on streamer accounts'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.connected_identities'::regclass),
  'RLS is enabled on connected identities'
);
select ok(
  not has_table_privilege('authenticated', 'public.connected_identities', 'select'),
  'authenticated clients cannot read connected identities directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_or_create_streamer_profile(text,text,text,jsonb,bigint)',
    'execute'
  ),
  'anonymous clients cannot resolve streamer profiles'
);

create temporary table profile_resolution_results (
  label text primary key,
  result jsonb not null
);

insert into profile_resolution_results (label, result)
values
  (
    'account-a',
    public.get_or_create_streamer_profile(
      'twitch',
      'pgtap-account-a',
      'PgTap Account A',
      jsonb_build_object(
        'profileId', 'profile-pgtap-account-a',
        'streamerId', 'pgtap-account-a',
        'revision', 0,
        'displayName', 'PgTap Account A',
        'gameId', null,
        'gameName', null,
        'experience', jsonb_build_object('intensity', 0.5, 'creativity', 0.5),
        'restrictions', '[]'::jsonb,
        'preferredQuestTypes', '[]'::jsonb,
        'forbiddenQuestTypes', '[]'::jsonb,
        'accessibilityNeeds', '[]'::jsonb
      ),
      1787337600000
    )
  ),
  (
    'account-b',
    public.get_or_create_streamer_profile(
      'twitch',
      'pgtap-account-b',
      'PgTap Account B',
      jsonb_build_object(
        'profileId', 'profile-pgtap-account-b',
        'streamerId', 'pgtap-account-b',
        'revision', 0,
        'displayName', 'PgTap Account B',
        'gameId', null,
        'gameName', null,
        'experience', jsonb_build_object('intensity', 0.5, 'creativity', 0.5),
        'restrictions', '[]'::jsonb,
        'preferredQuestTypes', '[]'::jsonb,
        'forbiddenQuestTypes', '[]'::jsonb,
        'accessibilityNeeds', '[]'::jsonb
      ),
      1787337600000
    )
  );

select ok(
  (select result #>> '{accountId}' from profile_resolution_results where label = 'account-a')
    <>
  (select result #>> '{accountId}' from profile_resolution_results where label = 'account-b'),
  'different Twitch identities resolve to different internal accounts'
);
select is(
  (
    select count(*)
    from public.connected_identities as identity
    join public.streamer_profiles as profile using (account_id)
    where identity.provider = 'twitch'
      and identity.provider_subject_id in ('pgtap-account-a', 'pgtap-account-b')
      and profile.streamer_id = identity.provider_subject_id
  ),
  2::bigint,
  'each Twitch identity owns only its matching profile'
);
select is(
  (
    public.get_or_create_streamer_profile(
      'twitch',
      'pgtap-account-a',
      'PgTap Account A Renamed',
      jsonb_build_object(
        'profileId', 'profile-pgtap-account-a-retry',
        'streamerId', 'pgtap-account-a',
        'revision', 0
      ),
      1787337601000
    ) #>> '{accountId}'
  ),
  (select result #>> '{accountId}' from profile_resolution_results where label = 'account-a'),
  'reconnecting the same Twitch identity returns the same internal account'
);

select * from finish();
rollback;
