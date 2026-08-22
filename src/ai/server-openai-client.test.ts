import { beforeEach, describe, expect, it, vi } from "vitest";

const { openAIConstructor } = vi.hoisted(() => ({
  openAIConstructor: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class OpenAIClientMock {
    readonly responses = { create: vi.fn() };

    constructor(options: unknown) {
      openAIConstructor(options);
    }
  },
}));

import { createConfiguredCandidateProvider } from "./server";

describe("OpenAI server transport configuration", () => {
  beforeEach(() => openAIConstructor.mockClear());

  it("disables SDK retries so D-072 remains a one-attempt boundary", () => {
    createConfiguredCandidateProvider({
      environment: {
        CHATXPT_LLM_ENABLED: "true",
        CHATXPT_LLM_PROVIDER_ID: "openai",
        OPENAI_MODEL: "gpt-5.6-terra",
        OPENAI_API_KEY: "test-server-key",
      },
    });

    expect(openAIConstructor).toHaveBeenCalledOnce();
    expect(openAIConstructor).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0 }));
  });
});
