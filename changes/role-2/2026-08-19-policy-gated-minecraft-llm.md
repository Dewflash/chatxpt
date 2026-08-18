# Policy-gated Minecraft extraction and server-side candidate generation

- **Type:** Added
- **Role:** Role 2
- **Issue/PR:** #132 / #138
- **Summary:** Adds the vanilla Minecraft demo profile and a fail-closed multi-game extraction pipeline, plus the approved opt-in `gpt-5.6-terra` candidate path with mandatory algorithmic recovery.
- **Integration impact:** Role 1 may compose the Role 2 server provider and gameplay pipeline through their public/server entrypoints. No canonical contract, Role 1 source, or Role 3 source changed.
- **Verification:** Focused Role 2 suites, TypeScript, ownership boundaries, and the full project check (59 test files / 443 tests plus a successful production build and client-secret scan).
- **Reality status:** Pixel, OCR, and provider transports are fixture/diagnostic only in this change. No real OpenAI request, API spend, live Minecraft calibration, or live extraction claim is included; live facts remain unknown until matching real evidence supplies an approved live policy.
