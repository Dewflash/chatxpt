# ChatXPT Core

Role 1 owns this directory. It contains platform-neutral runtime contracts and the application-orchestrator boundary. Twitch, OBS, provider, persistence, and component-local UI payloads terminate at adapters outside this directory.

## Public imports

Runtime consumers import from `@/core`:

```ts
import { candidateBatchSchema, type CandidateBatch } from "@/core";
```

The application orchestrator and its injected ports are also public:

```ts
import { ChatXptOrchestrator, type SessionStateRepository } from "@/core";
```

Contract fixtures are explicitly non-live and import from `@/core/testing`:

```ts
import { contractFixtureCandidateBatch } from "@/core/testing";
```

Do not import private files from another role directory. Add or change a canonical field through Role 1 review and update producer plus consumer contract tests together.

## Evidence status

Files under `testing/` are synthetic contract fixtures. They prove schema compatibility only and cannot be cited as gameplay extraction, Twitch, AI, or end-to-end evidence.

The in-memory repository, scripted engine, fixed clock, fixture authorizer, projector, and publishers under `testing/` refuse non-fixture state where applicable. They verify revision, idempotency, ordering, and recovery behavior without claiming Supabase, Twitch, OBS, AI, or live execution.
