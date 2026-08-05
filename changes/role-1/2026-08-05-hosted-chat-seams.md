# Add hosted-board access and Twitch-chat delivery seams

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** UI-X07 #23, UI-X08 #24; PR pending
- **Summary:** Added safe room-code/share exchange, short-lived signed hosted-viewer credentials, platform-neutral poll/result/acknowledgement messages, and a server-only Twitch chat transport that requires provider confirmation before reporting delivery.
- **Integration impact:** Role 5 can consume typed hosted entry and chat receipt states without reading persistence, handling credentials, deciding vote results, or claiming Twitch delivery. UI-X10 personal vote/points recovery remains on its separate reviewed ledger path.
- **Verification:** `npm run check` passes lint, type checking, role boundaries, evidence validation/tests, 151 Vitest cases, and the Next.js production build. Focused coverage includes contract rejection, hosted grant tamper/expiry/session-end behaviour, receipt-store failures, concurrency/deduplication, Twitch response mapping, and Supabase room lookup.
- **Reality status:** Room/grant and Twitch transport paths are real server code. Tests use fixture sessions and mocked Twitch HTTP; no credentialed Twitch message, user-facing hosted route, or live multi-device recovery is claimed yet.
