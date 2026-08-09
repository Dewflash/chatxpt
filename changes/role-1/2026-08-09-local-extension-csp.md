# Restore local Twitch Extension interactivity

- Allow Next.js development hydration in the local Twitch Extension pages while keeping the production content-security policy strict.
- Allow the `127.0.0.1` development origin used by the OBS browser source.
- Cover the development and production CSP variants with an integration test.
- Prevent both manual and automatic quest generation until live screen capture is running.
- Clear stale active-quest state when Studio starts so a previous session cannot appear before capture.
