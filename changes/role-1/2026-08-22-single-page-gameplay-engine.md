# Single-page Gameplay Engine

- Made `/studio/gameplay` the single canonical page for capture connection, exact watched-feed preview, live detector proof, observed/unknown facts, and capture statistics.
- When capture is disconnected, the page now shows the real connection controls without an empty dashboard of unavailable facts; detector proof and statistics appear only while ChatXPT is watching a feed.
- Removed new-tab behavior from Studio navigation and every capture/recovery link. Test Lab and Home now enter Gameplay Engine in the current tab.
- Redirected the legacy `/studio/gameplay/capture` URL to `/studio/gameplay` so old links cannot reopen the split experience.
- Kept the mandatory fake ChatXPT login boundary by composing the capture controls inside the authorised Studio page.

Evidence: focused route, Studio rendering, reset/account, capture, and session-readiness tests; full repository check; running-browser same-tab navigation and legacy-route redirect. Native screen/window selection remains user-operated browser evidence.
