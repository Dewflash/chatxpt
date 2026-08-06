## Role 1

- Recovered the browser-safe UI gateway client onto the current Role 1 stack so Role 4/5 modules can read authorised snapshots and dispatch canonical commands without importing server, persistence, Supabase, or integration internals.
- Added focused client tests for same-origin credentials, scoped bearer headers, the command marker, malformed responses, transport failure, and rejected access-token recovery.
