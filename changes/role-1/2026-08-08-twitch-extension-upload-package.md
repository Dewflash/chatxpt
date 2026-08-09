## Role 1

- Added a checked-in Twitch Extension Asset Hosting package with root-level `viewer.html`, `config.html`, and `live-config.html` setup shells plus local CSS.
- Added Twitch Extension Helper loading to every HTML file, with tests that verify the helper URL, script ordering, CSP-friendly static shape, local-only assets, and non-live evidence boundary.
- Documented how to zip the package contents so Twitch does not reject the configured Viewer or Configuration paths.
