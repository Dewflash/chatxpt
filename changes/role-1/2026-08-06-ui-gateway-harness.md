## Role 1

- Started R1-015 by adding a production-protected diagnostic UI gateway route for browser-safe fixture snapshot reads and canonical command posts.
- Added integration coverage for authorised role snapshots, typed read denial, stale command rejection, private viewer command receipts, sanitised reconnect snapshots, and the thin GET/POST routes.

Verification: `npm run test -- tests/integration/ui-gateway.test.ts`; `npm run check`.
