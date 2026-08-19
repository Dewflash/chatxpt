import { describe, expect, it } from "vitest";

import {
  intelligenceSnapshotSchema,
  liveDirectorStateSchema,
  streamerProfileSchema,
  type QuestCandidate,
} from "../core";
import { contractFixtureLiveDirectorState } from "../core/testing";
import { DefaultDirectorCueConverter } from ".";
import {
  ROLE_3_FIXTURE_TIME,
  role3CandidateCases,
  role3FixtureCandidateBatch,
  role3FixtureIdleState,
  role3IntelligenceCommand,
} from "./testing";

const profile = streamerProfileSchema.parse({
  profileId: "role-3-cue-conversion-profile",
  streamerId: "role-3-cue-conversion-streamer",
  revision: 0,
  displayName: "Role 3 Cue Conversion Fixture",
  gameId: null,
  gameName: null,
  experience: { intensity: 0.5 },
  restrictions: [],
  preferredQuestTypes: [],
  forbiddenQuestTypes: [],
  accessibilityNeeds: [],
});

const intelligence = intelligenceSnapshotSchema.parse({
  envelope: {
    ...role3FixtureIdleState.envelope,
    messageId: "role-3-cue-conversion-intelligence",
  },
  gameplay: {
    envelope: {
      ...role3FixtureIdleState.envelope,
      messageId: "role-3-cue-conversion-gameplay",
    },
    capabilities: {
      tier: "universal-visual",
      gameId: null,
      adapterId: null,
      supportedSignals: [],
    },
    signals: [],
  },
  audience: {
    envelope: {
      ...role3FixtureIdleState.envelope,
      messageId: "role-3-cue-conversion-audience",
    },
    sampleSize: 0,
    signals: [],
  },
});

const convertedLiveDirector = liveDirectorStateSchema.parse({
  ...contractFixtureLiveDirectorState,
  cue: {
    ...contractFixtureLiveDirectorState.cue!,
    state: "converted",
    reason: "Streamer requested exactly-three candidate conversion",
    updatedAt: ROLE_3_FIXTURE_TIME + 1_000,
    availableActions: [],
  },
  updatedAt: ROLE_3_FIXTURE_TIME + 1_000,
});

function input(
  overrides: Partial<Parameters<DefaultDirectorCueConverter["convert"]>[0]> = {},
) {
  return {
    liveDirector: convertedLiveDirector,
    envelope: { ...role3FixtureCandidateBatch.envelope, source: "quest-engine" as const },
    candidates: role3FixtureCandidateBatch.candidates,
    intelligence,
    profile,
    currentState: role3FixtureIdleState,
    recentQuests: [],
    now: ROLE_3_FIXTURE_TIME + 1_000,
    seed: "role-3-cue-conversion-seed",
    command: role3IntelligenceCommand(),
    emergencyPaused: false,
    sessionEnded: false,
    questImpossible: false,
    ...overrides,
  };
}

function unsafeCandidate(index: number, method: QuestCandidate["generation"]["method"] = "algorithmic") {
  return {
    ...role3CandidateCases.unsafe.candidates[0],
    candidateId: `cue-conversion-unsafe-${index}`,
    generation: {
      method,
      provider: method === "ai-provider" ? "openai" : null,
      generatedAt: ROLE_3_FIXTURE_TIME,
    },
  };
}

describe("DefaultDirectorCueConverter", () => {
  it("routes a converted cue to exactly three private streamer-approval options", () => {
    const result = new DefaultDirectorCueConverter().convert(input());

    expect(result).toMatchObject({
      ok: true,
      cueId: "fixture-director-cue",
      readyForStreamerApproval: true,
      decision: {
        nextState: {
          status: "proposed",
          availableStreamerActions: expect.arrayContaining(["approve", "reject"]),
        },
        events: [
          { eventType: "quest-cycle.proposed" },
          {
            eventType: "live-director.cue-conversion-ready",
            attributes: {
              candidateCount: 3,
              fallbackCount: 0,
              streamerApprovalRequired: true,
              candidatePublication: false,
            },
          },
        ],
      },
    });
    if (!result.ok) return;
    expect(result.batch.candidates).toHaveLength(3);
    expect(result.decision.nextState.options).toEqual(result.batch.candidates);
  });

  it.each([
    ["emergency pause", { emergencyPaused: true }],
    ["session end", { sessionEnded: true }],
    ["impossible opportunity", { questImpossible: true }],
  ])("publishes nothing after %s", (_name, authorityPatch) => {
    expect(new DefaultDirectorCueConverter().convert(input(authorityPatch))).toMatchObject({
      ok: false,
      disposition: "no-publication",
      code: "invalid-context",
    });
  });

  it("publishes nothing when audience support expires before conversion", () => {
    expect(
      new DefaultDirectorCueConverter().convert(
        input({ now: convertedLiveDirector.audiencePointer!.status === "known"
          ? convertedLiveDirector.audiencePointer!.expiresAt
          : ROLE_3_FIXTURE_TIME + 1_000 }),
      ),
    ).toMatchObject({
      ok: false,
      disposition: "no-publication",
      code: "cue-not-converted",
    });
  });

  it.each([0, 1, 2, 3])(
    "returns exactly three options from %i valid supplied candidates",
    (validCount) => {
      const candidates = [
        ...role3FixtureCandidateBatch.candidates.slice(0, validCount),
        ...Array.from({ length: 3 - validCount }, (_, index) =>
          unsafeCandidate(index),
        ),
      ];
      const result = new DefaultDirectorCueConverter().convert(input({ candidates }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.batch.candidates).toHaveLength(3);
      expect(
        result.batch.candidates.filter(
          ({ generation }) => generation.method === "deterministic-fallback",
        ),
      ).toHaveLength(3 - validCount);
    },
  );

  it("never exposes more than three options from oversized untrusted input", () => {
    const extraCandidate = {
      ...role3FixtureCandidateBatch.candidates[0],
      candidateId: "cue-conversion-extra",
      title: "Explain One Choice",
      instruction: "Explain one choice before taking the next major game action.",
    };
    const result = new DefaultDirectorCueConverter().convert(
      input({ candidates: [...role3FixtureCandidateBatch.candidates, extraCandidate] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.candidates).toHaveLength(3);
    expect(result.decision.nextState.options).toHaveLength(3);
  });

  it.each([
    ["provider unavailable", null],
    ["provider refused or returned malformed output", [{ candidateId: "malformed" }]],
  ] as const)("uses deterministic replacement when %s", (_case, candidates) => {
    const result = new DefaultDirectorCueConverter().convert(input({ candidates }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.candidates).toHaveLength(3);
    expect(
      result.batch.candidates.every(
        ({ generation }) => generation.method === "deterministic-fallback",
      ),
    ).toBe(true);
  });

  it("does not let AI-provider provenance bypass unsafe validation", () => {
    const result = new DefaultDirectorCueConverter().convert(
      input({ candidates: [unsafeCandidate(0, "ai-provider")] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.audit).toContainEqual(
      expect.objectContaining({
        candidateId: "cue-conversion-unsafe-0",
        source: "provided",
        accepted: false,
        issues: expect.arrayContaining([expect.objectContaining({ code: "unsafe" })]),
      }),
    );
    expect(result.batch.candidates).toHaveLength(3);
  });

  it("replaces unsupported and recently repeated candidates through the same validator", () => {
    const unsupported = {
      ...role3FixtureCandidateBatch.candidates[0],
      candidateId: "cue-conversion-unsupported",
      sourceSignalIds: ["missing-live-signal"],
    };
    const repeated = {
      ...role3FixtureCandidateBatch.candidates[1],
      candidateId: "cue-conversion-repeated",
    };
    const result = new DefaultDirectorCueConverter().convert(
      input({
        candidates: [unsupported, repeated],
        recentQuests: [{ title: repeated.title, occurredAt: ROLE_3_FIXTURE_TIME }],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.candidates).toHaveLength(3);
    expect(result.audit.flatMap(({ issues }) => issues.map(({ code }) => code))).toEqual(
      expect.arrayContaining(["unsupported-evidence", "recently-repeated"]),
    );
  });

  it("replaces candidates that conflict with saved streamer restrictions", () => {
    const result = new DefaultDirectorCueConverter().convert(
      input({
        candidates: [role3FixtureCandidateBatch.candidates[1]],
        profile: streamerProfileSchema.parse({
          ...profile,
          restrictions: ["sports commentator"],
        }),
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batch.candidates).toHaveLength(3);
    expect(result.audit.flatMap(({ issues }) => issues.map(({ code }) => code))).toContain(
      "streamer-restricted",
    );
  });

  it("returns typed no-publication when safe fallback is exhausted", () => {
    const fallbackTitles = [
      "Plan Out Loud",
      "Caster Mode",
      "Calm Focus",
      "Three-Step Preview",
      "Audience Coach",
      "Dramatic Recap",
      "Decision Spotlight",
      "One-Minute Mentor",
      "Positive Commentary",
    ];
    const result = new DefaultDirectorCueConverter().convert(
      input({
        candidates: null,
        recentQuests: fallbackTitles.map((title, index) => ({
          title,
          occurredAt: ROLE_3_FIXTURE_TIME - index * 1_000,
        })),
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      disposition: "no-publication",
      code: "fallback-exhausted",
    });
  });

  it("returns typed no-publication unless the canonical cue was converted", () => {
    expect(
      new DefaultDirectorCueConverter().convert(
        input({ liveDirector: contractFixtureLiveDirectorState }),
      ),
    ).toMatchObject({
      ok: false,
      disposition: "no-publication",
      code: "cue-not-converted",
    });
  });

  it("returns typed no-publication when the existing proposal boundary rejects context", () => {
    const result = new DefaultDirectorCueConverter().convert(
      input({ command: role3IntelligenceCommand({ expectedRevision: 1 }) }),
    );

    expect(result).toMatchObject({
      ok: false,
      disposition: "no-publication",
      code: "proposal-rejected",
      error: { code: "stale-revision" },
    });
  });

  it("replays identical conversion input deterministically", () => {
    const converter = new DefaultDirectorCueConverter();
    expect(converter.convert(input({ candidates: null }))).toEqual(
      converter.convert(input({ candidates: null })),
    );
  });
});
