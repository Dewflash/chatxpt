# Realtime public entrypoint

Role 1 owns authoritative command handling, persistence ordering, revisions, snapshot recovery, and broadcast composition. Transport-specific clients must stay behind this entrypoint.

This slice exports contracts only. It does not claim that Supabase, authentication, persistence, or realtime broadcasting is implemented.
