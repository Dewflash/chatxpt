## Outcome

Describe the user-visible or integration outcome in plain language.

## Ownership

- Role: <!-- Role 1 / 2 / 3 / 4 / 5 -->
- Owner: <!-- GitHub username -->
- Issue: <!-- Closes #... or N/A -->
- Cross-role issue: <!-- #... or N/A -->

## Scope

- Owned directories changed:
- Other-role directories changed: <!-- Must be none unless Role 1 override or target-owner approval is recorded. -->
- Shared contracts changed:
- Accepted decisions affected:

## Real, mocked, and simulated behaviour

- Real:
- Mocked/fallback:
- Simulated:
- Not implemented:

## Verification

List only commands and flows actually run. Do not claim runtime proof from source inspection.

```text
npm run ...
```

- Result:
- Screenshots/recording for UI changes:
- Evaluation/test evidence for AI or engine changes:
- Golden Twitch workflow impact:

## Risks and recovery

- Known limitations:
- Failure/reconnect behaviour:
- Rollback or fallback:

## Team records

- [ ] My role TODO is updated.
- [ ] A fragment was added under `changes/role-<n>/`.
- [ ] Documentation reflects the implemented behaviour.
- [ ] Cross-role proposals were recorded before implementation.
- [ ] No secrets, `.env.local`, real viewer data, or unrelated files are included.
- [ ] `git diff --check` passes.
- [ ] Relevant tests pass.
- [ ] `npm run check` passes, or the exact blocker is documented above.

## Review requirements

- [ ] Assigned role owner reviewed role-specific files.
- [ ] Role 1 reviewed integration impact.
- [ ] Two reviewers were requested for shared contracts, authentication, safety, or demo-critical integration.
