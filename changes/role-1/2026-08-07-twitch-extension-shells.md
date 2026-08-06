## Role 1

- Added safe Role 1 route shells for `/twitch/viewer`, `/twitch/config`, and `/twitch/live-config` so Twitch Extension registration paths exist before Role 4/5 modules land.
- Rendered Twitch setup readiness and limitations in those shells without exposing configured Twitch secrets or claiming live Extension evidence.
- Added jsdom coverage for unavailable, ready, viewer, config, and live-config shell states.
