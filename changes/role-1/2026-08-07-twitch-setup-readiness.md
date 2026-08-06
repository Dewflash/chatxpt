## Role 1

- Added a safe Twitch setup-readiness helper and reserved OAuth callback route for registering the future Twitch app callback URL without enabling token exchange prematurely.
- Documented the Twitch app callback and Extension viewer/config/live-config paths plus environment variable boundaries in a Role 1 setup runbook.
- Added integration tests for unavailable, partial, ready, and callback-route validation states without leaking configured Twitch secrets.
