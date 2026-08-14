# Integrate bounded current gameplay state

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Add a server-owned latest-gameplay repository for memory and Supabase, validate every snapshot against active session/cycle/revision/evidence authority, and hydrate the sole orchestrator at command time.
- **Integration impact:** Frame analysis does not create authoritative revisions or store raw images. Each frame can follow the latest realtime quest-cycle/revision authority, a matching snapshot is copied into the next accepted command state, stale or cross-state observations are ignored, and capture health is projected through the existing service-health contract.
- **Verification:** Focused Core/orchestrator/persistence/Supabase tests, TypeScript, boundary checks, full repository checks, and database migration tests. Authenticated browser ingress and real OBS execution remain follow-up evidence and are not claimed by this pass.
