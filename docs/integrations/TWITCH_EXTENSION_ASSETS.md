# Twitch Extension Asset Package

Use `twitch-extension/` for Twitch Asset Hosting tests. The zip must contain these files at the root:

```text
viewer.html
config.html
live-config.html
assets/extension.css
```

Do not zip the parent directory itself. If Twitch says the Panel Viewer Path or Configuration Path is missing, inspect the zip and confirm `viewer.html` and `config.html` are root-level entries.

Each HTML file must load Twitch's required Extension Helper as its first and only script:

```text
https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js
```

This package is intentionally static and CSP-friendly apart from that required helper: no inline scripts, no extra scripts, no inline styles, and no external network requests beyond Twitch's helper URL. It proves upload path readiness only. Live Extension behaviour still requires the Role 1 runtime, reviewed Role 4/5 modules, Twitch identity/JWT validation, and recorded Local or Hosted Test evidence.
