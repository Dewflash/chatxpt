# Integration tests

Role 1 owns this directory. Tests here exercise only public role entrypoints and canonical fixtures; they must not import another role's private implementation files.

Contract fixtures prove compatibility, not Twitch, OBS, AI, extraction, UI, or
judged end-to-end behavior. The Role 1 persistence suite additionally executes
the production-shaped memory runtime, permission/lifecycle services, Supabase
adapter validation, private-subscriber recovery behavior, and static
migration/security regressions. The persistence suite also verifies first-vote
finality across participation sources, deadline-bounded tally reads, due-cycle
selection, stable close-command identities, retry behavior, and concurrent
sweeps. It still does not claim that migrations, RLS, WebSockets, or a durable
production scheduler trigger ran against a real database.

Executable database assertions live under `supabase/tests/database/` and run
with `npm run supabase:test` after the local Supabase stack is available.
