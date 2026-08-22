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

## Active evidence-gated expansion plan

`LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md` records D-074's three-surface rule and D-075's accepted keep/defer/reject scope. It is active source authority for ten isolated passes: five driven by Role 1 and five driven by Role 3. The plan remains evidence-gated—activation does not prove solution fit—and it supplements the Role 1/Role 3 plans without replacing the existing runtime-responsibility, exactly-three, fallback, privacy, or real-evidence rules.

## Active integrated product completion plan

`INTEGRATED-PRODUCT-COMPLETION-PLAN.md` records the D-083/D-085 completion bar, owner-reviewed snapshot gate, complete unavailable-capability inventory, and the cross-role vertical slices that turn the current partial surfaces and disconnected runtime seams into one owner-testable streamer product. It supersedes older runtime-first sequencing only where D-085 says so; all role boundaries, privacy/safety rules, exact-three authority, and real-input evidence requirements remain.

`APP_STATE_SINGLE_SOURCE_OF_TRUTH.md` records the required final hardening pass for consistent health, readiness, freshness, fallback, and revision display across Studio, viewers, fallbacks, and OBS after the remaining feature branches are reconciled.

## Responsibility for the plans

- Role 1 defines required phases, order, outcomes, deadlines, acceptance criteria, and integration boundaries for Roles 1-3.
- Joelyrk decides the Role 2 component choices named at each Role 2 decision gate.
- L0pch decides the Role 3 component choices named at each Role 3 decision gate.
- Any contributor may propose or implement a better sequence or scope, but must record departures from the accepted plan. The contributor landing the work resolves overlap with Role 1 available for integration help; only a material unresolved product or safety decision requires project-owner settlement before merge.
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

## Current cleanup and completion focus

The original five-day proposal calendar is complete historical context and is no longer active planning guidance. Current work follows the integrated completion plan, the single-source-of-truth hardening note, and the stale-content cleanup register:

- finish the owner-testable Twitch/OBS demo flow from `/studio` through viewer participation and `/obs-overlay`;
- keep Twitch Extension primary, hosted Quest Board fallback, and Twitch chat `1`/`2`/`3` fallback intact;
- remove or relabel old local prototype routes only after the canonical paths have focused test coverage;
- report every unverified Twitch, OBS, Supabase, provider, or multi-viewer claim as open evidence rather than product completion.

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
