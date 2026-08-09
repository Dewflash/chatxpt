# Define Role 2 audience intelligence policy

- **Type:** Changed
- **Role:** Role 2
- **Issue/PR:** PR #111 / pending
- **Summary:** Resolved D2-12 through D2-15 with a 30-second audience window, a mandatory credential-free rules path, conservative ambiguity handling, and memory-only raw-chat processing.
- **Integration impact:** PR #111 must partition live, fixture, and diagnostic evidence; implement the recorded policy; and add the required audience edge-case regressions before Role 2 approval.
- **Verification:** `git diff --check`; `npm run check`.
- **Reality status:** Policy and source-inspection evidence only; no real Twitch chat, model trial, or live audience execution is claimed.
