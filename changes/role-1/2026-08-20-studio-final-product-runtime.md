# Complete the Studio-first integrated product runtime

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Makes `/studio` the one product entry, connects Twitch through OAuth, removes streamer-facing server keys, publishes real Gameplay Capture and aggregate chat intelligence, restores exactly-three quest flow, private viewer rewards, and push-first role snapshots across the final Studio UI.
- **Integration impact:** Core profile/signal/command contracts; Role 2 audience and gameplay producers; Role 3 proposal/reward lifecycle; Role 4 Studio; Role 5 viewer and OBS surfaces; Supabase migrations and private realtime grants.
- **Verification:** Full `npm run check` passed on 20 August 2026: lint, TypeScript, role boundaries, repository/evidence/runbook checks, 95 Vitest files and 753 tests, production build, and client-secret scan. Production-browser checks covered the seven Studio pages, redirect, stale-session recovery, key-free OBS URL, equal Game Capture metrics, and desktop/mobile overflow. Built-server preflights accepted only the registered Twitch Extension and exact Local Test origins while rejecting an untrusted origin. Real owner Twitch/OBS/Minecraft testing is recorded separately when run.
- **Reality status:** Source and automated tests distinguish live, diagnostic, and fixture inputs. Real Twitch, OBS Virtual Camera, Supabase Cloud, provider, two-viewer, and deployed overlay proof still require the owner-run external workflow. Post-stream analytics/history is explicitly deferred.
