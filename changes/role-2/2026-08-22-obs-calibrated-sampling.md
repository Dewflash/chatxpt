# Restore calibrated OBS pixel sampling

- **Type:** Fixed
- **Role:** Role 2
- **Issue/PR:** pending
- **Summary:** The Studio Gameplay Capture path can now analyse its bounded 640×360 Minecraft sample instead of failing when the generic 16,384-pixel sampler ceiling rejects it.
- **Integration impact:** Role 2 extraction and the Role 4-mounted Studio capture client now share an explicit bounded sampler allowance; generic visual sampling keeps its smaller default.
- **Verification:** Focused extraction/ingress tests passed 52 tests. A real OBS Virtual Camera run analysed 138 frames at about 1.9 frames per second, delivered 136 accepted snapshots, and stayed active while Studio navigated across Gameplay Engine, Live Analytics, Live Quests, and Live Director. The canonical memory-backed smoke passed in development and production mode after rebasing current `main`; `npm run check` passed 107 test files / 845 tests, the production build, and client-secret scanning. Twenty-request production-route samples recorded p95 latency of 4.4 ms for health, 7.4 ms for Studio, 7.9 ms for Live Director, and 6.8 ms for the OBS page on this laptop.
- **Reality status:** The live browser run used actual OBS Virtual Camera pixels and memory persistence. The current OBS feed did not contain a confidence-qualified vanilla Minecraft HUD, so four universal facts were observed and thirteen calibrated facts correctly remained unknown. No Supabase Cloud, Vercel deployment, or real Twitch-issued viewer JWT is claimed.
