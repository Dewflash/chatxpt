# Realtime public entrypoint

Role 1 owns authoritative command handling, persistence ordering, revisions, snapshot recovery, and broadcast composition. Transport-specific clients must stay behind this entrypoint.

The public entrypoint now provides the credential-free memory persistence,
server command-permission policy, session lifecycle service, and private
Supabase snapshot subscriber used by role-owned clients. Server composition
imports `@/realtime/server` for environment validation and Supabase service-role
adapters; client code must never import that server entrypoint.

Authoritative writes always flow through the Role 1 orchestrator or lifecycle
service. The Supabase publisher persists role-sanitised snapshots through a
restricted RPC, and the database broadcasts them only after commit. Reconnecting
clients join the private channel first and then fetch their latest authorised
snapshot, discarding duplicate or older revisions.

Local memory mode is a real development fallback, not evidence of shared-cloud
or multi-browser Supabase execution. See `supabase/README.md` for that boundary.

## Authoritative vote ledger

All three MVP participation paths converge on the same private ledger. A vote
command carries an opaque, session-scoped `voterKey` and a participation source
that the server authorizer must match to trusted identity context. The first
accepted vote for that key and quest cycle is final; a later command from the
same viewer is rejected atomically without advancing session state.

At the voting deadline, the trusted `system.vote-close` command asks the ledger
for the three candidate counts accepted strictly before the deadline. Role 1
passes the validated counts, accepted-vote total, revision, and server close
time to Role 3. The tally contract intentionally has no winner field: majority,
tie, zero-vote, legality, and activation remain Role 3 decisions.

The memory adapter implements this behavior for credential-free development.
The Supabase adapter reads the server-only `accepted_participation` audit table,
and the additive migration enforces the same one-vote rule across Twitch
Extension, hosted-board, and Twitch-chat sources. Static tests do not claim the
migration has run against a live Supabase project.

## Viewer recovery and fallbacks

Role 1 exposes three render-safe participation seams for Role 5:

- `PrivateViewerRecovery` restores only the current viewer's accepted candidate, accepted time, source, and session points. Shared broadcasts must clear it.
- `HostedBoardDiscovery` resolves an active eight-character room code into a hosted-board URL and optional QR URL. Unavailable rooms expose no join details.
- `TwitchChatVoteAcknowledgement` reports unavailable, not-delivered, pending, counted, duplicate, late, or rejected status. Role 5 renders the status but never parses Twitch chat or claims a vote was delivered without this server-side acknowledgement.

The memory runtime implements recovery and hosted discovery for local development. The server-side Supabase adapter reads the existing session and accepted-participation tables for the same seams. Real Twitch chat ingestion/delivery and live Supabase cloud recovery remain separate evidence requirements.
