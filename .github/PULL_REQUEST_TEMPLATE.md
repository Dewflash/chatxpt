## Outcome

Describe the user-visible or integration outcome in plain language.

## Responsibility and coordination

- Role: <!-- Role 1 / 2 / 3 / 4 / 5 -->
- Owner: <!-- GitHub username -->
- Build-plan phase/pass: <!-- e.g. R2-P04 -->
- Issue: <!-- Closes #... or N/A -->
- Cross-role issue: <!-- #... or N/A -->

## Scope

- Primary responsibility directories changed:
- Cross-role/shared directories changed: <!-- Allowed; explain overlap checks, notifications, and deconfliction. -->
- Shared contracts changed:
- Public entry point/seam exercised:
- Producer and consumer affected:
- Accepted decisions affected:

## Real, mocked, and simulated behaviour

- Real:
- Mocked/fallback:
- Simulated:
- Not implemented:

Live or integration claims must identify the real captured input used. Fixture-only results prove components, not the judged workflow.

## Verification

List only commands and flows actually run. Do not claim runtime proof from source inspection.

```text
npm run ...
```

- Result:
- Screenshots/recording for UI changes:
- Evidence manifest ID(s), or reason none applies:
- Evaluation/test evidence for AI or engine changes:
- Producer/consumer contract evidence:
- Authoritative session/cycle revision exercised:
- Golden Twitch workflow impact:

## Risks and recovery

- Known limitations:
- Failure/reconnect behaviour:
- Rollback or fallback:

## Team records

- [ ] My role TODO is updated.
- [ ] A fragment was added under `changes/role-<n>/`.
- [ ] Documentation reflects the implemented behaviour.
- [ ] New runtime, screenshot, recording, evaluation, or inspection evidence is recorded in `docs/evidence/manifest.json`, or this PR explains why no evidence entry applies.
- [ ] Settled decision-gate answers and completed-pass evidence are recorded in my execution plan.
- [ ] Public seams use canonical examples and do not import another role's private modules.
- [ ] Both producer and consumer contract tests pass when a cross-role seam changed.
- [ ] Relevant responsibility leads and Role 1 were notified of substantial cross-role work; any unresolved decision has a coordination issue.
- [ ] No secrets, `.env.local`, real viewer data, or unrelated files are included.
- [ ] `git diff --check` passes.
- [ ] Relevant tests pass.
- [ ] `npm run check` passes, or the exact blocker is documented above.

## Review requests and integration

- [ ] Relevant responsibility leads were requested for role-specific context; their response is advisory, not an edit/push permission gate.
- [ ] Role 1 reviewed integration impact.
- [ ] Two reviewers were requested for shared contracts, authentication, safety, or demo-critical integration.
- [ ] Current `main` and overlapping branches/PRs were checked; textual and semantic conflicts were deconflicted before merge.
