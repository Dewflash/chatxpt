import { z } from "zod";

export const MINIMUM_REAL_WORKFLOW_EVIDENCE_DECISION_ID = "D-059";

export const realWorkflowParticipationModeSchema = z.enum([
  "twitch-extension",
  "hosted-board",
  "twitch-chat",
]);

export const realWorkflowSurfaceSchema = z.enum([
  "orchestrator",
  "persistence",
  "studio",
  "live-config",
  "twitch-extension",
  "hosted-board",
  "twitch-chat",
  "obs-overlay",
]);

export const realWorkflowTerminalOutcomeSchema = z.enum([
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
  "expired",
]);

export const realWorkflowEvidenceClassSchema = z.enum([
  "real",
  "memory-backed",
  "fixture-only",
  "inspection-only",
  "unverified",
]);

export const minimumRealWorkflowEvidenceReportSchema = z
  .object({
    decisionId: z.literal(MINIMUM_REAL_WORKFLOW_EVIDENCE_DECISION_ID),
    evidenceClass: realWorkflowEvidenceClassSchema,
    realInputs: z
      .object({
        ownedOrAuthorizedGameplay: z.boolean(),
        obsVirtualCameraFrame: z.boolean(),
        twitchActivity: z.boolean(),
        noSimulatedInputsPresentedAsLive: z.boolean(),
        rawFramesEphemeral: z.boolean(),
        rawChatRetentionCompliant: z.boolean(),
      })
      .strict(),
    extraction: z
      .object({
        universalVisualSignalsObserved: z.boolean(),
        calibratedDemoFactKnown: z.boolean(),
        unknownsLabelled: z.boolean(),
        provenanceHasConfidenceAndTimestamps: z.boolean(),
      })
      .strict(),
    quest: z
      .object({
        exactlyThreeRole2Candidates: z.boolean(),
        exactlyThreeRole3ValidatedOptions: z.boolean(),
        unsafeImpossibleRejectedOrAbsent: z.boolean(),
        streamerControlObserved: z.boolean(),
        terminalOutcome: realWorkflowTerminalOutcomeSchema.nullable(),
      })
      .strict(),
    participation: z
      .object({
        mode: realWorkflowParticipationModeSchema,
        extensionUnavailableLabelled: z.boolean(),
        twoDistinctViewers: z.boolean(),
        acceptedVotesCount: z.number().int().nonnegative(),
        duplicateOrReconnectCaseObserved: z.boolean(),
      })
      .strict(),
    stateConsistency: z
      .object({
        sameSessionId: z.boolean(),
        sameQuestCycleId: z.boolean(),
        sameRevisionObserved: z.boolean(),
        observedSurfaces: z.array(realWorkflowSurfaceSchema).max(8),
        obsOverlayDisplayedWinnerOrActiveQuest: z.boolean(),
        resultAndRewardDisplayed: z.boolean(),
      })
      .strict()
      .superRefine((state, context) => {
        if (new Set(state.observedSurfaces).size !== state.observedSurfaces.length) {
          context.addIssue({
            code: "custom",
            message: "Observed real workflow surfaces must be unique",
            path: ["observedSurfaces"],
          });
        }
      }),
    artifacts: z
      .array(z.object({
        reference: z.string().trim().min(1).max(160),
        privacyReviewed: z.boolean(),
      }).strict())
      .min(1)
      .max(8),
  })
  .strict();

export const minimumRealWorkflowEvidenceResolutionSchema = z
  .object({
    ok: z.boolean(),
    decisionId: z.literal(MINIMUM_REAL_WORKFLOW_EVIDENCE_DECISION_ID),
    acceptedParticipationMode: realWorkflowParticipationModeSchema.nullable(),
    requiredSurfaces: z.array(realWorkflowSurfaceSchema).min(5).max(6),
    blockerCodes: z.array(z.string().trim().min(1).max(120)).max(32),
    limitations: z.array(z.string().trim().min(1).max(260)).max(8),
  })
  .strict();

export type RealWorkflowParticipationMode = z.infer<typeof realWorkflowParticipationModeSchema>;
export type RealWorkflowSurface = z.infer<typeof realWorkflowSurfaceSchema>;
export type RealWorkflowTerminalOutcome = z.infer<typeof realWorkflowTerminalOutcomeSchema>;
export type RealWorkflowEvidenceClass = z.infer<typeof realWorkflowEvidenceClassSchema>;
export type MinimumRealWorkflowEvidenceReport = z.infer<typeof minimumRealWorkflowEvidenceReportSchema>;
export type MinimumRealWorkflowEvidenceResolution = z.infer<typeof minimumRealWorkflowEvidenceResolutionSchema>;

function requiredSurfacesFor(mode: RealWorkflowParticipationMode): RealWorkflowSurface[] {
  return ["orchestrator", "persistence", "studio", mode, "obs-overlay"];
}

export function resolveMinimumRealWorkflowEvidence(
  input: MinimumRealWorkflowEvidenceReport | z.input<typeof minimumRealWorkflowEvidenceReportSchema>,
): MinimumRealWorkflowEvidenceResolution {
  const report = minimumRealWorkflowEvidenceReportSchema.parse(input);
  const blockers = new Set<string>();

  if (report.evidenceClass !== "real") blockers.add("minimum-real-workflow-evidence-not-real");

  const realInputChecks = [
    ["ownedOrAuthorizedGameplay", "minimum-real-workflow-gameplay-not-owned"],
    ["obsVirtualCameraFrame", "minimum-real-workflow-missing-obs-frame"],
    ["twitchActivity", "minimum-real-workflow-missing-twitch-activity"],
    ["noSimulatedInputsPresentedAsLive", "minimum-real-workflow-simulated-input-claim"],
    ["rawFramesEphemeral", "minimum-real-workflow-raw-frames-not-ephemeral"],
    ["rawChatRetentionCompliant", "minimum-real-workflow-raw-chat-retention"],
  ] as const;
  for (const [field, blocker] of realInputChecks) {
    if (!report.realInputs[field]) blockers.add(blocker);
  }

  const extractionChecks = [
    ["universalVisualSignalsObserved", "minimum-real-workflow-missing-universal-visual-signals"],
    ["calibratedDemoFactKnown", "minimum-real-workflow-missing-calibrated-demo-fact"],
    ["unknownsLabelled", "minimum-real-workflow-unknowns-not-labelled"],
    ["provenanceHasConfidenceAndTimestamps", "minimum-real-workflow-missing-provenance"],
  ] as const;
  for (const [field, blocker] of extractionChecks) {
    if (!report.extraction[field]) blockers.add(blocker);
  }

  const questChecks = [
    ["exactlyThreeRole2Candidates", "minimum-real-workflow-not-three-role2-candidates"],
    ["exactlyThreeRole3ValidatedOptions", "minimum-real-workflow-not-three-validated-options"],
    ["unsafeImpossibleRejectedOrAbsent", "minimum-real-workflow-unsafe-impossible-not-controlled"],
    ["streamerControlObserved", "minimum-real-workflow-missing-streamer-control"],
  ] as const;
  for (const [field, blocker] of questChecks) {
    if (!report.quest[field]) blockers.add(blocker);
  }
  if (report.quest.terminalOutcome === null) {
    blockers.add("minimum-real-workflow-missing-terminal-outcome");
  }

  if (!report.participation.twoDistinctViewers) blockers.add("minimum-real-workflow-missing-two-viewers");
  if (report.participation.acceptedVotesCount < 2) blockers.add("minimum-real-workflow-not-enough-accepted-votes");
  if (!report.participation.duplicateOrReconnectCaseObserved) {
    blockers.add("minimum-real-workflow-missing-duplicate-or-reconnect");
  }
  if (report.participation.mode !== "twitch-extension" && !report.participation.extensionUnavailableLabelled) {
    blockers.add("minimum-real-workflow-fallback-not-labelled");
  }

  const stateChecks = [
    ["sameSessionId", "minimum-real-workflow-session-mismatch"],
    ["sameQuestCycleId", "minimum-real-workflow-cycle-mismatch"],
    ["sameRevisionObserved", "minimum-real-workflow-revision-mismatch"],
    ["obsOverlayDisplayedWinnerOrActiveQuest", "minimum-real-workflow-missing-obs-overlay"],
    ["resultAndRewardDisplayed", "minimum-real-workflow-missing-result-reward"],
  ] as const;
  for (const [field, blocker] of stateChecks) {
    if (!report.stateConsistency[field]) blockers.add(blocker);
  }

  const requiredSurfaces = requiredSurfacesFor(report.participation.mode);
  for (const surface of requiredSurfaces) {
    if (!report.stateConsistency.observedSurfaces.includes(surface)) {
      blockers.add(`minimum-real-workflow-missing-surface-${surface}`);
    }
  }

  if (report.artifacts.some((artifact) => !artifact.privacyReviewed)) {
    blockers.add("minimum-real-workflow-artifact-not-privacy-reviewed");
  }

  return minimumRealWorkflowEvidenceResolutionSchema.parse({
    ok: blockers.size === 0,
    decisionId: MINIMUM_REAL_WORKFLOW_EVIDENCE_DECISION_ID,
    acceptedParticipationMode: blockers.size === 0 ? report.participation.mode : null,
    requiredSurfaces,
    blockerCodes: [...blockers],
    limitations: [
      "This gate validates a real-evidence report; it does not create real evidence by itself.",
      "Twitch Extension remains preferred, but hosted-board or Twitch-chat can satisfy the minimum only when Extension unavailability is labelled truthfully.",
      "The broader failure matrix still requires additional runs beyond this minimum gate.",
    ],
  });
}
