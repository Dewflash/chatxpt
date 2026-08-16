---
role: role-1
type: feature
summary: Complete hosted-board and signed Twitch-chat participation fallbacks
---

- Mounted the hosted Quest Board on the canonical Role 5 viewer with a reusable, signed HttpOnly anonymous identity.
- Added first-vote-final hosted voting and reactions through the same private participation ledger as the Twitch Extension.
- Added a bounded Twitch EventSub webhook that verifies raw-body HMAC delivery, pseudonymizes chatter identity, and counts only exact `1`/`2`/`3` votes.
- Kept chat acknowledgement silent to avoid spam and used the authoritative broadcast overlay for choices and results.
- Made Studio recover and expose the persistent hosted-board room link after refresh or process restart.
