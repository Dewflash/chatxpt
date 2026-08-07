# Role 1 chat fallback policy seam

- Added a UI-X07 chat fallback formatter/policy under Role 1 integrations for poll-open instructions, final-result announcements, and per-viewer counted/duplicate/rejected/late/unavailable receipt presentation.
- Mapped authoritative quest options to `1`/`2`/`3` only when the current quest cycle is voting with exactly three options.
- Kept per-vote chat acknowledgement disabled by policy so the MVP does not overclaim Twitch delivery or create chat spam before the real outbound adapter exists.

Verification is fixture-only formatter coverage. This does not claim real Twitch chat parsing, outbound delivery, rate-limit behaviour, or live acknowledgement evidence.
