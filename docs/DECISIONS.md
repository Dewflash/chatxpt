# Decision Log

`Proposed` entries remain open for team discussion. `Accepted` entries are the current team direction and can be replaced by a later recorded decision.

| ID | Status | Decision / proposal | Reason | Date and participants |
| --- | --- | --- | --- | --- |
| D-001 | Accepted | Build one responsive Next.js app first. This supersedes the earlier Vite frontend plus separate Node backend/monorepo suggestion. | The working prototype already provides the complete control-room, API, and overlay slice with less integration risk. | 2026-08-03 — team confirmation via Codex task |
| D-002 | Proposed | Support one battle-royale-style golden scenario first. | Makes gameplay signals concrete while keeping the engine adaptable. | — |
| D-003 | Proposed | Keep deterministic generation as a permanent fallback. | Protects the demo from credentials, latency, quotas, and outages. | — |
| D-004 | Accepted | Use local browser transport before a database/WebSocket service. WebSockets remain a possible later adapter. | The existing local-storage and BroadcastChannel path demonstrates the end-to-end flow without adding infrastructure before it is required. | 2026-08-03 — team confirmation via Codex task |
| D-005 | Proposed | Require producer approval before activating a quest. | Gives a clear human review and safety boundary. | — |

When the team settles a decision, change its status to `Accepted`, add the date and participants, and document any replacement explicitly.
