# Realtime public entrypoint

Role 1 owns authoritative command handling, persistence ordering, revisions, snapshot recovery, and broadcast composition. Transport-specific clients must stay behind this entrypoint.

The public entrypoint now provides the credential-free memory persistence,
server command-permission policy, session lifecycle service, and private
Supabase snapshot subscriber used by role-owned clients. Server composition
imports `@/realtime/server` for environment validation and Supabase service-role
adapters; client code must never import that server entrypoint.

Browser composition imports `@/realtime/browser`. Its `FetchUiGatewayClient`
validates every read and command result against the canonical Core gateway
schemas, sends scoped bearer capabilities when supplied, keeps same-origin
credentials available for HTTP-only sessions, and marks mutations for the
server's origin/CSRF policy. Role-owned components receive the safe client or
callbacks from thin app mounts; they do not import server composition.

Authoritative writes always flow through the Role 1 orchestrator or lifecycle
service. The Supabase publisher persists role-sanitised snapshots through a
restricted RPC, and the database broadcasts them only after commit. Reconnecting
clients join the private channel first and then fetch their latest authorised
snapshot, discarding duplicate or older revisions.

Local memory mode is a real development fallback, not evidence of shared-cloud
or multi-browser Supabase execution. See `supabase/README.md` for that boundary.

The R1-015 diagnostic gateway is fixture-only and lives behind the server-only
`CHATXPT_ENABLE_DIAGNOSTIC_HARNESS=true` development flag. Its Studio, Config,
Live Config, viewer, hosted-board, and overlay hosts are permanently labelled
`NOT LIVE EVIDENCE`; production always returns 404 even if the flag is set.
See `docs/architecture/UI-GATEWAY-HARNESS.md` for the contract and commands.
