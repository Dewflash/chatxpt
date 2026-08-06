# Realtime public entrypoint

Role 1 owns authoritative command handling, persistence ordering, revisions, snapshot recovery, and broadcast composition. Transport-specific clients must stay behind this entrypoint.

The public entrypoint now provides the credential-free memory persistence,
server command-permission policy, session lifecycle service, browser-safe UI
gateway client, and private Supabase snapshot subscriber used by role-owned
clients. Server composition imports `@/realtime/server` for environment
validation and Supabase service-role adapters; client code must never import
that server entrypoint.

## Browser UI gateway client

Role-owned client modules should use `FetchUiGatewayClient` from `@/realtime`
when they need to read a Role 1-authorised snapshot or dispatch a canonical
command from a browser surface. The client sends same-origin credentials, can add
a scoped bearer token when the host provides one, marks command POSTs with
`x-chatxpt-command`, and maps malformed responses, transport failures, and token
provider failures into typed domain errors instead of throwing through UI code.
It accepts both quest/runtime `CommandEnvelope` values and Role 1-owned
streamer setup/session service commands.

The current endpoint defaults to the fixture-only diagnostic gateway. That route
is production-disabled unless Role 1 explicitly enables diagnostics, so passing
tests here prove browser command/read shape and failure handling only; they do
not prove live Twitch, OBS, Supabase, or deployed authentication behaviour.

Setup and session service commands are diagnostic-only in the local gateway
until Role 1 wires real Twitch/OBS/session operations. They return the current
authoritative revision and a readiness fixture so UI consumers can render
success, stale, forbidden, and blocked states without becoming the authority.
`FetchUiGatewayClient.dispatch()` preserves that typed `serviceCommand` result
when present, letting browser UI code update setup readiness from the same
acknowledged command response while keeping real service execution behind Role
1.

Authoritative writes always flow through the Role 1 orchestrator or lifecycle
service. The Supabase publisher persists role-sanitised snapshots through a
restricted RPC, and the database broadcasts them only after commit. Reconnecting
clients join the private channel first and then fetch their latest authorised
snapshot, discarding duplicate or older revisions.

Local memory mode is a real development fallback, not evidence of shared-cloud
or multi-browser Supabase execution. See `supabase/README.md` for that boundary.

## Environment Health

The server-only environment resolver also powers `/api/health`. The route
reports deployment mode, persistence mode, safe service health for persistence,
Twitch app, Twitch Extension, and OBS overlay setup, plus public Supabase
realtime configuration when Supabase is fully configured. It never includes
server-only Supabase, Twitch, or OBS setup secrets. A healthy local response can
still show external services as unavailable; that means the credential-free
fallback is active, not that live Twitch, OBS, Vercel, or Supabase evidence has
been executed.

The Next.js app-level headers include a first-party CSP for deployment previews:
WASM/blob workers are allowed for the accepted selective-OCR dependency, network
connections are scoped to same-origin plus Supabase HTTPS/WSS, Twitch frame
ancestors are allowed for Extension embedding, and camera permission remains
same-origin for OBS Virtual Camera setup. Inline scripts remain allowed until
Role 1 adds nonce/hash plumbing for the Next.js runtime. These headers are
configuration readiness only; Role 1 still must verify them against the deployed
preview and Role 2's real OCR run before citing live evidence.

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
