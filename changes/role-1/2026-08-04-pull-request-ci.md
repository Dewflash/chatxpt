# Add automated pull-request checks

- **Type:** Added
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Runs the repository's locked install and complete check pipeline automatically for every pull request, cancelling superseded runs for the same PR.
- **Integration impact:** All five roles receive one shared required-check signal without deployment credentials or role-specific workflow logic.
- **Verification:** Workflow syntax and diff validation were inspected locally; `npm run check` verifies the same command executed by CI. The first GitHub-hosted run remains the external execution boundary.
- **Reality status:** The workflow is real repository automation. No deployment, Twitch, OBS, Supabase cloud, or product runtime behaviour is claimed.
