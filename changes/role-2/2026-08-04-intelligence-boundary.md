# Establish the Role 2 intelligence boundary

- **Type:** Added
- **Role:** Role 2
- **Issue/PR:** UI-X09/#25; PR pending
- **Summary:** Added source-adapter interfaces, confidence-aware observation fusion, canonical snapshot builders, and validating intelligence/candidate provider factories so Role 2 can develop independently without bypassing Core or Role 3 authority.
- **Integration impact:** Role 1 must review and promote accepted UI-X09 examples into `@/core/testing`; Role 3 can consume structurally validated candidate batches through the existing canonical port.
- **Verification:** `npx vitest run src/extraction/observations.test.ts src/extraction/snapshots.test.ts src/ai/providers.test.ts src/ai/tests/ui-x09-fixtures.test.ts tests/integration/role-entrypoints.test.ts` passed 24 tests; `npm run check` passed lint, typecheck, the 64-file/155-import boundary scan, all 92 tests, and the production build.
- **Reality status:** Observation and provider behaviour is verified with fixture-only inputs. No OCR, live provider, real chat, OBS Virtual Camera frame, or live extraction claim is included; authorised real gameplay/chat fixtures and Role 1's frame harness remain pending.
