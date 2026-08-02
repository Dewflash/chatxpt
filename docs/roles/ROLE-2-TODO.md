# Role 2 To-Do: AI Intelligence and Data Extraction

**Owner:** `joelyrk`

Update only this role's statuses and evidence. Raise shared-contract needs through a `cross-role` GitHub Issue before implementation.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R2-001 | P0 | READY | Inspect current prototype and propose Role 2's owned module boundary after migration. | Role 1 migration plan | File/API proposal names inputs, outputs, mocks, and no cross-role edits. |
| R2-002 | P0 | BLOCKED | Implement game-neutral manual/simulated extraction behind Role 1's interface. | Shared extraction contract | Health/status, action outcome, intensity, downtime, team, phase, and resource examples with tests. |
| R2-003 | P0 | BLOCKED | Implement audience/gameplay snapshot and behavioural intelligence. | R2-002; audience contract | Timestamped/confidence-scored output for energy, sentiment, intent, humour, risk, boredom, hype, and repeated requests. |
| R2-004 | P0 | READY | Define provider evaluation criteria with Role 3. | Accepted D-014 | Joint comparison covers OpenRouter and alternatives, latency, cost, privacy, reliability, structured output, quest quality, and fallback. |
| R2-005 | P0 | BLOCKED | Implement chosen provider adapter and model-ready context. | Joint recommendation accepted by Role 1 | Server-only provider path returns validated structured output; no vendor payload leaks into core. |
| R2-006 | P0 | BLOCKED | Produce exactly three candidate quests plus metadata for Role 3. | R2-003 and R2-005 | Candidate output conforms to contract and includes confidence, reason, provider/fallback, and traceable inputs. |
| R2-007 | P0 | READY | Build credential-free and malformed/provider-failure behaviour. | Current mock engine | Tests demonstrate deterministic fallback and clear provider status. |
| R2-008 | P1 | READY | Create representative AI/extraction evaluation cases and evidence. | Ongoing | Multiple game genres, audience moods, unsafe/noisy cases, latency results, and documented limitations. |

## Decisions Role 2 may make without Role 1

- Extraction implementation details behind the accepted interface
- Signal aggregation and confidence approach
- Audience-analysis methods and prompts
- Provider adapter design and evaluation method

Provider/model adoption is a joint Role 2/Role 3 recommendation and requires Role 1 awareness because it affects cost and external services.
