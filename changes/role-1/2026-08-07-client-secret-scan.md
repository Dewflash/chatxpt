## Role 1

- Added a post-build client artifact scanner that fails when browser-delivered Next.js output contains server-only environment names or configured server secret values.
- Wired the scanner and its unit tests into `npm run check` after the production build.
- Updated the Vercel preview runbook and Role 1 TODO evidence to include client-secret scanning before deployment evidence is claimed.
