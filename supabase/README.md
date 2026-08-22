# Supabase foundation

The committed migration is the authority for ChatXPT persistence. Do not create
or change product tables only through the dashboard.

## Local database verification

The Supabase CLI requires a Docker-compatible runtime. When both are installed:

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
npm run supabase:test
```

The reset applies every migration and the intentionally empty seed. Never run a
linked reset against a shared or production project.

## Shared preview project

Role 1 creates one Supabase Free project, links it locally, previews pending
migrations, and then applies them:

```bash
supabase link --project-ref <preview-project-ref>
supabase db push --dry-run
supabase db push
```

Configure Realtime to require private channels. Runtime clients subscribe to
`chatxpt:<session-id>:<streamer|viewer|overlay>` with an authenticated Supabase
session. Role 1 grants that principal short-lived membership in exactly one
authorised session/view topic after ChatXPT authentication. Clients receive
snapshots only; all commands go through ChatXPT's server authority. Anonymous
viewers may use Supabase anonymous Auth, but ChatXPT still grants their topic
membership server-side.

Enable Supabase anonymous sign-ins for the project. Studio, viewer, and OBS
clients use an anonymous Supabase session only as a short-lived private-channel
principal. ChatXPT separately verifies the Studio, Twitch, hosted-board, or OBS
surface authority before granting that principal one session/role topic. A
shared broadcast never contains a viewer's accepted choice or personal points;
viewer push events trigger the viewer-authorised recovery read.

## Reality boundary

Committed SQL and application tests are not proof that the shared cloud project
is configured. Record CLI output and a real two-client round trip separately
when Role 1 has project credentials and a compatible local runtime.
