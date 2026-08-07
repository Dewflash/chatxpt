import { z } from "zod";

export const PRIVATE_VIEWER_RECOVERY_DECISION_ID = "D-061";

export const privateViewerRecoveryVerificationSchema = z.enum([
  "private-receipt-route",
  "sanitised-shared-snapshot",
  "two-viewer-isolation",
  "duplicate-vote-idempotency",
  "session-points-read-model",
  "anonymous-token-reconnect",
  "expired-reconnect-denial",
]);

export const privateViewerRecoveryPolicyReportSchema = z
  .object({
    decisionId: z.literal(PRIVATE_VIEWER_RECOVERY_DECISION_ID),
    privateReceipt: z
      .object({
        sessionScoped: z.boolean(),
        viewerScoped: z.boolean(),
        supportsAuthenticatedViewer: z.boolean(),
        supportsAnonymousToken: z.boolean(),
        acceptedChoiceIncluded: z.boolean(),
        sourceModeIncluded: z.boolean(),
        sessionPointsIncluded: z.boolean(),
        reconnectExpiryBounded: z.boolean(),
      })
      .strict(),
    sharedState: z
      .object({
        sanitisedViewerSnapshot: z.boolean(),
        sharedTallyOnly: z.boolean(),
        viewerIdentifiersOmitted: z.boolean(),
        acceptedChoiceOmitted: z.boolean(),
        sessionPointsOmitted: z.boolean(),
        privateFieldsOmittedFromHistory: z.boolean(),
      })
      .strict(),
    reconnect: z
      .object({
        authorisedGrantRequired: z.boolean(),
        restoresAcceptedChoice: z.boolean(),
        restoresSessionPoints: z.boolean(),
        expiredGrantFailsClosed: z.boolean(),
      })
      .strict(),
    commands: z
      .object({
        duplicateVotePreservesFirstAcceptedChoice: z.boolean(),
        duplicateVoteDoesNotIncrementTallies: z.boolean(),
        staleOrLateVoteRejected: z.boolean(),
        currentRevisionReturned: z.boolean(),
      })
      .strict(),
    verification: z
      .object({
        checks: z.array(privateViewerRecoveryVerificationSchema).max(7),
        fullCheckPassed: z.boolean(),
      })
      .strict()
      .superRefine((verification, context) => {
        if (new Set(verification.checks).size !== verification.checks.length) {
          context.addIssue({
            code: "custom",
            message: "Private viewer recovery verification checks must be unique",
            path: ["checks"],
          });
        }
      }),
  })
  .strict();

export const privateViewerRecoveryPolicyResolutionSchema = z
  .object({
    ok: z.boolean(),
    decisionId: z.literal(PRIVATE_VIEWER_RECOVERY_DECISION_ID),
    requiredVerification: z.array(privateViewerRecoveryVerificationSchema).length(7),
    blockerCodes: z.array(z.string().trim().min(1).max(120)).max(32),
    limitations: z.array(z.string().trim().min(1).max(240)).max(8),
  })
  .strict();

export type PrivateViewerRecoveryVerification = z.infer<
  typeof privateViewerRecoveryVerificationSchema
>;
export type PrivateViewerRecoveryPolicyReport = z.infer<
  typeof privateViewerRecoveryPolicyReportSchema
>;
export type PrivateViewerRecoveryPolicyResolution = z.infer<
  typeof privateViewerRecoveryPolicyResolutionSchema
>;

const requiredVerification: readonly PrivateViewerRecoveryVerification[] = [
  "private-receipt-route",
  "sanitised-shared-snapshot",
  "two-viewer-isolation",
  "duplicate-vote-idempotency",
  "session-points-read-model",
  "anonymous-token-reconnect",
  "expired-reconnect-denial",
] as const;

export function resolvePrivateViewerRecoveryPolicy(
  input:
    | PrivateViewerRecoveryPolicyReport
    | z.input<typeof privateViewerRecoveryPolicyReportSchema>,
): PrivateViewerRecoveryPolicyResolution {
  const report = privateViewerRecoveryPolicyReportSchema.parse(input);
  const blockers = new Set<string>();

  const privateReceiptChecks = [
    ["sessionScoped", "private-receipt-not-session-scoped"],
    ["viewerScoped", "private-receipt-not-viewer-scoped"],
    ["supportsAuthenticatedViewer", "private-receipt-missing-authenticated-viewer"],
    ["supportsAnonymousToken", "private-receipt-missing-anonymous-token"],
    ["acceptedChoiceIncluded", "private-receipt-missing-accepted-choice"],
    ["sourceModeIncluded", "private-receipt-missing-source-mode"],
    ["sessionPointsIncluded", "private-receipt-missing-session-points"],
    ["reconnectExpiryBounded", "private-receipt-missing-bounded-expiry"],
  ] as const;
  for (const [field, blocker] of privateReceiptChecks) {
    if (!report.privateReceipt[field]) blockers.add(blocker);
  }

  const sharedStateChecks = [
    ["sanitisedViewerSnapshot", "shared-state-not-sanitised"],
    ["sharedTallyOnly", "shared-state-not-tally-only"],
    ["viewerIdentifiersOmitted", "shared-state-leaks-viewer-identifiers"],
    ["acceptedChoiceOmitted", "shared-state-leaks-accepted-choice"],
    ["sessionPointsOmitted", "shared-state-leaks-session-points"],
    ["privateFieldsOmittedFromHistory", "history-leaks-private-viewer-fields"],
  ] as const;
  for (const [field, blocker] of sharedStateChecks) {
    if (!report.sharedState[field]) blockers.add(blocker);
  }

  const reconnectChecks = [
    ["authorisedGrantRequired", "reconnect-missing-authorised-grant"],
    ["restoresAcceptedChoice", "reconnect-missing-accepted-choice"],
    ["restoresSessionPoints", "reconnect-missing-session-points"],
    ["expiredGrantFailsClosed", "reconnect-expired-grant-not-denied"],
  ] as const;
  for (const [field, blocker] of reconnectChecks) {
    if (!report.reconnect[field]) blockers.add(blocker);
  }

  const commandChecks = [
    ["duplicateVotePreservesFirstAcceptedChoice", "duplicate-vote-does-not-preserve-choice"],
    ["duplicateVoteDoesNotIncrementTallies", "duplicate-vote-increments-tally"],
    ["staleOrLateVoteRejected", "stale-or-late-vote-not-rejected"],
    ["currentRevisionReturned", "viewer-command-missing-current-revision"],
  ] as const;
  for (const [field, blocker] of commandChecks) {
    if (!report.commands[field]) blockers.add(blocker);
  }

  if (!report.verification.fullCheckPassed) {
    blockers.add("private-viewer-recovery-full-check-not-passed");
  }
  for (const check of requiredVerification) {
    if (!report.verification.checks.includes(check)) {
      blockers.add(`private-viewer-recovery-missing-verification-${check}`);
    }
  }

  return privateViewerRecoveryPolicyResolutionSchema.parse({
    ok: blockers.size === 0,
    decisionId: PRIVATE_VIEWER_RECOVERY_DECISION_ID,
    requiredVerification,
    blockerCodes: [...blockers],
    limitations: [
      "This policy accepts the private viewer recovery contract and fixture/integration evidence; it is not live Twitch Extension, hosted-board, or Supabase cloud evidence.",
      "Shared viewer snapshots and session history remain aggregate/sanitised; personal accepted choice and points are available only through the authorised private receipt path.",
      "Final Role 5 UI modules still need to consume the accepted private receipt and reconnect states through Role 1's browser-safe gateway.",
    ],
  });
}
