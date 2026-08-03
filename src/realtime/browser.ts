import {
  domainErrorSchema,
  uiGatewayCommandResultSchema,
  uiGatewayDispatchRequestSchema,
  uiGatewayHealthResultSchema,
  uiGatewayReadRequestSchema,
  uiGatewayReadResultSchema,
  type UiGatewayCommandResult,
  type UiGatewayDispatchRequest,
  type UiGatewayHealthResult,
  type UiGatewayReadRequest,
  type UiGatewayReadResult,
} from "../core";

export interface UiGatewayClient {
  health(): Promise<UiGatewayHealthResult>;
  read(input: UiGatewayReadRequest): Promise<UiGatewayReadResult>;
  dispatch(input: UiGatewayDispatchRequest): Promise<UiGatewayCommandResult>;
}

export interface FetchUiGatewayClientOptions {
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly getAccessToken?: () => string | null | Promise<string | null>;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function internalError(message: string) {
  return domainErrorSchema.parse({
    code: "internal",
    message,
    retryable: true,
  });
}

function dependencyError(message: string) {
  return domainErrorSchema.parse({
    code: "dependency-unavailable",
    message,
    retryable: true,
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class FetchUiGatewayClient implements UiGatewayClient {
  private readonly baseUrl: string;
  private readonly request: typeof globalThis.fetch;
  private readonly getAccessToken: () => string | null | Promise<string | null>;

  constructor(options: FetchUiGatewayClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.request = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken ?? (() => null);
  }

  async health(): Promise<UiGatewayHealthResult> {
    const response = await this.request(joinUrl(this.baseUrl, "/api/ui-gateway/v1/health"), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const parsed = uiGatewayHealthResultSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new Error("UI gateway returned malformed health state");
    }
    return parsed.data;
  }

  async read(input: UiGatewayReadRequest): Promise<UiGatewayReadResult> {
    const parsedInput = uiGatewayReadRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      return { ok: false, error: internalError("UI read request is invalid"), currentRevision: null };
    }
    const query = new URLSearchParams({
      surface: parsedInput.data.surface,
      sessionId: parsedInput.data.sessionId,
    });
    if (parsedInput.data.scenario !== undefined) {
      query.set("scenario", parsedInput.data.scenario);
    }
    let response: Response;
    try {
      response = await this.request(
        joinUrl(this.baseUrl, `/api/ui-gateway/v1/snapshot?${query.toString()}`),
        {
          method: "GET",
          headers: await this.authHeaders(),
          credentials: "same-origin",
          cache: "no-store",
        },
      );
    } catch {
      return {
        ok: false,
        error: dependencyError("UI gateway snapshot request failed"),
        currentRevision: null,
      };
    }
    const parsed = uiGatewayReadResultSchema.safeParse(await readJson(response));
    return parsed.success
      ? parsed.data
      : {
          ok: false,
          error: internalError("UI gateway returned a malformed snapshot result"),
          currentRevision: null,
        };
  }

  async dispatch(input: UiGatewayDispatchRequest): Promise<UiGatewayCommandResult> {
    const parsedInput = uiGatewayDispatchRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      return {
        ok: false,
        commandId: null,
        currentRevision: null,
        error: internalError("UI command request is invalid"),
      };
    }
    const headers = await this.authHeaders();
    headers.set("content-type", "application/json");
    headers.set("x-chatxpt-command", "1");
    let response: Response;
    try {
      response = await this.request(joinUrl(this.baseUrl, "/api/ui-gateway/v1/commands"), {
        method: "POST",
        headers,
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(parsedInput.data),
      });
    } catch {
      return {
        ok: false,
        commandId: parsedInput.data.command.commandId,
        currentRevision: null,
        error: dependencyError("UI gateway command request failed"),
      };
    }
    const parsed = uiGatewayCommandResultSchema.safeParse(await readJson(response));
    return parsed.success
      ? parsed.data
      : {
          ok: false,
          commandId: parsedInput.data.command.commandId,
          currentRevision: null,
          error: internalError("UI gateway returned a malformed command result"),
        };
  }

  private async authHeaders(): Promise<Headers> {
    const headers = new Headers({ accept: "application/json" });
    const token = await this.getAccessToken();
    if (token !== null && token.trim() !== "") {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  }
}
