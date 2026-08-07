import { z } from "zod";

export const CONTROLLED_GAMEPLAY_TEST_DECISION_ID = "D-058";

export const controlledGameplayScenarioSchema = z.enum([
  "brawl-stars-intended",
  "team-owned-pc-action-fallback",
]);

export const controlledGameplayOwnershipSchema = z.enum([
  "team-owned",
  "explicitly-authorized",
  "third-party-unapproved",
]);

export const controlledGameplayRunModeSchema = z.enum([
  "local-obs-virtual-camera",
  "team-controlled-twitch-stream",
]);

export const controlledGameplayEvidenceResourceSchema = z.enum([
  "obs-gameplay-machine",
  "twitch-broadcaster",
  "streamer-desktop-browser",
  "demo-recording",
]);

export const controlledGameplayRunReportSchema = z
  .object({
    mode: controlledGameplayRunModeSchema,
    scenario: controlledGameplayScenarioSchema,
    ownership: controlledGameplayOwnershipSchema,
    teamControlledTwitchChannel: z.boolean(),
    obsVirtualCameraUsed: z.boolean(),
    rawGameSceneUsed: z.boolean(),
    chatxptOverlayExcluded: z.boolean(),
    annotationsRecordedSeparately: z.boolean(),
    annotationsFedToExtractor: z.boolean(),
    rawVideoPersisted: z.boolean(),
    evidenceResourceIds: z.array(controlledGameplayEvidenceResourceSchema).max(4),
  })
  .strict()
  .superRefine((run, context) => {
    if (new Set(run.evidenceResourceIds).size !== run.evidenceResourceIds.length) {
      context.addIssue({
        code: "custom",
        message: "Controlled gameplay evidence resources must be unique",
        path: ["evidenceResourceIds"],
      });
    }
  });

export const controlledGameplayTestPlanSchema = z
  .object({
    decisionId: z.literal(CONTROLLED_GAMEPLAY_TEST_DECISION_ID),
    runs: z.array(controlledGameplayRunReportSchema).min(1).max(2),
  })
  .strict();

export const controlledGameplayTestResolutionSchema = z
  .object({
    ok: z.boolean(),
    decisionId: z.literal(CONTROLLED_GAMEPLAY_TEST_DECISION_ID),
    selectedScenario: controlledGameplayScenarioSchema.nullable(),
    requiredRuns: z.array(controlledGameplayRunModeSchema).length(2),
    acceptedRuns: z.array(controlledGameplayRunModeSchema).max(2),
    requiredEvidenceResources: z.array(controlledGameplayEvidenceResourceSchema).min(3).max(4),
    blockerCodes: z.array(z.string().trim().min(1).max(120)).max(16),
    limitations: z.array(z.string().trim().min(1).max(240)).max(8),
  })
  .strict();

export type ControlledGameplayScenario = z.infer<typeof controlledGameplayScenarioSchema>;
export type ControlledGameplayOwnership = z.infer<typeof controlledGameplayOwnershipSchema>;
export type ControlledGameplayRunMode = z.infer<typeof controlledGameplayRunModeSchema>;
export type ControlledGameplayEvidenceResource = z.infer<typeof controlledGameplayEvidenceResourceSchema>;
export type ControlledGameplayRunReport = z.infer<typeof controlledGameplayRunReportSchema>;
export type ControlledGameplayTestPlan = z.infer<typeof controlledGameplayTestPlanSchema>;
export type ControlledGameplayTestResolution = z.infer<typeof controlledGameplayTestResolutionSchema>;

const requiredRuns: readonly ControlledGameplayRunMode[] = [
  "local-obs-virtual-camera",
  "team-controlled-twitch-stream",
] as const;

const requiredEvidenceResources: readonly ControlledGameplayEvidenceResource[] = [
  "obs-gameplay-machine",
  "twitch-broadcaster",
  "streamer-desktop-browser",
  "demo-recording",
] as const;

function blockerForRun(run: ControlledGameplayRunReport): string[] {
  const blockers: string[] = [];

  if (run.ownership === "third-party-unapproved") {
    blockers.push("controlled-gameplay-unapproved-third-party");
  }
  if (!run.obsVirtualCameraUsed) {
    blockers.push("controlled-gameplay-obs-virtual-camera-required");
  }
  if (!run.rawGameSceneUsed) {
    blockers.push("controlled-gameplay-raw-game-scene-required");
  }
  if (!run.chatxptOverlayExcluded) {
    blockers.push("controlled-gameplay-overlay-recursion-risk");
  }
  if (!run.annotationsRecordedSeparately) {
    blockers.push("controlled-gameplay-annotations-missing");
  }
  if (run.annotationsFedToExtractor) {
    blockers.push("controlled-gameplay-answer-leakage");
  }
  if (run.rawVideoPersisted) {
    blockers.push("controlled-gameplay-raw-video-persisted");
  }
  if (run.mode === "local-obs-virtual-camera" && run.teamControlledTwitchChannel) {
    blockers.push("controlled-gameplay-local-run-claimed-twitch");
  }
  if (run.mode === "team-controlled-twitch-stream" && !run.teamControlledTwitchChannel) {
    blockers.push("controlled-gameplay-twitch-channel-not-controlled");
  }

  const requiredForMode: readonly ControlledGameplayEvidenceResource[] =
    run.mode === "team-controlled-twitch-stream"
      ? ["obs-gameplay-machine", "twitch-broadcaster", "streamer-desktop-browser", "demo-recording"]
      : ["obs-gameplay-machine", "streamer-desktop-browser", "demo-recording"];
  for (const resource of requiredForMode) {
    if (!run.evidenceResourceIds.includes(resource)) {
      blockers.push(`controlled-gameplay-missing-${resource}`);
    }
  }

  return [...new Set(blockers)];
}

export function resolveControlledGameplayTestPlan(
  input: ControlledGameplayTestPlan | z.input<typeof controlledGameplayTestPlanSchema>,
): ControlledGameplayTestResolution {
  const plan = controlledGameplayTestPlanSchema.parse(input);
  const blockerCodes = new Set<string>();
  const acceptedRuns: ControlledGameplayRunMode[] = [];
  const scenarioSet = new Set<ControlledGameplayScenario>();

  for (const run of plan.runs) {
    scenarioSet.add(run.scenario);
    const blockers = blockerForRun(run);
    for (const blocker of blockers) blockerCodes.add(blocker);
    if (blockers.length === 0 && !acceptedRuns.includes(run.mode)) {
      acceptedRuns.push(run.mode);
    }
  }

  for (const required of requiredRuns) {
    if (!plan.runs.some((run) => run.mode === required)) {
      blockerCodes.add(`controlled-gameplay-missing-${required}`);
    }
  }

  if (scenarioSet.size > 1) {
    blockerCodes.add("controlled-gameplay-scenario-mismatch");
  }

  const selectedScenario = scenarioSet.size === 1 ? [...scenarioSet][0] ?? null : null;
  const hasEveryRun = requiredRuns.every((required) => acceptedRuns.includes(required));
  const ok = blockerCodes.size === 0 && hasEveryRun && selectedScenario !== null;

  return controlledGameplayTestResolutionSchema.parse({
    ok,
    decisionId: CONTROLLED_GAMEPLAY_TEST_DECISION_ID,
    selectedScenario,
    requiredRuns,
    acceptedRuns,
    requiredEvidenceResources,
    blockerCodes: [...blockerCodes],
    limitations: [
      "This procedure validates whether a planned or reported run can be cited; it does not create real Twitch or OBS evidence by itself.",
      "Recorded expected events are annotations for evaluation only and must not be fed to the extractor.",
      "Raw video and raw frames remain ephemeral unless a separate privacy-reviewed evidence artifact is explicitly approved.",
    ],
  });
}
