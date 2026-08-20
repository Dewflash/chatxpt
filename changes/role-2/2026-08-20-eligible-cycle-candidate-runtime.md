# Eligible-cycle candidate runtime

- **Owner:** Role 2
- **Summary:** The configured provider-with-fallback boundary is mounted in the production server runtime for policy-gated eligible-cycle proposal requests. Generated candidates now pass through Role 3's assembler before storage, and concurrent requests for one session/cycle/revision share one process-local in-flight generation request. The credential-free algorithmic path remains available when provider credentials are absent.
- **Evidence:** Integration tests prove Role 3 replacement before persistence and one generation call for two simultaneous same-revision requests. `npm run check` passes with 717 tests and the production build. Cross-instance provider reservation, real gameplay execution, credited provider execution, and quest-quality evidence remain open.
