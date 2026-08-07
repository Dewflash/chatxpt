# Add deployment health route

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Added a server-only deployment health report and thin `/api/health/deployment` route that reports local memory fallback, Supabase configuration status, missing variable names, and public realtime URL readiness without exposing secret or publishable key values. Added a client-bundle secret scanner to `npm run check` and conservative deployment headers.
- **Integration impact:** Gives Role 4 integration-health UI, Vercel preview checks, and manual setup verification a stable read path for configured/not-configured state while keeping server secrets out of client-visible JSON and built client assets. Global headers add content-type/referrer/permissions protection without blocking Twitch or OBS embedding; the deployment health endpoint is uncached.
- **Verification:** `npm run test -- tests/integration/environment.test.ts tests/integration/deployment-config.test.ts`; `npm run test:client-secrets`; `npm run check`.
- **Reality status:** Local environment-resolution evidence only. No Vercel deployment, live Supabase connectivity, or browser-cloud round trip is claimed.
