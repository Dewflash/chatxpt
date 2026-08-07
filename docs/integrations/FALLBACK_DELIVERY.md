# Hosted And Chat Fallback Delivery Policy

D-062 resolves D1-06E for the Role 1 participation service.

## Hosted Quest Board

Hosted fallback discovery uses the session room code to resolve a session-scoped viewer grant. A successful lookup returns:

- the resolved session ID and canonical room code
- a direct authorised hosted-board URL
- copy/share text and URL
- an optional QR payload
- a bounded grant expiry

QR is convenience-only. Viewers must not be required to scan a QR code, create a ChatXPT account, or leave the allowed fallback flow to participate. Invalid room codes, missing rooms, inactive sessions, unavailable hosted-board capability, and expired grants fail closed with typed errors.

## Twitch-Chat Fallback

Twitch-chat fallback uses platform-neutral templates for:

- poll-open instructions that show exactly three options and ask viewers to reply `1`, `2`, or `3`
- final result messages for activated, cancelled, no-vote, or expired outcomes
- counted, duplicate, rejected, and late acknowledgement copy

Role 1 owns Twitch-chat parsing, canonical command submission, outbound delivery, rate limiting, and acknowledgement status. Role 5 owns only the viewer-facing presentation of Role 1-supplied availability, instructions, and status. A UI client must not parse chat, infer vote acceptance, send Twitch messages, or promise acknowledgements.

## Acknowledgement Rule

ChatXPT may show `counted`, `duplicate`, `rejected`, or `late` only when the Twitch outbound acknowledgement message was actually delivered. Failed or rate-limited acknowledgement delivery returns `not-delivered`; missing Twitch delivery configuration returns `unavailable`; ignored chat produces no acknowledgement attempt.

## Limitations

This is fixture and local integration evidence. It does not claim live Twitch outbound delivery, real Twitch chat ingestion, hosted production availability, or final Role 5 presentation evidence. Those remain part of the real workflow evidence gate.
