# Brawl Stars source-sample annotations

**Status:** Authorised local diagnostic replay completed; real OBS run remains pending. The recordings were decoded locally into bounded 160×90 frames and passed through the production multi-game analyzer, but this was not browser-delivered `FrameSource` evidence and does not establish live or OCR accuracy.

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

## 14 August local diagnostic replay

The local replay decoded only the annotated windows at 10 frames per second and 160×90 RGBA, preserving segment discontinuities and keeping all decoded pixels outside Git. Results are runtime diagnostics from the current uncommitted branch, not immutable submission evidence.

| Sample coverage | Frames | Analyzer p50 | Analyzer p95 | Universal tier | Calibrated Brawl HUD tier |
| --- | ---: | ---: | ---: | ---: | ---: |
| `IMG_9079.MP4`: 0–15 s and 34–53 s | 340 | 7.50 ms | 8.05 ms | 23 | 317 |
| `IMG_9080.MP4`: 0–22 s | 220 | 6.61 ms | 7.59 ms | 178 | 42 |

The three-anchor Brawl fingerprint confirmed sampled active-match and match-over frames while withholding calibration during matchmaking and the pre-match intro. It currently proves only standard HUD layout and match-active capability. No timer digit, score, or outcome text was emitted, and animated loading/intro sequences still do not consistently satisfy the universal settled-transition rule.
