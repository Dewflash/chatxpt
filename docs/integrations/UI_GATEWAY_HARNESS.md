# UI Gateway And Harness Policy

D-060 defines the safe local integration surface for Roles 4 and 5 while their final public modules are still landing.

## Browser Client Rules

UI clients consume Role 1 state through the browser-safe gateway pattern:

- same-origin credentials;
- no-store reads;
- typed command results;
- current revision returned with every command/read result;
- no vote, timer, reward, lifecycle, permission, persistence, or fallback-selection authority in UI code.

## Diagnostic Harness Rules

The local harness is a fixture tool, not product evidence:

- visibly label fixture state;
- set `liveInputsUsed` to false;
- publish canonical fixture catalogues for setup/readiness, intelligence, generation, quest states, and history;
- mount Studio, Twitch Config, Twitch Live Config, Viewer Board, hosted-board, and OBS overlay panes;
- gate diagnostic API routes in production unless Role 1 deliberately enables them for controlled verification.

## Required Verification

Before claiming this seam is ready for a role handoff:

```bash
npm run test -- tests/integration/ui-gateway.test.ts tests/integration/diagnostic-ui-harness.test.tsx tests/integration/ui-gateway-harness-policy.test.ts
npm run check
```

Browser screenshot verification is handled by `scripts/verify-ui-harness.mjs` when a local server is running. Those screenshots remain fixture-only evidence unless replaced by role-owned modules and real inputs.
