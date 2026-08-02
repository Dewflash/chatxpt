# Change Fragments

Every pull request adds exactly one Markdown fragment under the submitting role's directory:

```text
changes/role-<n>/YYYY-MM-DD-short-summary.md
```

Only the owning role edits its directory. Role 1 compiles fragments into `CHANGELOG.md` at integration, demo, or submission checkpoints.

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
- Link a cross-role issue when another role is affected.
- Do not edit `CHANGELOG.md` unless you are Role 1 compiling fragments.
