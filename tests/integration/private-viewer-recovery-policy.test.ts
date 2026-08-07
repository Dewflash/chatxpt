import { describe, expect, it } from "vitest";

import {
  PRIVATE_VIEWER_RECOVERY_DECISION_ID,
  resolvePrivateViewerRecoveryPolicy,
  type PrivateViewerRecoveryPolicyReport,
} from "../../src/integrations";

const validReport: PrivateViewerRecoveryPolicyReport = {
  decisionId: PRIVATE_VIEWER_RECOVERY_DECISION_ID,
  privateReceipt: {
    sessionScoped: true,
    viewerScoped: true,
    supportsAuthenticatedViewer: true,
    supportsAnonymousToken: true,
    acceptedChoiceIncluded: true,
    sourceModeIncluded: true,
    sessionPointsIncluded: true,
    reconnectExpiryBounded: true,
  },
  sharedState: {
    sanitisedViewerSnapshot: true,
    sharedTallyOnly: true,
    viewerIdentifiersOmitted: true,
    acceptedChoiceOmitted: true,
    sessionPointsOmitted: true,
    privateFieldsOmittedFromHistory: true,
  },
  reconnect: {
    authorisedGrantRequired: true,
    restoresAcceptedChoice: true,
    restoresSessionPoints: true,
    expiredGrantFailsClosed: true,
  },
  commands: {
    duplicateVotePreservesFirstAcceptedChoice: true,
    duplicateVoteDoesNotIncrementTallies: true,
    staleOrLateVoteRejected: true,
    currentRevisionReturned: true,
  },
  verification: {
    checks: [
      "private-receipt-route",
      "sanitised-shared-snapshot",
      "two-viewer-isolation",
      "duplicate-vote-idempotency",
      "session-points-read-model",
      "anonymous-token-reconnect",
      "expired-reconnect-denial",
    ],
    fullCheckPassed: true,
  },
};

describe("private viewer recovery policy", () => {
  it("accepts the D1-06D private acknowledgement and reconnect policy", () => {
    const result = resolvePrivateViewerRecoveryPolicy(validReport);

    expect(result).toMatchObject({
      ok: true,
      decisionId: PRIVATE_VIEWER_RECOVERY_DECISION_ID,
      requiredVerification: [
        "private-receipt-route",
        "sanitised-shared-snapshot",
        "two-viewer-isolation",
        "duplicate-vote-idempotency",
        "session-points-read-model",
        "anonymous-token-reconnect",
        "expired-reconnect-denial",
      ],
      blockerCodes: [],
    });
    expect(result.limitations.join(" ")).toContain("not live Twitch Extension");
  });

  it("rejects private receipts that cannot restore scoped accepted choice and points", () => {
    const result = resolvePrivateViewerRecoveryPolicy({
      ...validReport,
      privateReceipt: {
        ...validReport.privateReceipt,
        viewerScoped: false,
        acceptedChoiceIncluded: false,
        sessionPointsIncluded: false,
        reconnectExpiryBounded: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "private-receipt-not-viewer-scoped",
      "private-receipt-missing-accepted-choice",
      "private-receipt-missing-session-points",
      "private-receipt-missing-bounded-expiry",
    ]));
  });

  it("rejects shared state that leaks personal viewer fields", () => {
    const result = resolvePrivateViewerRecoveryPolicy({
      ...validReport,
      sharedState: {
        ...validReport.sharedState,
        sanitisedViewerSnapshot: false,
        viewerIdentifiersOmitted: false,
        acceptedChoiceOmitted: false,
        sessionPointsOmitted: false,
        privateFieldsOmittedFromHistory: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "shared-state-not-sanitised",
      "shared-state-leaks-viewer-identifiers",
      "shared-state-leaks-accepted-choice",
      "shared-state-leaks-session-points",
      "history-leaks-private-viewer-fields",
    ]));
  });

  it("rejects reconnect and command handling that can double-count or leak stale authority", () => {
    const result = resolvePrivateViewerRecoveryPolicy({
      ...validReport,
      reconnect: {
        ...validReport.reconnect,
        authorisedGrantRequired: false,
        expiredGrantFailsClosed: false,
      },
      commands: {
        ...validReport.commands,
        duplicateVotePreservesFirstAcceptedChoice: false,
        duplicateVoteDoesNotIncrementTallies: false,
        staleOrLateVoteRejected: false,
        currentRevisionReturned: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "reconnect-missing-authorised-grant",
      "reconnect-expired-grant-not-denied",
      "duplicate-vote-does-not-preserve-choice",
      "duplicate-vote-increments-tally",
      "stale-or-late-vote-not-rejected",
      "viewer-command-missing-current-revision",
    ]));
  });

  it("requires every verification class and rejects duplicate verification labels", () => {
    const missing = resolvePrivateViewerRecoveryPolicy({
      ...validReport,
      verification: {
        checks: ["private-receipt-route", "two-viewer-isolation"],
        fullCheckPassed: false,
      },
    });

    expect(missing.ok).toBe(false);
    expect(missing.blockerCodes).toEqual(expect.arrayContaining([
      "private-viewer-recovery-full-check-not-passed",
      "private-viewer-recovery-missing-verification-sanitised-shared-snapshot",
      "private-viewer-recovery-missing-verification-duplicate-vote-idempotency",
      "private-viewer-recovery-missing-verification-session-points-read-model",
      "private-viewer-recovery-missing-verification-anonymous-token-reconnect",
      "private-viewer-recovery-missing-verification-expired-reconnect-denial",
    ]));

    expect(() =>
      resolvePrivateViewerRecoveryPolicy({
        ...validReport,
        verification: {
          ...validReport.verification,
          checks: ["private-receipt-route", "private-receipt-route"],
        },
      }),
    ).toThrow("Private viewer recovery verification checks must be unique");
  });
});
