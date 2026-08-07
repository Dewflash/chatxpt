import { describe, expect, it } from "vitest";

import {
  FALLBACK_DELIVERY_DECISION_ID,
  resolveFallbackDeliveryPolicy,
  type FallbackDeliveryPolicyReport,
} from "../../src/integrations";

const validReport: FallbackDeliveryPolicyReport = {
  decisionId: FALLBACK_DELIVERY_DECISION_ID,
  hostedBoard: {
    roomCodeLookup: true,
    directAuthorisedLink: true,
    copyShareUrl: true,
    optionalQrPayload: true,
    qrNotRequired: true,
    accountCreationNotRequired: true,
    grantExpires: true,
    invalidRoomFailsClosed: true,
    inactiveSessionFailsClosed: true,
  },
  chatFallback: {
    platformNeutralTemplates: true,
    pollOpenNamesExactlyThreeOptions: true,
    finalResultTemplate: true,
    role1OwnsParsingAndDelivery: true,
    role5PresentationOnly: true,
    outboundRateLimited: true,
    unavailableIsExplicit: true,
  },
  acknowledgement: {
    ignoredChatHasNoAcknowledgement: true,
    countedRequiresDeliveredMessage: true,
    duplicatePreservesOriginalCandidate: true,
    rejectedAndLateDoNotNameCandidate: true,
    failedDeliveryReturnsNotDelivered: true,
    unavailableDeliveryReturnsUnavailable: true,
  },
  verification: {
    checks: [
      "hosted-board-route",
      "hosted-board-invalid-room",
      "hosted-board-grant",
      "chat-poll-template",
      "chat-result-template",
      "chat-rate-limit",
      "chat-ack-no-overclaim",
      "ignored-chat-no-ack",
    ],
    fullCheckPassed: true,
  },
};

describe("fallback delivery policy", () => {
  it("accepts the D1-06E hosted-board and Twitch-chat fallback policy", () => {
    const result = resolveFallbackDeliveryPolicy(validReport);

    expect(result).toMatchObject({
      ok: true,
      decisionId: FALLBACK_DELIVERY_DECISION_ID,
      requiredVerification: [
        "hosted-board-route",
        "hosted-board-invalid-room",
        "hosted-board-grant",
        "chat-poll-template",
        "chat-result-template",
        "chat-rate-limit",
        "chat-ack-no-overclaim",
        "ignored-chat-no-ack",
      ],
      blockerCodes: [],
    });
    expect(result.limitations.join(" ")).toContain("not live Twitch outbound delivery");
  });

  it("rejects hosted-board discovery that requires QR/account setup or omits fail-closed grants", () => {
    const result = resolveFallbackDeliveryPolicy({
      ...validReport,
      hostedBoard: {
        ...validReport.hostedBoard,
        directAuthorisedLink: false,
        copyShareUrl: false,
        qrNotRequired: false,
        accountCreationNotRequired: false,
        grantExpires: false,
        invalidRoomFailsClosed: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "hosted-board-missing-direct-authorised-link",
      "hosted-board-missing-share-url",
      "hosted-board-qr-required",
      "hosted-board-account-required",
      "hosted-board-grant-does-not-expire",
      "hosted-board-invalid-room-not-closed",
    ]));
  });

  it("rejects chat fallback implementations that move authority into UI or overpromise availability", () => {
    const result = resolveFallbackDeliveryPolicy({
      ...validReport,
      chatFallback: {
        ...validReport.chatFallback,
        pollOpenNamesExactlyThreeOptions: false,
        role1OwnsParsingAndDelivery: false,
        role5PresentationOnly: false,
        outboundRateLimited: false,
        unavailableIsExplicit: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "chat-fallback-poll-not-three-options",
      "chat-fallback-role1-not-delivery-owner",
      "chat-fallback-role5-has-authority",
      "chat-fallback-missing-rate-limit",
      "chat-fallback-unavailable-not-explicit",
    ]));
  });

  it("rejects acknowledgement policies that claim vote status without delivered chat output", () => {
    const result = resolveFallbackDeliveryPolicy({
      ...validReport,
      acknowledgement: {
        ...validReport.acknowledgement,
        ignoredChatHasNoAcknowledgement: false,
        countedRequiresDeliveredMessage: false,
        duplicatePreservesOriginalCandidate: false,
        rejectedAndLateDoNotNameCandidate: false,
        failedDeliveryReturnsNotDelivered: false,
        unavailableDeliveryReturnsUnavailable: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "chat-ack-ignored-chat-acknowledged",
      "chat-ack-counted-without-delivery",
      "chat-ack-duplicate-loses-original-candidate",
      "chat-ack-rejected-or-late-names-candidate",
      "chat-ack-failed-delivery-overclaimed",
      "chat-ack-unavailable-not-explicit",
    ]));
  });

  it("requires every verification class and rejects duplicate verification labels", () => {
    const missing = resolveFallbackDeliveryPolicy({
      ...validReport,
      verification: {
        checks: ["hosted-board-route", "chat-poll-template"],
        fullCheckPassed: false,
      },
    });

    expect(missing.ok).toBe(false);
    expect(missing.blockerCodes).toEqual(expect.arrayContaining([
      "fallback-delivery-full-check-not-passed",
      "fallback-delivery-missing-verification-hosted-board-invalid-room",
      "fallback-delivery-missing-verification-hosted-board-grant",
      "fallback-delivery-missing-verification-chat-result-template",
      "fallback-delivery-missing-verification-chat-rate-limit",
      "fallback-delivery-missing-verification-chat-ack-no-overclaim",
      "fallback-delivery-missing-verification-ignored-chat-no-ack",
    ]));

    expect(() =>
      resolveFallbackDeliveryPolicy({
        ...validReport,
        verification: {
          ...validReport.verification,
          checks: ["hosted-board-route", "hosted-board-route"],
        },
      }),
    ).toThrow("Fallback delivery verification checks must be unique");
  });
});
