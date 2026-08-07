import { z } from "zod";

export const FALLBACK_DELIVERY_DECISION_ID = "D-062";

export const fallbackDeliveryVerificationSchema = z.enum([
  "hosted-board-route",
  "hosted-board-invalid-room",
  "hosted-board-grant",
  "chat-poll-template",
  "chat-result-template",
  "chat-rate-limit",
  "chat-ack-no-overclaim",
  "ignored-chat-no-ack",
]);

export const fallbackDeliveryPolicyReportSchema = z
  .object({
    decisionId: z.literal(FALLBACK_DELIVERY_DECISION_ID),
    hostedBoard: z
      .object({
        roomCodeLookup: z.boolean(),
        directAuthorisedLink: z.boolean(),
        copyShareUrl: z.boolean(),
        optionalQrPayload: z.boolean(),
        qrNotRequired: z.boolean(),
        accountCreationNotRequired: z.boolean(),
        grantExpires: z.boolean(),
        invalidRoomFailsClosed: z.boolean(),
        inactiveSessionFailsClosed: z.boolean(),
      })
      .strict(),
    chatFallback: z
      .object({
        platformNeutralTemplates: z.boolean(),
        pollOpenNamesExactlyThreeOptions: z.boolean(),
        finalResultTemplate: z.boolean(),
        role1OwnsParsingAndDelivery: z.boolean(),
        role5PresentationOnly: z.boolean(),
        outboundRateLimited: z.boolean(),
        unavailableIsExplicit: z.boolean(),
      })
      .strict(),
    acknowledgement: z
      .object({
        ignoredChatHasNoAcknowledgement: z.boolean(),
        countedRequiresDeliveredMessage: z.boolean(),
        duplicatePreservesOriginalCandidate: z.boolean(),
        rejectedAndLateDoNotNameCandidate: z.boolean(),
        failedDeliveryReturnsNotDelivered: z.boolean(),
        unavailableDeliveryReturnsUnavailable: z.boolean(),
      })
      .strict(),
    verification: z
      .object({
        checks: z.array(fallbackDeliveryVerificationSchema).max(8),
        fullCheckPassed: z.boolean(),
      })
      .strict()
      .superRefine((verification, context) => {
        if (new Set(verification.checks).size !== verification.checks.length) {
          context.addIssue({
            code: "custom",
            message: "Fallback delivery verification checks must be unique",
            path: ["checks"],
          });
        }
      }),
  })
  .strict();

export const fallbackDeliveryPolicyResolutionSchema = z
  .object({
    ok: z.boolean(),
    decisionId: z.literal(FALLBACK_DELIVERY_DECISION_ID),
    requiredVerification: z.array(fallbackDeliveryVerificationSchema).length(8),
    blockerCodes: z.array(z.string().trim().min(1).max(120)).max(32),
    limitations: z.array(z.string().trim().min(1).max(240)).max(8),
  })
  .strict();

export type FallbackDeliveryVerification = z.infer<typeof fallbackDeliveryVerificationSchema>;
export type FallbackDeliveryPolicyReport = z.infer<typeof fallbackDeliveryPolicyReportSchema>;
export type FallbackDeliveryPolicyResolution = z.infer<
  typeof fallbackDeliveryPolicyResolutionSchema
>;

const requiredVerification: readonly FallbackDeliveryVerification[] = [
  "hosted-board-route",
  "hosted-board-invalid-room",
  "hosted-board-grant",
  "chat-poll-template",
  "chat-result-template",
  "chat-rate-limit",
  "chat-ack-no-overclaim",
  "ignored-chat-no-ack",
] as const;

export function resolveFallbackDeliveryPolicy(
  input: FallbackDeliveryPolicyReport | z.input<typeof fallbackDeliveryPolicyReportSchema>,
): FallbackDeliveryPolicyResolution {
  const report = fallbackDeliveryPolicyReportSchema.parse(input);
  const blockers = new Set<string>();

  const hostedChecks = [
    ["roomCodeLookup", "hosted-board-missing-room-code-lookup"],
    ["directAuthorisedLink", "hosted-board-missing-direct-authorised-link"],
    ["copyShareUrl", "hosted-board-missing-share-url"],
    ["optionalQrPayload", "hosted-board-missing-optional-qr"],
    ["qrNotRequired", "hosted-board-qr-required"],
    ["accountCreationNotRequired", "hosted-board-account-required"],
    ["grantExpires", "hosted-board-grant-does-not-expire"],
    ["invalidRoomFailsClosed", "hosted-board-invalid-room-not-closed"],
    ["inactiveSessionFailsClosed", "hosted-board-inactive-session-not-closed"],
  ] as const;
  for (const [field, blocker] of hostedChecks) {
    if (!report.hostedBoard[field]) blockers.add(blocker);
  }

  const chatChecks = [
    ["platformNeutralTemplates", "chat-fallback-missing-platform-neutral-templates"],
    ["pollOpenNamesExactlyThreeOptions", "chat-fallback-poll-not-three-options"],
    ["finalResultTemplate", "chat-fallback-missing-result-template"],
    ["role1OwnsParsingAndDelivery", "chat-fallback-role1-not-delivery-owner"],
    ["role5PresentationOnly", "chat-fallback-role5-has-authority"],
    ["outboundRateLimited", "chat-fallback-missing-rate-limit"],
    ["unavailableIsExplicit", "chat-fallback-unavailable-not-explicit"],
  ] as const;
  for (const [field, blocker] of chatChecks) {
    if (!report.chatFallback[field]) blockers.add(blocker);
  }

  const acknowledgementChecks = [
    ["ignoredChatHasNoAcknowledgement", "chat-ack-ignored-chat-acknowledged"],
    ["countedRequiresDeliveredMessage", "chat-ack-counted-without-delivery"],
    ["duplicatePreservesOriginalCandidate", "chat-ack-duplicate-loses-original-candidate"],
    ["rejectedAndLateDoNotNameCandidate", "chat-ack-rejected-or-late-names-candidate"],
    ["failedDeliveryReturnsNotDelivered", "chat-ack-failed-delivery-overclaimed"],
    ["unavailableDeliveryReturnsUnavailable", "chat-ack-unavailable-not-explicit"],
  ] as const;
  for (const [field, blocker] of acknowledgementChecks) {
    if (!report.acknowledgement[field]) blockers.add(blocker);
  }

  if (!report.verification.fullCheckPassed) {
    blockers.add("fallback-delivery-full-check-not-passed");
  }
  for (const check of requiredVerification) {
    if (!report.verification.checks.includes(check)) {
      blockers.add(`fallback-delivery-missing-verification-${check}`);
    }
  }

  return fallbackDeliveryPolicyResolutionSchema.parse({
    ok: blockers.size === 0,
    decisionId: FALLBACK_DELIVERY_DECISION_ID,
    requiredVerification,
    blockerCodes: [...blockers],
    limitations: [
      "This policy accepts hosted-board and Twitch-chat fallback contracts using fixture/local integration evidence; it is not live Twitch outbound delivery evidence.",
      "QR payloads are optional convenience data only; viewers must still be able to use direct hosted-board links and chat fallback without scanning or account creation.",
      "Twitch-chat acknowledgement status may be shown only when the outbound Twitch path actually delivered the acknowledgement message.",
    ],
  });
}
