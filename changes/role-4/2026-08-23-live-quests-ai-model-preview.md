# Preview model selection in Live Quests

- **Type:** Changed
- **Role:** Role 4
- **Issue/PR:** pending
- **Summary:** The `Why these were recommended` footer now keeps the complete rationale on the left and adds a compact right-aligned `Select AI model` segment. Its local status toggles between `Deterministic fallback` and `AI enabled · Preview only` using provider-neutral options.
- **Integration impact:** Presentation only. The selector is neither persisted nor sent to the server, and `Generate quest now` continues emitting the canonical `deterministic-fallback` generation command. No provider/model name, credential, contract, quest-engine behavior, or deterministic validation boundary changes.
- **Verification:** Focused Live Quests rendering and command-construction coverage passed 2 files / 58 tests; scoped ESLint, TypeScript, role-boundary, and task diff checks passed. The production-build portion of the full gate was not rerun while the owner's active `dev:twitch` process used the same Next.js workspace.
- **Reality status:** Source and canonical fixture rendering only. No AI provider invocation, model switching, persisted preference, or owner browser layout evidence is claimed.
