# ChatXPT Build Plans

These plans turn the accepted product decisions into concurrent, reviewable work for Roles 1-3. They are execution authority beneath root `AGENTS.md` and `docs/DECISIONS.md`: if a plan conflicts with either, the root authority wins.

## Required reading

Before starting a pass, read in this order:

1. `AGENTS.md`
2. `docs/DECISIONS.md`
3. `docs/TEAM_CONTEXT.md`
4. `docs/TEAM_PLAYBOOK.md`
5. Your role guide and TODO under `docs/roles/`
6. `docs/build-plans/INTEGRATION-CONTRACT.md`
7. Your build plan in this directory

## Evidence-gated expansion plan

`LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md` records the project-owner-requested isolated-pass sequence for the proposed Live Director expansion and the accepted D-074 three-surface rule. It is planning evidence, not active source authority: `LD-P01` and later passes begin only after the secondary-research `LD-P00` gate produces an accepted keep/defer/reject scope. The existing Role 1-5 plans remain the implementation authority until that activation record exists.

## Responsibility for the plans

- Role 1 defines required phases, order, outcomes, deadlines, acceptance criteria, and integration boundaries for Roles 1-3.
- Joelyrk decides the Role 2 component choices named at each Role 2 decision gate.
- L0pch decides the Role 3 component choices named at each Role 3 decision gate.
- Any contributor may propose or implement a better sequence or scope, but must record departures from the accepted plan. The author and independent reviewer resolve overlap with Role 1 available for integration help; only a material unresolved product or safety decision requires project-owner settlement before merge.
- Role 2 separately authors the Role 4 and Role 5 plans under D-016. Those plans must use the same phase/pass/decision/evidence structure.

## Concurrent execution model

Roles 1-3 begin together:

```text
Role 1: migrate safely + publish thin contracts + create infrastructure
Role 2: publish Role 4/5 plans + build intelligence against owned fixtures
Role 3: build the quest engine against owned candidate fixtures
                          |
                          v
              integrate through Role 1 contracts
```

Role 2 does not wait for live Twitch or a completed quest engine. Role 3 does not wait for live AI or Supabase. Role 1 must publish the first contract skeleton early, then accept or reject proposed changes quickly.

No role builds to completion in isolation. A wave exits only from merged `main` after the producing and consuming roles pass the relevant contract test. Role 1's application orchestrator is the sole composition/persistence/broadcast layer defined in `INTEGRATION-CONTRACT.md`.

## Real-data evidence rule

- Judged workflow evidence uses real gameplay captured through OBS Virtual Camera and real Twitch activity.
- The controlled Test Lab may use team-owned or explicitly authorised gameplay and the team-controlled Twitch test channel.
- Simulated fixtures are allowed only in automated tests, developer diagnostics, and offline reproduction.
- A missing real signal is `unknown`; it is never fabricated.
- Algorithmic fallback means algorithms running on real inputs, not invented gameplay events.

## Pass rules

Every pass:

- Has one owner and one acceptance signal.
- Fits in one short-lived `role-<n>/<summary>` branch and one pull request where practical.
- Places code in the directory matching its runtime responsibility; any contributor may change multiple role directories without prior approval.
- Begins by asking the phase's open owner decisions in one batch.
- Uses fixtures at the role boundary so another unfinished role does not block progress.
- Exposes one documented public entry point and never imports another role's private modules.
- Updates the matching role TODO and adds a role-owned change fragment.
- States what was tested with real input, fixtures, algorithms, AI, or fallback.
- Runs the smallest relevant checks while working and `npm run check` before merge handoff.

## Decision gates

At the start of a phase, the role's Codex agent must:

1. Read the current build-plan decision table.
2. Ask only the open decisions assigned to that owner, in one consolidated batch.
3. Give a recommendation and implementation consequence for each.
4. Record settled answers when the pass depends on them. Any contributor may update the relevant plan or execution record while notifying its responsibility lead.
5. Send shared-contract, cost, safety, privacy, or scope decisions to Role 1.

Internal decisions do not require Role 1 approval. Product direction, architecture, cost, safety, and privacy decisions still require project-owner settlement before merge. Role 1 remains informed through the pull request and actively helps deconflict cross-role implementation.

## Integration waves

| Wave | Role 1 | Role 2 | Role 3 | Exit signal |
| --- | --- | --- | --- | --- |
| 0: Start | Publish plans and protect branches | Draft Role 4/5 plans | Prepare engine boundary | Plans and owners are unblocked |
| 1: Boundaries | Publish thin contracts and orchestrator ports; scaffold/migrate ownership; run risk spikes | Create owned ports, fixtures, and extraction spike | Create owned ports, fixtures, and state-machine skeleton | Producer and consumer contract tests pass together on `main` |
| 2: Core | Supabase/Vercel and real capture interfaces | Real-frame extraction and audience intelligence | Lifecycle, intervention, validation, and fallback | Each role demonstrates its subsystem independently |
| 3: Behaviour | Twitch/OBS integration | Free AI/algorithmic candidates and evaluation | Voting, activation, progress, results, and rewards | Role 2 output drives Role 3 end to end |
| 4: Product | Integrate Roles 4/5 and realtime clients | Fix intelligence failures from real runs | Fix engine failures from real runs | Golden workflow works across two viewers and OBS |
| 5: Owner-called freeze | Evidence, deployment, and—after an explicit product-readiness declaration—deck, video, and submission | Evaluation evidence and declared limitations | Lifecycle/safety evidence and declared limitations | No unverified feature claims remain |

## Five-day delivery calendar

Dates are Singapore time. These are integration deadlines, not permission for one role to absorb another role's component decisions.

| Deadline | Required exit |
| --- | --- |
| 3 Aug | Role 1-3 plans are authoritative; Role 2 sends synchronised Role 4/5 plans for feasibility review; Role 3 starts boundary fixtures; Role 1 starts Twitch/OBS/Supabase/Vercel feasibility spikes. |
| 4 Aug, 18:00 | Contract/orchestrator skeleton and route/public-entry scaffolding are reviewable; producer/consumer contract tests pass; ownership migration continues behind those boundaries. |
| 5 Aug, 18:00 | Supabase/Vercel and capture boundaries exist; Role 2 demonstrates real-frame extraction; Role 3 demonstrates lifecycle, validation, and fallback independently. |
| 6 Aug, 18:00 | Real Role 2 outputs drive Role 3; Twitch/OBS integration and voting/activation/progress paths are connected. |
| 7 Aug, 12:00 | Roles 4/5 are integrated; one-streamer/two-viewer golden workflow and failure matrix are testable. |
| 7 Aug, 18:00 | Target for a complete P0 integration and evidence checkpoint. This is not an automatic freeze; only the project owner may call one. |
| 8 Aug | Continue full integration and real evidence capture. Rehearsal, deck, video, and final narrative work begin only after the project owner declares the product ready. |
| 9 Aug | Clean-clone check, deployed-link check, repository access, immutable package, and submission confirmation. |

If a deadline slips, the role owner immediately reports the failed exit signal, evidence, smallest recovery scope, and decisions needed. Role 1 reprioritises; nobody silently lowers the real-data or safety standard.

## Integration evidence rule

Separate screenshots or passing unit tests from five components do not prove the product works. Each integration wave must show one session/cycle revision travelling through the relevant public seams. The final proof uses the same authoritative state in Studio, two viewer clients, and the OBS overlay.

## Handoff format

```text
Outcome:
Pass ID:
Branch / commit / PR:
Inputs and outputs exercised:
Public seams and canonical fixture IDs:
Authoritative session/cycle revision:
Real-data evidence:
Fixture-only evidence:
Commands run and results:
Fallback and unknown behavior checked:
Decisions settled:
Contract proposals:
Known blockers / next owner:
```
