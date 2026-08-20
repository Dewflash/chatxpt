## Summary

- Added a server-runtime hook that emits canonical `system.live-director-context-ready` commands for gameplay-driven Live Director refreshes.
- Gameplay ingress now reports Live Director refresh status and refreshes context for accepted snapshots when the same revision was not already used to submit a quest proposal.
- The Gameplay Capture diagnostic shows whether accepted gameplay facts refreshed Live Director context, were skipped because a proposal used the snapshot, or failed/unavailable.

## Verification

- Not run at owner request; focused source expectations were updated for ingress result status and runtime invocation.
