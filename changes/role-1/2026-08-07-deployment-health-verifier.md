## Role 1

- Added a reusable `verify:deployment-health` command that checks `/api/health` response shape, expected deployment mode, omission of server-only secrets, and deployment hardening headers.
- Added unit tests for successful preview verification, missing headers, deployment mismatch, and redacted secret-value failures.
- Updated the Vercel preview runbook and Role 1 TODO so deployed health/header checks can be run and recorded repeatably once a preview URL exists.
