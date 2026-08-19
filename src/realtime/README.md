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

## Live Director context staging

`EphemeralAudiencePointerAggregateRepository` hands one Role 2 aggregate to the
Role 1 orchestrator without storing its opaque participant deduplication keys or
message fingerprints in Supabase or authoritative command history. The
orchestrator commits only the resulting Chat Pointer counts, time window,
confidence, topic, and non-personal signal references. A new process may require
Role 2 to restage an uncommitted aggregate; a committed Live Context recovers
from the normal authoritative session state.

## Hosted board access

`HostedBoardAccessService` is the UI-X08 server-side seam for the hosted Viewer
Quest Board. It validates the eight-character room code, resolves the matching
preparing or live session, creates a viewer realtime read grant, and returns the
direct viewer path plus copy/QR payload data. Invalid, missing, inactive,
expired, and temporarily unavailable states are typed so Role 5 can render
recovery without reading product tables or inventing access state.

The mounted `/quest-board/[roomCode]` surface exchanges a valid room code for a
12-hour, signed HttpOnly anonymous grant. Refreshes in the same browser reuse
the same private voter key, so reloading cannot mint a second vote. The client
reads and commands through `/api/hosted-board/*`, uses the same
accepted-participation ledger as the Twitch Extension, and never writes product
tables directly. Real cross-device recovery still depends on the configured
Supabase runtime.

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

## Private viewer recovery

`viewerRecovery.readViewerRecovery` is the UI-X10 server-side read seam for
viewer reconnect. It accepts the session, quest cycle, and opaque `voterKey`,
then returns only that viewer's accepted candidate, acceptance time, current
session points, and participation source. Shared viewer snapshots remain
sanitised and never broadcast `viewerId`, `acceptedCandidateId`, or personal
points.

The current authoritative reward ledger is not persisted per viewer yet, so the
memory and Supabase readers return `sessionPoints: 0` until Role 1 wires the
reward read model. This keeps Role 5 unblocked for accepted-vote recovery
without inventing personal rewards.

## Deployment headers

The Next.js app-level headers include a first-party CSP for deployment previews:
WASM/blob workers are allowed for the accepted selective-OCR path, network
connections are scoped to same-origin, Supabase HTTPS/WSS, Twitch API HTTPS, and
Twitch PubSub WSS, and camera permission remains same-origin for OBS Virtual
Camera setup. Twitch Extension routes allow the required Extension Helper script
origin (`https://extension-files.twitch.tv`) and the current Twitch supervisor,
production, and local/Rig frame ancestors documented by Twitch.

Inline scripts remain allowed until Role 1 adds nonce/hash plumbing for the
Next.js runtime. These headers are configuration readiness only; Role 1 still
must verify them against the deployed preview, Twitch Local/Hosted Test, and
Role 2's real OCR run before citing live evidence.
