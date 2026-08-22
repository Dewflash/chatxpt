# Authoritative Gameplay Capture preview

- **Type:** Fixed
- **Role:** Role 1
- **Issue/PR:** pending
- **Summary:** Gameplay Engine now presents Screen/Window and OBS Virtual Camera as two equally visible one-click capture buttons, names the selected source, keeps its exact live feed visible while capture is connected, and accepts the analyzer's bounded 640x360 Minecraft sample instead of rejecting it at the older 16,384-pixel sampler ceiling.
- **Integration impact:** Role 1 capture passes the operator-visible video directly into the bounded frame sampler instead of first copying a potentially 4K/Retina feed into a full-resolution canvas; Role 4 capture UI no longer hides OBS in a dropdown or claims connected when preview playback/frame readiness fails; Role 2's browser sampler and multi-game analyzer share the same 262,144-pixel maximum while the lightweight visual-measurement path keeps its smaller limit.
- **Verification:** After the source-button and direct-preview sampling fixes, five focused extraction/capture/preview files passed 58 tests, TypeScript passed, and `git diff --check` passed for the affected capture files. The earlier preview pass completed `npm run check` at 109 test files / 849 tests plus lint, TypeScript, boundaries, hygiene/evidence/runbook checks, production build, and client-secret scan; the full gate has not been rerun after these focused corrections.
- **Reality status:** Playback, source-label, false-success, and same-video sampling behavior are automated with browser-contract test doubles. The native macOS/Safari screen picker and real OBS Virtual Camera remain operator-run external evidence.
