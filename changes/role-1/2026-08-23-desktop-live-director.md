# Add the always-on-top Desktop Live Director

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Streamers can link a compact macOS Live Director once from Studio, keep it above Minecraft and other windows, toggle click-through, hide or restore it, and retain its broadcaster link and window preferences between app launches.
- **Integration impact:** Adds the Electron 43.4.1 development dependency, a `chatxpt://` one-time link seam, isolated desktop authentication for the existing private Live Director read model, Studio launch and recovery controls, and Role 1/Role 4 documentation. Electron is excluded from the browser bundle. The packaged app adds local disk/runtime size; browser and OBS Dock use remain supported fallbacks if the companion is unavailable.
- **Verification:** `npm run test -- desktop/live-director/link.test.mjs src/integrations/obs/browser-source.test.ts src/app/live-director-overlay/live-director-overlay-client.test.ts src/integrations/disclosures.test.ts`; scoped ESLint; `npm run typecheck`; `npm run desktop:live-director:smoke`; `npm run desktop:package:mac`; packaged executable smoke with link, click-through, and hide/show checks; `codesign --verify --deep --strict`; `npm run check:evidence`; `npm run test:evidence`; and `npm run check`.
- **Reality status:** The source app and ad-hoc-signed macOS package were launched locally with a fixture link, and secure storage plus window controls were exercised. A real owner Twitch broadcaster, active stream session, Minecraft focus behavior, OBS exclusion, Apple notarisation, Windows packaging, hosted distribution, and auto-update are not yet evidenced.
