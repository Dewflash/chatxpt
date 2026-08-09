# ChatXPT Twitch Extension Upload Package

This directory contains the root-level static files Twitch Asset Hosting expects during Local or Hosted Test:

```text
viewer.html
config.html
live-config.html
assets/extension.css
assets/viewer.js
```

Each HTML file loads the Twitch Extension Helper before local assets:

```text
https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js
```

Zip the contents of this directory, not the directory itself, when uploading a Twitch Extension version. The viewer file is interactive for the demo path: it fetches quest options and submits votes through ChatXPT's `/api/demo-participation` endpoint.

By default `assets/viewer.js` calls:

```text
http://localhost:3000/api/demo-participation
```

If Twitch serves the files from Hosted Test or another origin, use a public ChatXPT backend by adding an `api` query parameter to the Viewer Path, for example:

```text
viewer.html?api=https://your-chatxpt-host.example
```

The uploaded package still does not prove Twitch identity/JWT validation, released Extension approval, or cloud realtime. It is a demo voting bridge that depends on a reachable ChatXPT backend.

Role 1 owns the package shape and Twitch registration. Role 4 and Role 5 replace the visible bodies after their reviewed modules are ready.
