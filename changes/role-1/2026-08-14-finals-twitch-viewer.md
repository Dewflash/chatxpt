# Repair the authenticated Twitch viewer path for finals

- **Role:** Role 1 integration override, explicitly authorised by the project owner with Role 5 review waived for this urgent pass
- **Summary:** Added server-side Twitch Extension HS256 JWT verification, pseudonymous session-scoped viewer identity, Twitch-channel session lookup in memory and Supabase, canonical viewer projection, authenticated snapshot/vote routes, private acknowledgement/recovery, the Role 5 viewer mount, a build-owned EBS destination for Asset Hosting, and local Studio-to-canonical diagnostic-cycle staging.
- **Integration impact:** Viewer clients no longer invent voter IDs or submit session/channel/actor authority. Exactly three staged candidates enter Role 3's proposal/approval flow, all votes use the authoritative orchestrator and one-vote ledger, shared snapshots remain sanitised, and pre-acknowledgement API views omit tallies. Reactions and points remain non-blocking/open.
- **Evidence boundary:** Signed fixture JWTs and memory integration prove application behaviour only. Real Twitch issuance, Local/Hosted Test delivery, external Supabase persistence, and public Extension approval remain unverified until recorded in the evidence manifest.
- **Verification:** Focused JWT, EBS, Supabase-directory, and static-package tests; full repository checks required before handoff.
