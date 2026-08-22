-- Add the authoritative winner-reveal phase used by Studio, Twitch viewers,
-- and OBS before a quest becomes active. Existing JSON profile rows need no
-- rewrite because the canonical parser supplies the new voting defaults.

alter table public.quest_cycles
  drop constraint if exists quest_cycles_status_check;

alter table public.quest_cycles
  add constraint quest_cycles_status_check check (
    status in (
      'idle', 'evaluating', 'proposed', 'voting', 'selected', 'active',
      'succeeded', 'failed', 'cancelled', 'skipped', 'expired', 'cooldown'
    )
  );
