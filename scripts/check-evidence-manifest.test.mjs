import assert from "node:assert/strict";
import test from "node:test";

import { validateEvidenceManifest } from "./check-evidence-manifest.mjs";

function validManifest() {
  return {
    schemaVersion: "1.0.0",
    updatedAt: "2026-08-03",
    resources: [
      {
        id: "browser-fixture",
        label: "Browser fixture",
        owner: { role: "role-1", github: "Dewflash" },
        status: "assigned",
        requiredBy: "R1 test",
        custody: "local-only",
        notes: "Contains no private identity.",
      },
    ],
    entries: [],
  };
}

test("accepts the privacy-safe empty evidence baseline", () => {
  assert.deepEqual(validateEvidenceManifest(validManifest()), []);
});

test("rejects private links and identity fields", () => {
  const manifest = validManifest();
  manifest.resources[0].accountName = "private-viewer";
  manifest.resources[0].notes = "Stored at https://drive.example/private";

  const errors = validateEvidenceManifest(manifest);

  assert.ok(errors.some((error) => error.includes("accountName")));
  assert.ok(errors.some((error) => error.includes("private URL")));
});

test("rejects an evidence class that does not match the executed input", () => {
  const manifest = validManifest();
  manifest.entries.push({
    id: "E-20260803-R1-001",
    capturedAt: "2026-08-03T12:00:00+08:00",
    owner: { role: "role-1", github: "Dewflash" },
    reviewer: { role: "role-1", github: "Dewflash" },
    evidenceClass: "real",
    result: "passed",
    claim: "A deliberately invalid real-evidence example.",
    resourceIds: ["browser-fixture"],
    surfaces: [{ name: "gateway", deviceClass: "server", viewport: null }],
    source: { gitCommit: "61d3e4e", branch: "main", prNumber: 31 },
    authoritativeState: { sessionRef: null, questCycleRef: null, revision: null },
    inputs: [{ kind: "fixture", description: "Fixture state only." }],
    commands: ["npm run test"],
    artifacts: [
      {
        storage: "github-pr",
        reference: "PR #31",
        mediaType: "text/html",
        privacyReviewed: true,
      },
    ],
    limitations: ["This must not pass as real evidence."],
  });

  const errors = validateEvidenceManifest(manifest);

  assert.ok(errors.some((error) => error.includes("must include a real input")));
});
