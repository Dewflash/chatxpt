# Link Studio to live intelligence generation

- **Type:** Fixed
- **Role:** Role 1 runtime composition with Role 2 candidate-provider, Role 3 validation, and Role 4 Studio changes
- **Issue/PR:** pending
- **Summary:** Live Quests now sends a provider-neutral live-intelligence command through current normalised gameplay/audience context, the configured server candidate provider, and deterministic quest validation. Studio reports the actual validated generation route and retains the explicit evidence-free local fallback.
- **Integration impact:** The canonical broadcaster quest-generation command now distinguishes `live-intelligence` from `deterministic-fallback`. No provider payload, raw model name, raw frame, raw chat, API key, or generation authority moved into the browser.
- **Verification:** Focused Studio command, rendering, and server integration coverage passed 3 files / 86 tests with an injected AI-provider fixture and no real API use. Full `npm run check` passed lint, TypeScript, role boundaries, hygiene/evidence/demo/security gates, 123 test files / 1,042 tests, the production build, and client-secret scans. Local browser checks at 1280×900 and 390×844 showed the provider-neutral generation status with zero horizontal overflow, no preview selector, and no console warnings/errors.
- **Reality status:** Automated memory-backed evidence proves the provider/validator wiring, exactly-three result, missing-capture guard, and provider-neutral status presentation. No paid OpenAI request, real Twitch activity, real OBS capture, browser interaction, or cloud persistence is claimed.
