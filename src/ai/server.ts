import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import type { CandidateProvider } from "../core";
import { createAlgorithmicCandidateStrategy } from "./algorithmic-candidates";
import {
  createOpenAICandidateStrategy,
  type StructuredCandidateTransport,
  type StructuredCandidateTransportResponse,
} from "./openai-candidate-strategy";
import {
  createProviderFallbackGenerationStrategy,
  type ProviderAttemptObservation,
} from "./provider-fallback";
import { createValidatingCandidateProvider } from "./providers";

const configuredEnvironmentSchema = z.object({
  CHATXPT_LLM_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  CHATXPT_LLM_PROVIDER_ID: z.string().trim().min(1).max(40).optional().default("openai"),
  CHATXPT_LLM_TIMEOUT_MS: z.coerce.number().int().min(500).max(120_000).optional().default(8_000),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).max(39).optional().default("gpt-5.6-terra"),
  OPENAI_BASE_URL: z.string().url().optional(),
});

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

interface OpenAIResponseShape {
  readonly output_text: string | null;
  readonly output: readonly {
    readonly type: string;
    readonly content?: readonly { readonly type: string }[];
  }[];
}

/** Converts the Responses API shape without retaining refusal or provider text. */
export function parseOpenAIResponse(
  response: OpenAIResponseShape,
): StructuredCandidateTransportResponse {
  const refused = response.output.some(
    (item) => item.type === "message" && item.content?.some((part) => part.type === "refusal"),
  );
  return {
    outputText: response.output_text || null,
    ...(refused ? { refused: true } : {}),
  };
}

function createOpenAITransport(input: {
  readonly apiKey: string;
  readonly baseURL?: string;
}): StructuredCandidateTransport {
  const client = new OpenAI({
    apiKey: input.apiKey,
    maxRetries: 0,
    ...(input.baseURL === undefined ? {} : { baseURL: input.baseURL }),
  });
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
      return parseOpenAIResponse(response);
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
  const providerId = `${parsed.CHATXPT_LLM_PROVIDER_ID}/${parsed.OPENAI_MODEL}`;
  const providerStrategy = createOpenAICandidateStrategy({
    providerId,
    model: parsed.OPENAI_MODEL,
    transport: options.transport ?? createOpenAITransport({
      apiKey: parsed.OPENAI_API_KEY as string,
      baseURL: parsed.OPENAI_BASE_URL,
    }),
  });
  return {
    provider: createValidatingCandidateProvider(
      createProviderFallbackGenerationStrategy({
        providerId,
        providerStrategy,
        algorithmicStrategy: algorithmic,
        timeoutMs: parsed.CHATXPT_LLM_TIMEOUT_MS,
        observe: options.observe,
      }),
    ),
    mode: "provider-with-fallback",
    providerId,
    reason: "configured",
  };
}
