import { describe, expect, it } from "vitest";

import {
  UI_GATEWAY_HARNESS_DECISION_ID,
  resolveUiGatewayHarnessPolicy,
  type UiGatewayHarnessPolicyReport,
} from "../../src/integrations";

const validReport: UiGatewayHarnessPolicyReport = {
  decisionId: UI_GATEWAY_HARNESS_DECISION_ID,
  client: {
    browserSafeFetchClient: true,
    sameOriginCredentials: true,
    noStoreReads: true,
    typedCommandResults: true,
    currentRevisionReturned: true,
    businessLogicInUiClient: false,
  },
  harness: {
    localOnly: true,
    fixtureLabelVisible: true,
    liveInputsClaimed: false,
    surfaces: [
      "studio",
      "twitch-config",
      "twitch-live-config",
      "viewer-board",
      "hosted-board",
      "obs-overlay",
    ],
    fixtureCatalogPublished: true,
    productionRoutesGated: true,
  },
  verification: {
    checks: [
      "schema-contracts",
      "command-results",
      "jsdom-interactions",
      "browser-screenshots",
      "production-route-gating",
    ],
    fullCheckPassed: true,
  },
};

describe("UI gateway harness policy", () => {
  it("accepts the browser-safe fixture harness policy selected by D1-06C", () => {
    const result = resolveUiGatewayHarnessPolicy(validReport);

    expect(result).toMatchObject({
      ok: true,
      decisionId: UI_GATEWAY_HARNESS_DECISION_ID,
      requiredSurfaces: [
        "studio",
        "twitch-config",
        "twitch-live-config",
        "viewer-board",
        "hosted-board",
        "obs-overlay",
      ],
      requiredVerification: [
        "schema-contracts",
        "command-results",
        "jsdom-interactions",
        "browser-screenshots",
        "production-route-gating",
      ],
      blockerCodes: [],
    });
    expect(result.limitations.join(" ")).toContain("not live Twitch");
  });

  it("rejects browser clients that own business logic or omit command/revision safeguards", () => {
    const result = resolveUiGatewayHarnessPolicy({
      ...validReport,
      client: {
        ...validReport.client,
        noStoreReads: false,
        typedCommandResults: false,
        currentRevisionReturned: false,
        businessLogicInUiClient: true,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "ui-gateway-missing-no-store-reads",
      "ui-gateway-missing-typed-command-results",
      "ui-gateway-missing-current-revision",
      "ui-gateway-business-logic-in-client",
    ]));
  });

  it("rejects a harness that is not clearly fixture-only and production-gated", () => {
    const result = resolveUiGatewayHarnessPolicy({
      ...validReport,
      harness: {
        ...validReport.harness,
        localOnly: false,
        fixtureLabelVisible: false,
        liveInputsClaimed: true,
        fixtureCatalogPublished: false,
        productionRoutesGated: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "ui-gateway-harness-not-local-only",
      "ui-gateway-fixture-label-missing",
      "ui-gateway-fixture-claimed-live",
      "ui-gateway-fixture-catalog-missing",
      "ui-gateway-production-routes-not-gated",
    ]));
  });

  it("rejects missing role surfaces and missing verification classes", () => {
    const result = resolveUiGatewayHarnessPolicy({
      ...validReport,
      harness: {
        ...validReport.harness,
        surfaces: ["studio", "viewer-board", "obs-overlay"],
      },
      verification: {
        checks: ["schema-contracts", "command-results"],
        fullCheckPassed: false,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.blockerCodes).toEqual(expect.arrayContaining([
      "ui-gateway-missing-surface-twitch-config",
      "ui-gateway-missing-surface-twitch-live-config",
      "ui-gateway-missing-surface-hosted-board",
      "ui-gateway-full-check-not-passed",
      "ui-gateway-missing-verification-jsdom-interactions",
      "ui-gateway-missing-verification-browser-screenshots",
      "ui-gateway-missing-verification-production-route-gating",
    ]));
  });

  it("rejects duplicate surfaces and duplicate verification labels before resolving", () => {
    expect(() =>
      resolveUiGatewayHarnessPolicy({
        ...validReport,
        harness: {
          ...validReport.harness,
          surfaces: ["studio", "studio"],
        },
      }),
    ).toThrow("UI harness surfaces must be unique");

    expect(() =>
      resolveUiGatewayHarnessPolicy({
        ...validReport,
        verification: {
          ...validReport.verification,
          checks: ["schema-contracts", "schema-contracts"],
        },
      }),
    ).toThrow("UI harness verification checks must be unique");
  });
});
