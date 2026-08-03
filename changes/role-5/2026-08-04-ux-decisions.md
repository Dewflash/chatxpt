# Settle the Role 5 viewer UX baseline

- **Type:** Changed
- **Role:** Role 5
- **Issue/PR:** #16 / pending
- **Summary:** Records the approved viewer tone, vote-confirmation, celebration, accessibility, and reversible visual-reference direction needed to finish the Role 5 feasibility gate.
- **Integration impact:** Role 2 must record accept/revise in issue #16 before Role 5 source implementation begins. Role 4's public design-system handoff remains the first implementation dependency. Role 5 also requested two consumer-boundary fixes on PR #31 without changing Role 1 files.
- **Verification:** This branch passed `npm run check` (lint, typecheck, boundaries, 73 tests, and production build) and `git diff --check`. PR #31 consumer review separately ran `npm run test:ui` (19/19), `npm run test:e2e` (8/8), `npm run check` (92 tests plus build and boundaries), and diff validation against commit `8f7fc8b`.
- **Reality status:** Planning and source inspection only. PR #31 checks used its labelled memory/fixture diagnostic path; no real Twitch, OBS, Supabase, or live multi-viewer behaviour is claimed.
