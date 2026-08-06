## Role 1

- Preserved typed setup/session `serviceCommand` acknowledgement results through the browser UI gateway client so streamer UI consumers can update readiness from the accepted command response.
- Aligned the diagnostic gateway `serviceCommand` payload with the core `StreamerServiceCommandResult` schema, including command ID and current revision, without claiming live Twitch, OBS, or session execution.
