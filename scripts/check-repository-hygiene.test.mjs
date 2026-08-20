import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  findBrokenMarkdownLinks,
  findForbiddenTrackedFiles,
  findStaleVerificationClaims,
} from "./check-repository-hygiene.mjs";

test("rejects tracked secrets, local clutter, and generated output", () => {
  assert.deepEqual(
    findForbiddenTrackedFiles([
      ".env.example",
      "README.md",
      ".env.local",
      "docs/.DS_Store",
      "tmp/capture.json",
      "src/debug.log",
    ]),
    [".env.local", "docs/.DS_Store", "tmp/capture.json", "src/debug.log"],
  );
});

test("reports broken local Markdown targets but permits anchors and external links", () => {
  const root = mkdtempSync(join(tmpdir(), "chatxpt-hygiene-links-"));
  try {
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "README.md"), "# Repository\n");
    writeFileSync(
      join(root, "docs", "guide.md"),
      "[Root](../README.md#repository) [Missing](missing.md) [Anchor](#local) [Web](https://example.com)\n",
    );

    assert.deepEqual(findBrokenMarkdownLinks(root, ["README.md", "docs/guide.md"]), [
      "docs/guide.md -> missing.md",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects merged change records that still claim verification is pending", () => {
  const root = mkdtempSync(join(tmpdir(), "chatxpt-hygiene-fragments-"));
  try {
    mkdirSync(join(root, "changes", "role-1"), { recursive: true });
    writeFileSync(join(root, "changes", "role-1", "clean.md"), "Verification passed.\n");
    writeFileSync(
      join(root, "changes", "role-1", "stale.md"),
      "Pending in this pass: run the tests.\n",
    );

    assert.deepEqual(
      findStaleVerificationClaims(root, [
        "changes/role-1/clean.md",
        "changes/role-1/stale.md",
      ]),
      ["changes/role-1/stale.md"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
