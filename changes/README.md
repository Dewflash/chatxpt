# Change Fragments

Every pull request adds exactly one Markdown fragment under the submitting role's directory:

```text
changes/role-<n>/YYYY-MM-DD-short-summary.md
```

The directory names the primary responsibility affected, not who may edit the fragment. Any contributor may add or update it. Role 1 coordinates compilation into `CHANGELOG.md` at integration, demo, or submission checkpoints and deconflicts concurrent compilation work.

Use this template:

```markdown
# Short outcome

- **Type:** Added | Changed | Fixed | Security | Deprecated | Removed
- **Role:** Role N
- **Issue/PR:** #number or pending
- **Summary:** Plain-language user or integration outcome.
- **Integration impact:** None, or list affected contracts/roles.
- **Verification:** Commands and flows actually run.
- **Reality status:** What is real, mocked, simulated, or fallback.
```

Rules:

- Describe the outcome, not every file touched.
- Never include secrets or personal viewer data.
- Link a cross-role issue when one exists; creating one is optional unless an unresolved durable decision needs tracking.
- Any contributor may compile `CHANGELOG.md`; check for overlap and coordinate the collision-prone edit with Role 1 before merge.
