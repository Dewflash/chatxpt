# Restore the Windows local setup gate

- **Type:** Fixed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Local setup verification now treats Windows ACLs correctly instead of failing on unsupported POSIX permission-bit semantics.
- **Integration impact:** Restores `npm run check` on Windows without weakening generated-value, idempotency, credential-exclusion, or POSIX file-mode coverage.
- **Verification:** `node --test scripts/prepare-local-runtime.test.mjs`, `npm.cmd run check`, and a local Next.js run exercising `/`, `/studio`, `/viewer.html`, `/obs-overlay`, and `/api/health/deployment`.
- **Reality status:** Executed locally on Windows with credential-free in-memory persistence. Twitch, OBS capture, Supabase Cloud, and provider-backed paths were not exercised.
