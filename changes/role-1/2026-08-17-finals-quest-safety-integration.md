# Integrate hardened quest lifecycle

- **Type:** Changed
- **Role:** Role 1 using the D-015 integration override
- **Issue/PR:** pending
- **Summary:** Integrated authoritative quest ticks, adaptive intervention thresholds, conservative evidence gates, and deterministic cooldown progression. Automatic progress remains partial: a system request for value 1 is rejected until the persisted completion rule carries D-060's explicit predicate.
- **Integration impact:** Role 3 review is requested. Role 1 retains scheduling, authentication, revisions, persistence, and broadcast; Role 3 remains the pure quest authority.
- **Verification:** Focused engine, intervention, and outcomes tests plus TypeScript and lint run in this pass. Full repository verification runs after all isolated passes.
- **Reality status:** Deterministic source and fixture evidence only; no automatic live success, rewards, real-game predicate proof, or external provider use is claimed.
