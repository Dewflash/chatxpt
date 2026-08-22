# Minecraft day/night luminance tracker

- Added a local pixel-brightness measurement and temporal `day`/`night` tracker for the trusted Minecraft profile.
- Day uses a short sustained bright window; night uses a much longer uninterrupted dark window.
- Abrupt darkness while day is known is treated as indoor, shadow, or camera occlusion and cannot flip the world-time state until the earlier brightness returns.
- Paused/menu and underwater frames do not become daylight evidence.
- Ordinary scene darkening now requires visible pause-menu structure before it can gate the detector, and a disappeared menu hold expires instead of blanking health, hunger, activity, and environment indefinitely.
- Minecraft Studio proof retains universal visual activity and scene-transition readings while specific movement or environment facts are being reacquired.
- Projected `minecraft-day-night` through gameplay snapshots, Studio detector proof, typed Minecraft AI context, and Role 3 fact-dependency validation.
- Added component, analyzer, provider-context, UI, and quest-validation regressions. These are fixture/component results, not a real OBS daylight-accuracy claim.
