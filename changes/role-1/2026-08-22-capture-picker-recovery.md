# Gameplay Capture picker recovery

- Suppressed hydration warnings on the capture preview element when Safari or browser software injects video-only attributes such as `accel-video` before React hydrates.
- Added an always-visible same-tab **Back to Studio home** action so cancelling the browser screen/window picker cannot leave the operator trapped in Gameplay Engine.
- The fake ChatXPT account flow, Twitch OAuth, capture analysis, and OBS overlay behavior are unchanged by this pass.

Evidence: focused source rendering/type checks and the running local HTTPS route were used to verify the recovery link. Selecting and cancelling the native screen picker remains a user-operated browser action.
