# Clean-start reset follow-up

- Aligned the Test Lab reset behavior with the owner definition of a real local reset: the server stays awake, while this browser returns to an unconnected clean-start state.
- Follow-up needed: audit and align stale reset wording across the legacy Studio management surface and the newer product Test Lab so no UI says Twitch stays linked when the clean-start route clears the browser's Twitch connection cookie.
- Follow-up needed: verify which Studio surface remains reachable in the current route map before deleting or rewriting legacy copy, so the cleanup does not accidentally remove useful diagnostic UI.

Evidence: focused client/reset tests should cover browser-local cleanup in the implementation pass. This note is not a full stale-content audit.
