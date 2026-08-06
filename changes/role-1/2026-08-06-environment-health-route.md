## Role 1

- Added a server-safe `/api/health` route that reports deployment, persistence mode, public Supabase realtime config, and service health for persistence, Twitch app, Twitch Extension, and OBS overlay setup.
- Kept server-only Supabase, Twitch, and OBS setup secrets out of the health response while preserving credential-free local fallback reporting for Vercel/deployment readiness.
