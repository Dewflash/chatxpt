# Role 1 To-Do: Integrations and Shared Platform

**Owner:** `Dewflash`

Update this file at the start and end of each Role 1 pass. Do not mark `DONE` without the listed evidence.

Execute these outcomes through `docs/build-plans/ROLE-1-BUILD-PLAN.md`; the plan defines phase order, owner decisions, deadlines, and pass-level evidence.

**Next after R1-P01 merges:** decide the Phase 1 gate once, then run R1-P02 ownership migration and publish R1-P03's thin contracts early enough for Roles 2/3 to adapt. R1-P07 account setup may proceed in parallel because it changes no shared contract.

| ID | Priority | Status | Task | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| R1-001 | P0 | DONE | Merge the beginner-safe team foundation. | None | Root/role guides, playbook, GitHub templates, CODEOWNERS, TODOs, changelog workflow, checks, and pushed PR. |
| R1-012 | P0 | DONE | Publish and operationalise the concurrent Role 1-3 build plans. | R1-001; D-017 through D-029 | Three plans define phases, decision gates, deadlines, real-data rules, acceptance evidence, ownership, onboarding links, and required reviews; `npm run check` and `git diff --check` pass. |
| R1-002 | P0 | READY | Perform the one-time mechanical ownership migration. | R1-001 | Files moved into recorded ownership boundaries with behaviour and checks preserved. |
| R1-003 | P0 | READY | Freeze version 1 shared contracts and platform-capability model. | R1-002; input from Roles 2-5 | Types and examples reviewed; Twitch-specific payloads excluded from core. |
| R1-004 | P0 | READY | Create Supabase Free project and minimal schema/realtime channels. | R1-003 | Profiles, sessions, quests, votes, progress/results sync across two browsers; RLS/secrets reviewed. |
| R1-005 | P0 | READY | Connect Vercel deployment and safe environment variables. | R1-004 | Role 1 deployment succeeds; preview/production URLs documented; no secrets in client or Git. |
| R1-006 | P0 | BLOCKED | Register Twitch app and Extension test version. | R1-011 | OAuth callback, test channel/allowlist, Viewer/Config/Live Config paths, Local or Hosted Test documented. |
| R1-007 | P0 | READY | Define and test OBS capture/output integration and setup. | R1-003 | OBS Virtual Camera exposes the raw game source to Studio for real-frame analysis; the Browser Source overlay hides when inactive, reconnects, and consumes normalised state. |
| R1-008 | P0 | BLOCKED | Integrate Roles 2-5 into the golden workflow. | R1-003 through R1-007; role deliverables | End-to-end evidence plus failure/fallback run. |
| R1-009 | P1 | READY | Maintain GitHub issues, decisions, changelog compilation, and integration notes. | Ongoing | Every merged PR has owner review, fragment, verification, and recorded cross-role outcomes. |
| R1-010 | P1 | BLOCKED | Assemble submission artifacts and invite Garena collaborator. | R1-008 | Required README/disclosures, deck, video, private repo access, and final checklist. |
| R1-011 | P0 | READY | Create the Role 1-controlled Twitch account and enable 2FA for developer application and Extension registration. | None | Role 1 can access the Twitch developer console and begin app/Extension setup without committing credentials. |

## Decisions Role 1 still owns

- Shared contract acceptance and breaking changes
- Supabase schema/realtime boundaries and Vercel deployment
- Twitch/OBS integration scope
- Integration overrides and cross-role disputes
- Final KPIs, demo narrative, feature freeze, and submission
