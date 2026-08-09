## Summary

- Added a minimal Vercel project config that pins the Next.js install and build commands without committing environment values.
- Documented the Role 1-owned preview/production environment variables and `/api/health/deployment` post-deploy checks.
- Added a server-only OBS overlay setup-key placeholder to `.env.example` so preview configuration matches current health and setup expectations.

## Verification

- `npm run test -- tests/integration/vercel-config.test.ts tests/integration/deployment-config.test.ts tests/integration/environment.test.ts`
- `npm run check`
