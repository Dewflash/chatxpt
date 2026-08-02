# Decision Log

Nothing below is permanent yet. `Proposed` entries are sensible setup defaults for team discussion.

| ID | Status | Proposal | Reason |
| --- | --- | --- | --- |
| D-001 | Proposed | Build one responsive Next.js app first. | Fastest path to a complete control-room and overlay demo. |
| D-002 | Proposed | Support one battle-royale-style golden scenario first. | Makes gameplay signals concrete while keeping the engine adaptable. |
| D-003 | Proposed | Keep deterministic generation as a permanent fallback. | Protects the demo from credentials, latency, quotas, and outages. |
| D-004 | Proposed | Use local browser transport before a database/WebSocket service. | Avoids infrastructure until remote multi-viewer testing requires it. |
| D-005 | Proposed | Require producer approval before activating a quest. | Gives a clear human review and safety boundary. |

When the team settles a decision, change its status to `Accepted`, add the date and participants, and document any replacement explicitly.
