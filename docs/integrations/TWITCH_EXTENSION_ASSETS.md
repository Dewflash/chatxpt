# Twitch Extension Asset Package

Use `twitch-extension/` for Twitch Asset Hosting tests. The zip must contain these files at the root:

```text
viewer.html
config.html
live-config.html
assets/extension.css
assets/environment.js
assets/viewer.js
assets/broadcaster.js
```

Do not zip the parent directory itself. If Twitch says the Panel Viewer Path or Configuration Path is missing, inspect the zip and confirm `viewer.html` and `config.html` are root-level entries.

Each HTML file must load Twitch's required Extension Helper first:

```text
https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js
```

`viewer.html` then loads the local build-owned `assets/environment.js` and `assets/viewer.js`; Config and Live Config load `assets/environment.js` and `assets/broadcaster.js`. `environment.js` contains one exact trusted HTTPS EBS origin. Update that origin before Hosted Test and add the same domain to Twitch's URL-fetching allowlist. Never accept the EBS origin from the Viewer Path, query string, local storage, or viewer input because the browser sends Twitch's bearer JWT there.

The viewer uses `onAuthorized`, refreshes state through the signed EBS, and renders select-then-confirm voting, acknowledgement, countdown, tallies, winner, active progress, results, and reconnect status. Config and Live Config accept only the signed broadcaster role and use the authoritative Studio session/command endpoints. Source and signed-token tests prove the package logic only; a real Local or Hosted Test must still be captured in `docs/evidence/manifest.json` before describing Twitch delivery as live.
