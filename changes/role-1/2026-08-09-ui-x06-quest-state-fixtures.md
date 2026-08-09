## Summary

- Added canonical UI-X06 fixture catalogs for quest lifecycle states and matching role view models.
- Covered proposed, zero-vote, tie, active manual/automatic progress, success/reward, failure, cancellation, skip, expiry, and cooldown states.
- Ensured the zero-vote viewer fixture keeps `acceptedCandidateId: null` so it does not leak or fabricate a private vote receipt.

## Verification

- Pending in this pass: focused contract/viewer tests and `npm run check`.
