# Studio trust copy verification

- Restored explicit authorised-state, fixture-only, revision, persistence-boundary, and private-publication wording across Studio Setup, Studio Management, Live Director, and Twitch Live Config.
- Kept unavailable controls visibly unavailable and aligned hosted-board/readiness tests with live-session and complete Twitch-configuration requirements.
- Removed two unused callback parameters so lint is clean.

Evidence: affected streamer/app tests pass and the complete `npm run check` passes. D-085 owner snapshot acceptance remains open; this fragment is not visual acceptance or live workflow evidence.
