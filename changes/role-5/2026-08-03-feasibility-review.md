# Record viewer-plan feasibility and blockers

- **Type:** Changed
- **Role:** Role 5
- **Issue/PR:** [#16](https://github.com/Dewflash/chatxpt/issues/16) / [#28](https://github.com/Dewflash/chatxpt/pull/28)
- **Summary:** Recorded the implementation baseline, contract gaps, route/harness needs, design-system dependency, performance/accessibility risks, and safe recovery paths for the Twitch viewer, hosted fallback, chat fallback, and OBS overlay plan; reconciled the review with the adaptive gates merged in PR #27.
- **Integration impact:** Links UI-X05 through UI-X08 and UI-X10; requests Role 1 delivery for the harness, hosted/chat access, and private viewer recovery; requests Role 3-through-Role-1 examples for UI-X06; and depends on Role 4's minimum `@/design-system` handoff. No shared contract or source code changed.
- **Verification:** Original source/document inspection and full repository check passed; Role 1 additionally merged current main, resolved the TODO conflict, performed a semantic-staleness audit, and reran `git diff --check` plus `npm run check` before updating PR #28.
- **Reality status:** Documentation and merged-source inspection only. Current viewer/overlay data is fixture-labelled; no Twitch Extension, hosted board, chat acknowledgement, multi-client realtime, or OBS Browser Source behavior was claimed as executed.
