-- Enforce D-047: one immutable accepted vote per private viewer identity and cycle.
-- The opaque voterKey is derived and verified server-side; it is not broadcast.

alter table public.accepted_participation
  add constraint accepted_vote_requires_identity_and_source
  check (
    participation_type <> 'vote'
    or (
      payload ? 'voterKey'
      and char_length(payload #>> '{voterKey}') between 1 and 128
      and payload #>> '{sourceMode}' in ('twitch-extension', 'hosted-board', 'twitch-chat')
    )
  ) not valid;

create unique index accepted_participation_one_vote_per_voter_cycle
  on public.accepted_participation (session_id, quest_cycle_id, (payload #>> '{voterKey}'))
  where participation_type = 'vote' and payload ? 'voterKey';

comment on index public.accepted_participation_one_vote_per_voter_cycle is
  'Makes the first accepted vote final across Twitch Extension, hosted board, and Twitch chat.';
