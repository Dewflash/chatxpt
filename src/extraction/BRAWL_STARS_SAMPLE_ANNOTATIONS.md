# Brawl Stars source-sample annotations

**Status:** Authorised source inspection only. These clips are suitable inputs for the pending real OBS run, but this inspection is not browser-delivered `FrameSource` evidence and does not establish extraction latency, OCR accuracy, or live readiness.

## Asset handling

- The user supplied both Brawl Stars clips on 7 August 2026 and authorised them for this Role 2 pass.
- The original MP4 files remain local and are not committed. Temporary sampled frames were created outside the repository for human review only.
- Gameplay frames display player handles. Neither the videos, sampled frames, nor visible handles may enter Git, an evidence report, or a sanitised audience fixture.
- Hashes identify the inspected local inputs without retaining their contents.

## Sample catalogue

| Sample ID | Local source | SHA-256 | Duration | Decoded frame | Intended coverage |
| --- | --- | --- | ---: | --- | --- |
| `brawl-stars-quiet-transition-01` | `IMG_9080.MP4` | `666e0658a42f35e45d6045b0087d58cd54630c681f9e2804688293a02603ac71` | 143.6 s | 1280×576 | Matchmaking wait, match-load transition, then gameplay |
| `brawl-stars-high-action-01` | `IMG_9079.MP4` | `0c5bb5bbb6ddc0273077b01cd0d9e9f9c0928f4e6adbb41f9c0cd39c8b285d57` | 55.6 s | 1280×576 | Match opening, repeated combat, goals, and match-end transition |

## Separate human annotation plan

Times below are relative to each clip. During the OBS run they must be translated to captured frame timestamps only after measurement; the production analyser never receives these expected labels.

### `brawl-stars-quiet-transition-01`

| Label | Relative interval | Human-review note |
| --- | --- | --- |
| `quiet` | 0.0–5.9 s | Matchmaking/loading wait with no live gameplay interaction. |
| `transition` | 6.0–19.9 s | Loading changes into the Brawl Ball title, team matchup, countdown, and live playfield. |

### `brawl-stars-high-action-01`

| Label | Relative interval | Human-review note |
| --- | --- | --- |
| `action` | 3.0–12.0 s | Immediate attacks, clustered movement, damage effects, and the first goal. |
| `action` | 34.0–50.0 s | Sustained combat, projectiles, damage effects, goal pressure, and match completion. |

## Selective OCR candidate

- Named region: `brawl-stars.match-timer`.
- Visual location: the small timer at the top centre of the gameplay frame.
- Trial window: stable gameplay frames after the match begins, avoiding title, matchup, goal, and match-over overlays.
- Required result: three rate-limited readings after local preprocessing, with two matching readings at confidence 0.75 or higher.
- Failure rule: unreadable, inconsistent, or low-confidence output remains `unknown`; no timer fact is claimed.

## Remaining evidence gate

Replay both samples through Role 1's merged browser `FrameSource`, measure them with the Role 2 sampler, run the approved OCR adapter on the named timer crop, record p50/p95 processing latency and practical browser resource observations, and add a privacy-reviewed sanitised real Twitch audience fixture. Until then, the samples are authorised inputs—not live extraction evidence.
