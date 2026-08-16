# Integrate authenticated Gameplay Capture

- **Type:** Added
- **Role:** Role 1 using the D-015 integration override
- **Issue/PR:** pending
- **Summary:** Integrated the bounded multi-game analyzer, session-scoped gameplay-ingress grants, memory/Supabase current-snapshot storage, and command-time orchestrator hydration. Product-facing diagnostics now use the accepted Gameplay Capture, Gameplay Activity, Capture Health, Signal Confidence, Detected Game Facts, and Game Profile vocabulary.
- **Integration impact:** Role 2 review is requested for the preserved extraction decisions. The stable activity presentation collapses analyzer-specific motion into Active, Quiet, Transition, or Unknown without changing canonical lifecycle authority.
- **Verification:** Focused extraction, gameplay-auth, persistence, orchestrator, TypeScript, lint, and vocabulary tests pass. Full repository verification runs at the end of the isolated integration passes.
- **Reality status:** Source, memory, migration, and fixture/diagnostic evidence only. No real OBS frame, Supabase Cloud deployment, Vercel deployment, or live extraction claim is added.
