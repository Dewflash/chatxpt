# Make UI execution beginner-safe and close planning gaps

- **Type:** Changed
- **Role:** Role 1 integration override with Role 2/4/5 review
- **Issue/PR:** [#27](https://github.com/Dewflash/chatxpt/pull/27)
- **Summary:** Add guided Role 4/5 execution, explained phase design gates, role-owned decision/pass records, corrected P0/P1 queues, and a complete Role 1 backlog for missing UI integration seams.
- **Integration impact:** Roles 4/5 can ask only what to do and remain inside UI ownership; feasibility reviews are tracked in issues #15/#16 and UI-X01 through UI-X10 in issues #17-#26.
- **Verification:** `npm run check`, `git diff --check`, issue/label audit, plan/TODO consistency review, and a final rigorous diff audit before pull request.
- **Reality status:** Planning, workflow, evidence templates, and GitHub tracking only. No UI, Twitch, OBS, AI, quest, hosted fallback, personal-viewer, or cloud runtime behaviour is claimed.
