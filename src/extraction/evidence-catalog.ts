import { z } from "zod";

import { evidenceClassSchema, messageSourceSchema } from "../core";

export const extractionAssetKindSchema = z.enum([
  "gameplay-recording",
  "gameplay-frame",
  "chat-transcript",
  "annotation",
]);

export const extractionAssetAcquisitionSchema = z.enum([
  "live-obs",
  "recorded-owned-gameplay",
  "recorded-authorized-gameplay",
  "sanitized-real-chat",
  "synthetic-test-fixture",
]);

export const extractionAssetStorageSchema = z.enum([
  "repository-fixture",
  "private-team-drive",
  "local-only",
  "not-stored",
]);

export const extractionAssetUseSchema = z.enum([
  "live-demo-proof",
  "real-extraction-evaluation",
  "diagnostic-spike",
  "fixture-test",
]);

export const extractionEvidenceAssetSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    kind: extractionAssetKindSchema,
    acquisition: extractionAssetAcquisitionSchema,
    source: messageSourceSchema,
    storage: extractionAssetStorageSchema,
    privacyReviewed: z.boolean(),
    annotationsSeparated: z.boolean(),
    containsRawPersonalData: z.boolean(),
    notes: z.string().trim().min(1).max(240),
  })
  .strict()
  .superRefine((asset, context) => {
    if (asset.acquisition === "synthetic-test-fixture" && asset.source !== "test-fixture") {
      context.addIssue({
        code: "custom",
        message: "Synthetic extraction fixtures must use test-fixture as their source",
        path: ["source"],
      });
    }
    if (asset.storage === "repository-fixture" && asset.containsRawPersonalData) {
      context.addIssue({
        code: "custom",
        message: "Repository extraction fixtures cannot contain raw personal data",
        path: ["containsRawPersonalData"],
      });
    }
  });

export const extractionEvidenceAssessmentSchema = z
  .object({
    asset: extractionEvidenceAssetSchema,
    evidenceClass: evidenceClassSchema,
    allowedUses: z.array(extractionAssetUseSchema).max(4),
    canSupportLiveDemoClaim: z.boolean(),
    blockers: z.array(z.string().trim().min(1).max(200)).max(8),
  })
  .strict();

export type ExtractionAssetKind = z.infer<typeof extractionAssetKindSchema>;
export type ExtractionAssetAcquisition = z.infer<typeof extractionAssetAcquisitionSchema>;
export type ExtractionAssetStorage = z.infer<typeof extractionAssetStorageSchema>;
export type ExtractionAssetUse = z.infer<typeof extractionAssetUseSchema>;
export type ExtractionEvidenceAsset = z.infer<typeof extractionEvidenceAssetSchema>;
export type ExtractionEvidenceAssessment = z.infer<typeof extractionEvidenceAssessmentSchema>;

function uniqueUses(uses: readonly ExtractionAssetUse[]): ExtractionAssetUse[] {
  return [...new Set(uses)];
}

function isGameplayCaptureKind(asset: ExtractionEvidenceAsset): boolean {
  return asset.kind === "gameplay-recording" || asset.kind === "gameplay-frame";
}

function isLiveObsGameplayCapture(asset: ExtractionEvidenceAsset): boolean {
  return (
    asset.acquisition === "live-obs" &&
    asset.source === "obs-virtual-camera" &&
    isGameplayCaptureKind(asset)
  );
}

function deriveEvidenceClass(asset: ExtractionEvidenceAsset): z.infer<typeof evidenceClassSchema> {
  if (asset.acquisition === "synthetic-test-fixture") return "fixture";
  if (isLiveObsGameplayCapture(asset)) return "live";
  return "diagnostic";
}

function deriveAllowedUses(asset: ExtractionEvidenceAsset): ExtractionAssetUse[] {
  if (asset.acquisition === "synthetic-test-fixture") return ["fixture-test"];

  const uses: ExtractionAssetUse[] = ["diagnostic-spike"];
  if (
    ((asset.acquisition === "recorded-owned-gameplay" ||
      asset.acquisition === "recorded-authorized-gameplay") &&
      isGameplayCaptureKind(asset)) ||
    asset.acquisition === "sanitized-real-chat"
  ) {
    uses.push("real-extraction-evaluation");
  }
  if (isLiveObsGameplayCapture(asset)) {
    uses.push("real-extraction-evaluation", "live-demo-proof");
  }
  return uniqueUses(uses);
}

function collectBlockers(asset: ExtractionEvidenceAsset): string[] {
  const blockers: string[] = [];

  if (asset.source === "test-fixture" && asset.acquisition !== "synthetic-test-fixture") {
    blockers.push("Only synthetic-test-fixture assets may use the test-fixture source.");
  }

  if (asset.acquisition === "synthetic-test-fixture") {
    blockers.push("Synthetic fixtures prove component behaviour only and cannot support live claims.");
  }

  if (asset.kind === "chat-transcript" && asset.acquisition !== "sanitized-real-chat") {
    blockers.push("Chat transcripts must be sanitised before Role 2 can use them as real audience evidence.");
  }

  if (
    asset.acquisition === "sanitized-real-chat" &&
    (asset.kind !== "chat-transcript" || asset.source !== "twitch")
  ) {
    blockers.push("Sanitised real chat evidence must be a Twitch chat transcript.");
  }

  if (
    asset.kind === "annotation" &&
    (asset.acquisition === "live-obs" ||
      asset.source === "obs-virtual-camera" ||
      asset.acquisition === "recorded-owned-gameplay" ||
      asset.acquisition === "recorded-authorized-gameplay")
  ) {
    blockers.push("Annotation-only assets cannot stand in for gameplay capture evidence.");
  }

  if (asset.containsRawPersonalData) {
    blockers.push("Raw personal data must be removed or kept out of repository evidence before use.");
  }

  if (!asset.privacyReviewed) {
    blockers.push("Privacy review is required before the asset can become project evidence.");
  }

  if (
    (asset.kind === "gameplay-recording" || asset.kind === "gameplay-frame") &&
    !asset.annotationsSeparated
  ) {
    blockers.push("Expected annotations must stay separate from production analyzer inputs.");
  }

  if (asset.acquisition === "live-obs" && asset.source !== "obs-virtual-camera") {
    blockers.push("Live demo extraction proof must come through the OBS Virtual Camera source.");
  }

  if (asset.acquisition === "live-obs" && !isGameplayCaptureKind(asset)) {
    blockers.push("Live demo extraction proof requires gameplay-frame or gameplay-recording input.");
  }

  return blockers;
}

export function assessExtractionEvidenceAsset(
  input: ExtractionEvidenceAsset,
): ExtractionEvidenceAssessment {
  const asset = extractionEvidenceAssetSchema.parse(input);
  const evidenceClass = deriveEvidenceClass(asset);
  const allowedUses = deriveAllowedUses(asset);
  const blockers = collectBlockers(asset);
  const canSupportLiveDemoClaim =
    evidenceClass === "live" &&
    allowedUses.includes("live-demo-proof") &&
    blockers.length === 0 &&
    isLiveObsGameplayCapture(asset);

  return extractionEvidenceAssessmentSchema.parse({
    asset,
    evidenceClass,
    allowedUses,
    canSupportLiveDemoClaim,
    blockers,
  });
}
