# ChatXPT Twitch Extension Upload Package

This directory contains the root-level static files Twitch Asset Hosting expects during Local or Hosted Test:

```text
viewer.html
config.html
live-config.html
assets/extension.css
```

Each HTML file loads the Twitch Extension Helper as its only script before the local stylesheet:

```text
https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js
```

Zip the contents of this directory, not the directory itself, when uploading a Twitch Extension version. The package is a path-validation shell only. It does not claim live viewer voting, Twitch identity, Extension JWT validation, realtime updates, or chat delivery.

Role 1 owns the package shape and Twitch registration. Role 4 and Role 5 replace the visible bodies after their reviewed modules are ready.
