# Enforce role dependency boundaries

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** #9
- **Summary:** Added an executable import-boundary check and a factual legacy migration inventory so five contributors can work without private cross-role dependencies.
- **Integration impact:** Role modules must consume allowed public entrypoints; tests may use canonical test fixtures; the existing legacy app remains temporarily buildable without being treated as migrated.
- **Verification:** Boundary self-tests, repository boundary scan, `npm run check`, and `git diff --check` before merge.
- **Reality status:** This is source-architecture and documentation evidence only; it does not implement or prove live product behavior.
