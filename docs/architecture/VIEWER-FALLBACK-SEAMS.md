# Viewer fallback access and chat delivery seams

**Owner:** Role 1

**Issues:** UI-X07 #23 and UI-X08 #24

## Boundary

Role 5 owns the viewer-facing instructions and wording. Role 1 owns room
discovery, access grants, Twitch destination/authentication, rate-limit and
delivery handling, and the truth of whether a message was delivered.

This pass does not implement Role 5 UI and does not implement UI-X10 personal
vote/points recovery. UI-X10 continues through the reviewed vote-ledger path.

## Hosted-board entry

```text
eight-character room code or safe share URL
  -> Role 1 normalises and looks up the active session server-side
  -> capability and identity mode are checked
  -> a short-lived viewer read grant is stored
  -> a signed opaque credential is returned for an HTTP-only cookie
  -> the client receives only the public access view and share data
```

The share URL is `/viewer?room=ABCDEFGH`. Its query may contain exactly that
single canonical room code: credentials, durable tokens, viewer identities,
database keys, fragments, and userinfo are rejected. Optional QR uses the exact
same URL and is never required for the primary Twitch experience.
The share origin is trusted server configuration rather than client-controlled
input, so the exchange cannot be used as an open redirect.

The credential is an HMAC-SHA256 signed, versioned payload with a random grant
and principal ID, session ID, actor class, issue time, and expiry. It is valid
only while the corresponding short-lived viewer grant remains readable and the
session is still preparing/live with hosted-board capability enabled. Invalid,
missing, ended, forbidden, disabled, tampered, expired, and dependency-failure
paths return typed errors or no identity.

`HostedSessionLookup` has memory and Supabase implementations. Browser clients
never query `stream_sessions` or `realtime_access_grants` directly.

## Twitch-chat delivery

The platform-neutral message contracts cover:

- one poll-open channel message containing exactly three ordered candidates;
- one final-result channel message;
- one counted/rejected/late acknowledgement per viewer per quest cycle.

Role 5 supplies the rendered text within the validated 500-character contract.
Role 1 resolves the Twitch channel/reply destination and sends through the
server-only Helix adapter.

The adapter uses Twitch's Send Chat Message endpoint. A receipt is `delivered`
only when Twitch returns both `is_sent: true` and a non-empty `message_id`.
Twitch drops, 429 rate limits, unavailable destinations, network failures, and
invalid provider responses retain null delivery fields and a typed error. A
per-cycle key deduplicates poll/result messages and limits individual viewer
acknowledgement to one best-effort attempt. Receipt lookup failure blocks the
send because duplicate status is unknown. If Twitch confirms a send and receipt
storage then fails, the provider-confirmed result remains truthful and a
process-local receipt prevents a same-process retry.

Official provider references checked on 5 August 2026:

- <https://dev.twitch.tv/docs/api/reference#send-chat-message>
- <https://dev.twitch.tv/docs/chat/send-receive-messages/>

## Reality and remaining composition

- The contracts, grant codec, memory/Supabase room lookup, policy service,
  Helix HTTP transport, receipt validation, and failure handling are real code.
- Automated tests use fixture sessions and mocked Twitch HTTP responses. They
  are not live Twitch delivery evidence.
- No real Twitch message was sent because the team-controlled app/bot token and
  test channel are not yet configured.
- The browser exchange route/cookie setter is composed after the reviewed UI
  gateway lands. Until then this is a server seam, not a user-facing board.
- Durable cross-instance chat-receipt storage remains part of shared Supabase
  activation; the current memory receipt store is the credential-free fallback.
