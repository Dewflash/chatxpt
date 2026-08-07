import { z } from "zod";

import { identifierSchema } from "../../core";

export const OBS_BROWSER_SOURCE_DEFAULT_WIDTH = 1920;
export const OBS_BROWSER_SOURCE_DEFAULT_HEIGHT = 1080;

const overlayAccessTokenSchema = z.string().trim().min(16).max(4096);

const obsBrowserSourceDescriptorSchema = z
  .object({
    url: z.string().url(),
    width: z.number().int().positive().max(7680),
    height: z.number().int().positive().max(4320),
    transparent: z.literal(true),
    readOnly: z.literal(true),
    hidesWhenInactive: z.literal(true),
    latestSnapshotFirst: z.literal(true),
    role: z.literal("overlay"),
    sessionId: identifierSchema,
  })
  .strict();

export interface CreateObsBrowserSourceDescriptorInput {
  readonly baseUrl: string;
  readonly sessionId: string;
  readonly accessToken: string;
  readonly path?: string;
  readonly width?: number;
  readonly height?: number;
}

export type ObsBrowserSourceDescriptor = z.infer<typeof obsBrowserSourceDescriptorSchema>;

export interface ObsBrowserSourceRequest {
  readonly sessionId: string;
  readonly accessToken: string;
}

export function createObsBrowserSourceDescriptor(
  input: CreateObsBrowserSourceDescriptorInput,
): ObsBrowserSourceDescriptor {
  const baseUrl = new URL(input.baseUrl);
  if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") {
    throw new Error("OBS Browser Source URL must use HTTPS outside localhost");
  }

  const sessionId = identifierSchema.parse(input.sessionId);
  const accessToken = overlayAccessTokenSchema.parse(input.accessToken);
  const url = new URL(input.path ?? "/overlay", baseUrl);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("overlayAccessToken", accessToken);

  return obsBrowserSourceDescriptorSchema.parse({
    url: url.toString(),
    width: input.width ?? OBS_BROWSER_SOURCE_DEFAULT_WIDTH,
    height: input.height ?? OBS_BROWSER_SOURCE_DEFAULT_HEIGHT,
    transparent: true,
    readOnly: true,
    hidesWhenInactive: true,
    latestSnapshotFirst: true,
    role: "overlay",
    sessionId,
  });
}

export function parseObsBrowserSourceRequest(input: string | URL): ObsBrowserSourceRequest {
  const url = typeof input === "string" ? new URL(input) : input;
  return {
    sessionId: identifierSchema.parse(url.searchParams.get("sessionId")),
    accessToken: overlayAccessTokenSchema.parse(url.searchParams.get("overlayAccessToken")),
  };
}

export function redactObsBrowserSourceUrl(input: string | URL): string {
  const url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  if (url.searchParams.has("overlayAccessToken")) {
    url.searchParams.set("overlayAccessToken", "redacted");
  }
  return url.toString();
}
