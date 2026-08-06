# Add deterministic progress and outcome policy

- **Type:** Added
- **Role:** Role 3
- **Summary:** Added pure monotonic manual progress, evidence-gated automatic progress, terminal scoring, session hype, cooldown, and history-disposition rules.
- **Integration impact:** Role 1 still needs to supply the canonical progress/reward seam tracked in #50, the accepted tick command tracked in #36, and stamp/persist/broadcast reward events; no private command or persistence path was added.
- **Reality status:** Deterministic fixture/component evidence only. Automatic progress is not claimed as live until real Role 2 signals traverse the accepted Role 1 command seam.
