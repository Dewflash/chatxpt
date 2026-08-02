# Integration tests

Role 1 owns this directory. Tests here exercise only public role entrypoints and canonical fixtures; they must not import another role's private implementation files.

Fixture-only results prove contract compatibility, not Twitch, OBS, AI, extraction, persistence, realtime, UI, or end-to-end behavior.
