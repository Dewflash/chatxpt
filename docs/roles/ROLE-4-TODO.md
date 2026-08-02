# Role 4 To-Do: Streamer Studio UI/UX

**Owner:** `JYL1m`

Detailed product work begins from Role 2's scoped D-016 build plan. Role 4 supplies one feasibility review and does not implement speculative screens outside the accepted plan.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R4-001 | P0 | READY | Review Role 2's Streamer Studio build plan for feasibility in one response, then record the implementation baseline. | Role 2 R2-009 plan | Review identifies conflicts, missing requirements, shared-contract needs, and implementation risks; Role 2 records any revision and Role 1 is notified. |
| R4-002 | P0 | BLOCKED | Define shared ChatXPT visual system and accessible base components. | R4-001 | Tokens/components documented and consumable by Role 5 without Role 5 editing Role 4 files. |
| R4-003 | P0 | BLOCKED | Build full Studio shell and self-service Twitch connection/setup flow. | R4-001; Role 1 auth contracts | Working responsive route with loading, success, error, and disconnected states. |
| R4-004 | P0 | BLOCKED | Build persistent streamer profile and challenge customisation. | Profile contract | Style, tone, intensity, safety, forbidden/preferred types, game, voting, reward, and accessibility settings persist. |
| R4-005 | P0 | BLOCKED | Build pre-stream testing and integration-health experience. | Role 1 health/simulator contracts | Twitch, OBS, AI, realtime, and simulation status plus useful recovery actions. |
| R4-006 | P0 | BLOCKED | Build compact Twitch Config and Live Config surfaces. | Role 1 Twitch shell; Role 3 controls | Focused embedded UI supports required stream-time actions without duplicating full Studio. |
| R4-007 | P1 | BLOCKED | Build history and post-stream summary required for the demo. | Session/result contracts | Relevant quests, outcomes, engagement, and limitations displayed. |
| R4-008 | P0 | BLOCKED | Produce responsive and failure-state evidence. | R4-003 through R4-007 | Working site, screenshots/recording, accessibility checks, and setup-to-live walkthrough. |

## Decisions Role 4 may make without Role 1 within the accepted build plan

- Streamer information architecture and interaction details
- Studio and compact Twitch control presentation
- Shared visual design tokens and base components
- How understandable AI customisation appears to streamers
- Streamer-experience measurements proposed to Role 1
