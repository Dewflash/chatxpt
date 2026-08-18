# Shared merge authority

- **Type:** Changed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** D-073 allowed any contributor with repository merge permission to merge an independently reviewed pull request, regardless of which role owns the affected responsibility. D-076 later superseded the mandatory review and branch-protection parts.
- **Integration impact:** Removed role-based and person-dependent merge gates. D-076 now preserves pull requests, review, and checks as useful workflow tools rather than mandatory gates, while keeping overlap resolution, evidence, change fragments, and material safety/security/privacy/data-loss/cost/golden-workflow gates.
- **Verification:** Documentation consistency audit, `git diff --check`, focused boundary checks, and the full repository check.
- **Reality status:** Repository workflow and authority documentation only; GitHub collaborator permissions and branch-protection settings were not changed by this commit.
