# Quest-engine public entrypoint

Role 3 owns the pure engine implementation behind the contracts exported by `index.ts`. The engine returns a decision and event drafts; Role 1 remains responsible for authentication, idempotency, authoritative revisions, persistence, and broadcast.

Role 1 created this additive boundary under the recorded integration override. It does not choose Role 3's state transitions, timing, intervention, safety, scoring, reward, fallback, or AI-use behavior.
