## Role 1 - Twitch Extension view policy

- Accepted D-056 for Twitch Extension registration: Panel and Mobile only, both using `/twitch/viewer`, with Panel height set to 496px.
- Documented `/twitch/config` as the install/config path and `/twitch/live-config` as the streamer dashboard control path.
- Kept `Video - Fullscreen` and `Video - Component` unselected for the MVP because OBS Browser Source owns broadcast overlay visuals.
- Extended the setup registration manifest and verifier so the Twitch console values are copy-safe and repeatably checked.
