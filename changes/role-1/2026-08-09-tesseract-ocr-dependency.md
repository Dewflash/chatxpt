## Summary

- Accepted Role 2's selective-OCR dependency request by installing `tesseract.js` pinned at `7.0.0` in the shared package files.
- Recorded the worker/CSP, bounded named-crop, latency-measurement, and `unknown` fallback constraints in `docs/DECISIONS.md` without claiming deployed OCR or live OBS evidence.
- Cleared the existing `nanoid` audit finding through the package manager while updating the lockfile.

## Verification

- `npm ls tesseract.js nanoid`
- `npm audit --audit-level=moderate`
- `npm run test -- src/extraction/selective-ocr.test.ts src/extraction/real-input-evidence.test.ts src/extraction/visual-classification.test.ts tests/integration/environment.test.ts`
- `npm run test -- tests/integration/disclosures.test.ts`
- `npm run check`
