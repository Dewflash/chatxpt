-- Persistent, revocable OBS Browser Source pairing. The URL is read-only and
-- follows the broadcaster's current active ChatXPT session.

create table public.obs_overlay_connections (
  broadcaster_id text primary key references public.streamer_profiles(streamer_id) on delete cascade,
  grant_id text not null unique,
  issued_at timestamptz not null,
  last_seen_at timestamptz,
  last_session_id text,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (char_length(broadcaster_id) between 1 and 128),
  check (char_length(grant_id) between 1 and 128),
  check (last_session_id is null or char_length(last_session_id) between 1 and 128),
  check (last_seen_at is null or last_seen_at >= issued_at),
  check (revoked_at is null or revoked_at >= issued_at)
);

create index obs_overlay_connections_active_grant
  on public.obs_overlay_connections (grant_id)
  where revoked_at is null;

alter table public.obs_overlay_connections enable row level security;

revoke all on table public.obs_overlay_connections from anon, authenticated;
grant all on table public.obs_overlay_connections to service_role;

comment on table public.obs_overlay_connections is
  'Server-owned read-only OBS pairing metadata. Browser Source bearer values are signed and never stored in this table.';
