# Shared merge authority

- **Type:** Changed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** D-073 allows any contributor with repository merge permission to merge an independently reviewed pull request, regardless of which role owns the affected responsibility. Role 1 remains the default integration and deconfliction coordinator rather than the exclusive merger.
- **Integration impact:** Removes role-based and person-dependent merge gates while preserving pull requests, independent review, branch protection, automated checks, overlap resolution, evidence, change fragments, and material safety/security/privacy/data-loss/cost/golden-workflow gates.
- **Verification:** Documentation consistency audit, `git diff --check`, focused boundary checks, and the full repository check.
- **Reality status:** Repository workflow and authority documentation only; GitHub collaborator permissions and branch-protection settings are not changed by this commit.
