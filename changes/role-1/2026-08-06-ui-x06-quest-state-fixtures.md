# Publish UI-X06 quest-state fixtures

- **Summary:** Added fixture-only quest-state and role-view catalogues covering idle, proposed, zero-vote, tie, active manual progress, active automatic progress, success/reward, failure, cancellation, skip, expiry, and cooldown states.
- **Integration impact:** Roles 4 and 5 can consume validated examples from Role 1-owned Core fixtures and the diagnostic UI gateway instead of implementing lifecycle, tie, progress, reward, or terminal-state authority in UI code.
- **Verification:** Added schema, role-view, diagnostic gateway, and jsdom harness assertions for the quest-state catalogue.
- **Reality status:** Fixture/local diagnostic evidence only. The catalogue mirrors accepted Role 3 semantics but does not claim live Twitch/OBS, deployed realtime, or new quest-engine winner/tie execution proof.
