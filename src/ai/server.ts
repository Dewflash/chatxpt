import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import type { CandidateProvider } from "../core";
import { createAlgorithmicCandidateStrategy } from "./algorithmic-candidates";
import {
  createOpenAICandidateStrategy,
  type StructuredCandidateTransport,
} from "./openai-candidate-strategy";
import {
  createProviderFallbackGenerationStrategy,
  type ProviderAttemptObservation,
} from "./provider-fallback";
import { createValidatingCandidateProvider } from "./providers";

const configuredEnvironmentSchema = z.object({
  CHATXPT_LLM_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
});

export const OPENAI_CANDIDATE_MODEL = "gpt-5.6-terra" as const;
export const OPENAI_CANDIDATE_PROVIDER_ID = `openai/${OPENAI_CANDIDATE_MODEL}` as const;
export const OPENAI_CANDIDATE_TIMEOUT_MS = 8_000 as const;

export interface ConfiguredCandidateProvider {
  readonly provider: CandidateProvider;
  readonly mode: "algorithmic" | "provider-with-fallback";
  readonly providerId: string | null;
  readonly reason: "disabled" | "missing-credential" | "configured";
}

export interface ConfiguredCandidateProviderOptions {
  readonly environment?: Record<string, string | undefined>;
  readonly transport?: StructuredCandidateTransport;
  readonly observe?: (observation: ProviderAttemptObservation) => void;
}

function createOpenAITransport(apiKey: string): StructuredCandidateTransport {
  const client = new OpenAI({ apiKey });
  return {
    async generate(request) {
      const response = await client.responses.create(
        {
          model: request.model,
          instructions: request.instructions,
          input: request.input,
          max_output_tokens: 1_400,
          reasoning: { effort: "low" },
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: request.schemaName,
              strict: true,
              schema: request.jsonSchema,
            },
          },
        },
        { signal: request.signal },
      );
      const refused = response.output.some(
        (item) => item.type === "message" && item.content.some((content) => content.type === "refusal"),
      );
      return { outputText: response.output_text || null, refused };
    },
  };
}

/** Server-only composition. Missing/disabled credentials preserve algorithmic generation. */
export function createConfiguredCandidateProvider(
  options: ConfiguredCandidateProviderOptions = {},
): ConfiguredCandidateProvider {
  const parsed = configuredEnvironmentSchema.parse(options.environment ?? process.env);
  const algorithmic = createAlgorithmicCandidateStrategy();
  if (parsed.CHATXPT_LLM_ENABLED !== "true") {
    return {
      provider: createValidatingCandidateProvider(algorithmic),
      mode: "algorithmic",
      providerId: null,
      reason: "disabled",
    };
  }
  if (parsed.OPENAI_API_KEY === undefined && options.transport === undefined) {
    return {
      provider: createValidatingCandidateProvider(algorithmic),
      mode: "algorithmic",
      providerId: null,
      reason: "missing-credential",
    };
  }
  const providerStrategy = createOpenAICandidateStrategy({
    providerId: OPENAI_CANDIDATE_PROVIDER_ID,
    model: OPENAI_CANDIDATE_MODEL,
    transport: options.transport ?? createOpenAITransport(parsed.OPENAI_API_KEY as string),
  });
  return {
    provider: createValidatingCandidateProvider(
      createProviderFallbackGenerationStrategy({
        providerId: OPENAI_CANDIDATE_PROVIDER_ID,
        providerStrategy,
        algorithmicStrategy: algorithmic,
        timeoutMs: OPENAI_CANDIDATE_TIMEOUT_MS,
        observe: options.observe,
      }),
    ),
    mode: "provider-with-fallback",
    providerId: OPENAI_CANDIDATE_PROVIDER_ID,
    reason: "configured",
  };
}
