import { z } from "zod";

export const UI_GATEWAY_HARNESS_DECISION_ID = "D-060";

export const uiGatewayHarnessSurfaceSchema = z.enum([
  "studio",
  "twitch-config",
  "twitch-live-config",
  "viewer-board",
  "hosted-board",
  "obs-overlay",
]);

export const uiGatewayHarnessVerificationSchema = z.enum([
  "schema-contracts",
  "command-results",
  "jsdom-interactions",
  "browser-screenshots",
  "production-route-gating",
]);

export const uiGatewayHarnessPolicyReportSchema = z
  .object({
    decisionId: z.literal(UI_GATEWAY_HARNESS_DECISION_ID),
    client: z
      .object({
        browserSafeFetchClient: z.boolean(),
        sameOriginCredentials: z.boolean(),
        noStoreReads: z.boolean(),
        typedCommandResults: z.boolean(),
        currentRevisionReturned: z.boolean(),
        businessLogicInUiClient: z.boolean(),
      })
      .strict(),
    harness: z
      .object({
        localOnly: z.boolean(),
        fixtureLabelVisible: z.boolean(),
        liveInputsClaimed: z.boolean(),
        surfaces: z.array(uiGatewayHarnessSurfaceSchema).max(6),
        fixtureCatalogPublished: z.boolean(),
        productionRoutesGated: z.boolean(),
      })
      .strict()
      .superRefine((harness, context) => {
        if (new Set(harness.surfaces).size !== harness.surfaces.length) {
          context.addIssue({
            code: "custom",
            message: "UI harness surfaces must be unique",
            path: ["surfaces"],
          });
        }
      }),
    verification: z
      .object({
        checks: z.array(uiGatewayHarnessVerificationSchema).max(5),
        fullCheckPassed: z.boolean(),
      })
      .strict()
      .superRefine((verification, context) => {
        if (new Set(verification.checks).size !== verification.checks.length) {
          context.addIssue({
            code: "custom",
            message: "UI harness verification checks must be unique",
            path: ["checks"],
          });
        }
      }),
  })
  .strict();

export const uiGatewayHarnessPolicyResolutionSchema = z
  .object({
    ok: z.boolean(),
    decisionId: z.literal(UI_GATEWAY_HARNESS_DECISION_ID),
    requiredSurfaces: z.array(uiGatewayHarnessSurfaceSchema).length(6),
    requiredVerification: z.array(uiGatewayHarnessVerificationSchema).length(5),
    blockerCodes: z.array(z.string().trim().min(1).max(120)).max(24),
    limitations: z.array(z.string().trim().min(1).max(240)).max(8),
  })
  .strict();

export type UiGatewayHarnessSurface = z.infer<typeof uiGatewayHarnessSurfaceSchema>;
export type UiGatewayHarnessVerification = z.infer<typeof uiGatewayHarnessVerificationSchema>;
export type UiGatewayHarnessPolicyReport = z.infer<typeof uiGatewayHarnessPolicyReportSchema>;
export type UiGatewayHarnessPolicyResolution = z.infer<typeof uiGatewayHarnessPolicyResolutionSchema>;

const requiredSurfaces: readonly UiGatewayHarnessSurface[] = [
  "studio",
  "twitch-config",
  "twitch-live-config",
  "viewer-board",
  "hosted-board",
  "obs-overlay",
] as const;

const requiredVerification: readonly UiGatewayHarnessVerification[] = [
  "schema-contracts",
  "command-results",
  "jsdom-interactions",
  "browser-screenshots",
  "production-route-gating",
] as const;

export function resolveUiGatewayHarnessPolicy(
  input: UiGatewayHarnessPolicyReport | z.input<typeof uiGatewayHarnessPolicyReportSchema>,
): UiGatewayHarnessPolicyResolution {
  const report = uiGatewayHarnessPolicyReportSchema.parse(input);
  const blockers = new Set<string>();

  const clientChecks = [
    ["browserSafeFetchClient", "ui-gateway-missing-browser-safe-client"],
    ["sameOriginCredentials", "ui-gateway-missing-same-origin-credentials"],
    ["noStoreReads", "ui-gateway-missing-no-store-reads"],
    ["typedCommandResults", "ui-gateway-missing-typed-command-results"],
    ["currentRevisionReturned", "ui-gateway-missing-current-revision"],
  ] as const;
  for (const [field, blocker] of clientChecks) {
    if (!report.client[field]) blockers.add(blocker);
  }
  if (report.client.businessLogicInUiClient) {
    blockers.add("ui-gateway-business-logic-in-client");
  }

  if (!report.harness.localOnly) blockers.add("ui-gateway-harness-not-local-only");
  if (!report.harness.fixtureLabelVisible) blockers.add("ui-gateway-fixture-label-missing");
  if (report.harness.liveInputsClaimed) blockers.add("ui-gateway-fixture-claimed-live");
  if (!report.harness.fixtureCatalogPublished) blockers.add("ui-gateway-fixture-catalog-missing");
  if (!report.harness.productionRoutesGated) blockers.add("ui-gateway-production-routes-not-gated");
  for (const surface of requiredSurfaces) {
    if (!report.harness.surfaces.includes(surface)) {
      blockers.add(`ui-gateway-missing-surface-${surface}`);
    }
  }

  if (!report.verification.fullCheckPassed) blockers.add("ui-gateway-full-check-not-passed");
  for (const check of requiredVerification) {
    if (!report.verification.checks.includes(check)) {
      blockers.add(`ui-gateway-missing-verification-${check}`);
    }
  }

  return uiGatewayHarnessPolicyResolutionSchema.parse({
    ok: blockers.size === 0,
    decisionId: UI_GATEWAY_HARNESS_DECISION_ID,
    requiredSurfaces,
    requiredVerification,
    blockerCodes: [...blockers],
    limitations: [
      "This policy validates the local fixture harness and browser-safe client only; it is not live Twitch, OBS, Supabase, or production evidence.",
      "Role 4 and Role 5 still replace diagnostic surfaces with role-owned public modules before real product evidence.",
      "Production diagnostics remain disabled unless Role 1 deliberately enables them for a controlled verification pass.",
    ],
  });
}
