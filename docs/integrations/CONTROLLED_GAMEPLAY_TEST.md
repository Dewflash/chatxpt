# Controlled Gameplay Test Procedure

Role 1 owns the evidence procedure for real gameplay and Twitch-delivered visual-analysis proof. Role 2 owns extraction algorithms and evaluation once Role 1 supplies the permitted frame path.

## Accepted Procedure

D-058 requires one selected scenario to run through two paths:

```text
Run 1: local OBS Virtual Camera capture
Run 2: same scenario streamed through the team-controlled Twitch channel
```

Use Brawl Stars as the intended scenario only if OBS capture is reliable enough to sample it. If that proof fails, switch to a team-owned PC action game. The scenario choice is evidence for the demo, not a product restriction.

## Hard Rules

- Gameplay must be team-owned or explicitly authorised.
- The Twitch stream must use the team-controlled broadcaster channel.
- OBS Virtual Camera must expose the raw game scene and exclude the ChatXPT overlay.
- Expected events and annotations must be recorded separately for evaluation.
- Expected annotations must never be fed to the extractor or model.
- Raw video and raw frames are not persisted as product data.
- Third-party unapproved streams cannot be used as evidence.

## Required Resources

Record evidence against the existing evidence manifest resource IDs:

```text
obs-gameplay-machine
twitch-broadcaster
streamer-desktop-browser
demo-recording
```

Local-only dry runs may omit `twitch-broadcaster`, but the D1-10 proof is incomplete until the team-controlled Twitch run exists.

## Evidence Record

Before citing the run as real evidence, add a privacy-reviewed entry to `docs/evidence/manifest.json` with:

- the immutable source commit and PR number;
- the selected scenario;
- both the local OBS and team-controlled Twitch interactions;
- surfaces used, including OBS/gameplay machine, streamer browser, and recording;
- artifacts stored as repository-safe or private-team-drive references;
- limitations, including any unsupported or unknown gameplay facts.

Passing `resolveControlledGameplayTestPlan` only proves the procedure report is acceptable. It does not create real evidence by itself.
