## Summary

- Added canonical UI-X06 fixture catalogs for quest lifecycle states and matching role view models.
- Covered proposed, zero-vote, tie, active manual/automatic progress, success/reward, failure, cancellation, skip, expiry, and cooldown states.
- Ensured the zero-vote viewer fixture keeps `acceptedCandidateId: null` so it does not leak or fabricate a private vote receipt.

## Verification

- `npm run test -- src/core/contracts.test.ts src/core/application/ui-gateway.test.ts tests/integration/role-entrypoints.test.ts` was covered by the 20 August repository consistency rerun; the encompassing seven-file run passed 94 tests, and full `npm run check` passed 82 Vitest files / 666 tests plus the production build.
