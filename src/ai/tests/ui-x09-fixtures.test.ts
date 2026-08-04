import { describe, expect, it } from "vitest";

import { candidateBatchSchema, intelligenceSnapshotSchema } from "../../core";
import {
  role2UiX09GenerationFixtures,
  role2UiX09IntelligenceFixtures,
} from "./ui-x09-fixtures";

describe("Role 2 UI-X09 fixture proposals", () => {
  it("keeps every intelligence example valid and explicitly fixture-only", () => {
    for (const fixture of Object.values(role2UiX09IntelligenceFixtures)) {
      expect(intelligenceSnapshotSchema.safeParse(fixture).success).toBe(true);
      expect(fixture.envelope.evidenceClass).toBe("fixture");
      expect(fixture.gameplay.envelope.evidenceClass).toBe("fixture");
      expect(fixture.audience.envelope.evidenceClass).toBe("fixture");
    }
  });

  it("covers provider, algorithmic, and deterministic fallback metadata", () => {
    const fixtures = Object.values(role2UiX09GenerationFixtures);
    expect(fixtures.map(({ batch }) => batch.candidates[0].generation.method)).toEqual([
      "ai-provider",
      "algorithmic",
      "deterministic-fallback",
    ]);
    for (const { batch } of fixtures) {
      expect(candidateBatchSchema.safeParse(batch).success).toBe(true);
      expect(batch.envelope.evidenceClass).toBe("fixture");
      expect(batch.candidates).toHaveLength(3);
    }
  });

  it("includes low-confidence, unsupported, stale, and permission-denied observations", () => {
    const statuses = Object.values(role2UiX09IntelligenceFixtures).flatMap((fixture) =>
      fixture.gameplay.signals.map(({ observation }) =>
        observation.status === "unknown"
          ? `${observation.status}:${observation.reason}`
          : observation.status,
      ),
    );

    expect(statuses).toEqual(
      expect.arrayContaining([
        "known",
        "unknown:low-confidence",
        "unknown:unsupported",
        "stale",
        "unknown:permission-denied",
      ]),
    );
  });
});
