# Minimum Real Workflow Evidence

D-059 defines the smallest ChatXPT run that may be cited as real end-to-end product evidence.

Passing tests, fixtures, setup manifests, or source inspection is not enough. A valid evidence entry must be `real`, privacy-reviewed, and tied to the exact commit/PR that produced the run.

## Required Inputs

- Owned or explicitly authorised gameplay.
- OBS Virtual Camera frame input from the raw game scene.
- Real Twitch activity from the team-controlled channel.
- No simulated input presented as live.
- Ephemeral raw frames.
- Raw chat retention compliant with the accepted 24-hour maximum.

## Required Extraction Evidence

- Universal visual signals observed from real frames.
- At least one known calibrated demo fact for the selected scenario.
- Unsupported or unreliable facts labelled `unknown`.
- Confidence, timestamps, provenance, and method recorded.

## Required Quest Evidence

- Exactly three Role 2 candidates.
- Exactly three Role 3-validated viewer options.
- Unsafe or impossible quests rejected or absent.
- Streamer control observed.
- A terminal outcome: success, failure, cancellation, skip, or expiry.

## Required Participation Evidence

- Two distinct viewers.
- At least two accepted votes.
- A duplicate or reconnect case.
- Twitch Extension if available; otherwise hosted-board or Twitch-chat only with Extension unavailability labelled truthfully.

## Required Consistency Evidence

The same session, quest cycle, and revision must be visible across:

- orchestrator;
- persistence;
- Studio;
- the active viewer participation surface;
- OBS overlay.

The OBS overlay must show the winner or active quest, and the result/reward must be displayed.

Use `resolveMinimumRealWorkflowEvidence` to validate a proposed evidence report before citing it in the deck or demo video. This resolver validates the report shape and blockers only; it does not create real evidence.
