# Add provider-neutral failure and fallback evaluation

- **Type:** Added
- **Role:** Role 2
- **Issue/PR:** pending
- **Summary:** Added a provider-neutral candidate strategy that measures classified provider outcomes and uses an injected credential-free algorithmic strategy after normal provider failure.
- **Integration impact:** Role 1 may compose the public Role 2 strategy after the joint provider decision; Role 3 continues to validate every returned candidate and owns deterministic fallback.
- **Verification:** Focused AI tests pass 22 cases, canonical contract tests pass 18 cases, role boundaries pass, and `npm run check` passes 22 test files/191 tests plus lint, typecheck, evidence validation, and the production build; `git diff --check` passes.
- **Reality status:** Implementation and tests are fixture-only. No external provider/model, real provider call, concrete algorithmic policy, secret, real gameplay/chat input, or end-to-end result is included or claimed.
