import {
  commandEnvelopeSchema,
  domainErrorSchema,
  streamerServiceCommandResultSchema,
  streamerServiceCommandSchema,
  type CommandEnvelope,
  type DomainError,
  type RoleViewModels,
  type StreamerServiceCommandResult,
  type StreamerServiceCommand,
} from "../core";

export type UiGatewaySnapshotRole = keyof RoleViewModels;

export interface UiGatewayRealityLabel {
  readonly evidenceClass: "live" | "diagnostic" | "fixture";
  readonly liveInputsUsed: boolean;
  readonly label: string;
  readonly limitations?: readonly string[];
}

export interface UiGatewayReadRequest<Role extends UiGatewaySnapshotRole = UiGatewaySnapshotRole> {
  readonly sessionId: string;
  readonly role: Role;
  readonly principalId: string;
}

export type UiGatewayReadResult<Role extends UiGatewaySnapshotRole = UiGatewaySnapshotRole> =
  | {
      readonly ok: true;
      readonly reality: UiGatewayRealityLabel;
      readonly sessionId: string;
      readonly role: Role;
      readonly currentRevision: number;
      readonly snapshot: RoleViewModels[Role];
      readonly fixtureCatalog?: unknown;
    }
  | {
      readonly ok: false;
      readonly reality?: UiGatewayRealityLabel;
      readonly currentRevision: null;
      readonly error: DomainError;
    };

export type UiGatewayCommandResult =
  | {
      readonly ok: true;
      readonly reality: UiGatewayRealityLabel;
      readonly outcome: "committed" | "duplicate";
      readonly commandId: string;
      readonly currentRevision: number;
      readonly delivery: "published" | "pending-recovery" | "not-republished";
      readonly receipt: {
        readonly commandId: string;
        readonly acceptedAt: number;
        readonly eventTypes: readonly string[];
      };
      readonly views: RoleViewModels | null;
      readonly serviceCommand?: StreamerServiceCommandResult;
    }
  | {
      readonly ok: false;
      readonly reality?: UiGatewayRealityLabel;
      readonly commandId: string | null;
      readonly currentRevision: null;
      readonly error: DomainError;
    };

export interface UiGatewayClient {
  read<Role extends UiGatewaySnapshotRole>(
    input: UiGatewayReadRequest<Role>,
  ): Promise<UiGatewayReadResult<Role>>;
  dispatch(command: CommandEnvelope | StreamerServiceCommand): Promise<UiGatewayCommandResult>;
}

export interface FetchUiGatewayClientOptions {
  readonly endpoint?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly getAccessToken?: () => string | null | Promise<string | null>;
}

function joinUrl(endpoint: string, query: URLSearchParams | null): string {
  const base = endpoint.replace(/\/$/, "");
  return query === null ? base : `${base}?${query.toString()}`;
}

function typedError(code: DomainError["code"], message: string): DomainError {
  return domainErrorSchema.parse({ code, message, retryable: code !== "validation" });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseReality(value: unknown): UiGatewayRealityLabel | undefined {
  if (!isObject(value) || !isObject(value.reality)) return undefined;
  const reality = value.reality;
  if (
    (reality.evidenceClass === "live" ||
      reality.evidenceClass === "diagnostic" ||
      reality.evidenceClass === "fixture") &&
    typeof reality.liveInputsUsed === "boolean" &&
    typeof reality.label === "string"
  ) {
    return {
      evidenceClass: reality.evidenceClass,
      liveInputsUsed: reality.liveInputsUsed,
      label: reality.label,
      limitations: Array.isArray(reality.limitations)
        ? reality.limitations.filter((item): item is string => typeof item === "string")
        : undefined,
    };
  }
  return undefined;
}

function parseError(value: unknown, fallback: DomainError): DomainError {
  if (!isObject(value)) return fallback;
  const parsed = domainErrorSchema.safeParse(value.error);
  return parsed.success ? parsed.data : fallback;
}

function parseServiceCommandResult(value: unknown): StreamerServiceCommandResult | undefined {
  const parsed = streamerServiceCommandResultSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export class FetchUiGatewayClient implements UiGatewayClient {
  private readonly endpoint: string;
  private readonly request: typeof globalThis.fetch;
  private readonly getAccessToken: () => string | null | Promise<string | null>;

  constructor(options: FetchUiGatewayClientOptions = {}) {
    this.endpoint = options.endpoint ?? "/api/diagnostics/ui-gateway";
    this.request = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken ?? (() => null);
  }

  async read<Role extends UiGatewaySnapshotRole>(
    input: UiGatewayReadRequest<Role>,
  ): Promise<UiGatewayReadResult<Role>> {
    const query = new URLSearchParams({
      sessionId: input.sessionId,
      role: input.role,
      principalId: input.principalId,
    });
    let response: Response;
    try {
      response = await this.request(joinUrl(this.endpoint, query), {
        method: "GET",
        headers: await this.authHeaders(),
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      return {
        ok: false,
        currentRevision: null,
        error: typedError("dependency-unavailable", "UI gateway snapshot request failed"),
      };
    }

    const body = await readJson(response);
    if (!isObject(body) || body.ok !== true || !isObject(body.snapshot)) {
      return {
        ok: false,
        reality: parseReality(body),
        currentRevision: null,
        error: parseError(
          body,
          typedError("internal", "UI gateway returned a malformed snapshot result"),
        ),
      };
    }
    const snapshot = body.snapshot as RoleViewModels[Role];
    const revision = isObject(snapshot.envelope) && typeof snapshot.envelope.revision === "number"
      ? snapshot.envelope.revision
      : null;
    const reality = parseReality(body);
    if (revision === null || reality === undefined) {
      return {
        ok: false,
        currentRevision: null,
        error: typedError("internal", "UI gateway returned an incomplete snapshot result"),
      };
    }
    return {
      ok: true,
      reality,
      sessionId: String(body.sessionId ?? input.sessionId),
      role: input.role,
      currentRevision: revision,
      snapshot,
      fixtureCatalog: body.fixtureCatalog,
    };
  }

  async dispatch(command: CommandEnvelope | StreamerServiceCommand): Promise<UiGatewayCommandResult> {
    const parsedCommand = commandEnvelopeSchema.safeParse(command).success
      ? commandEnvelopeSchema.parse(command)
      : streamerServiceCommandSchema.safeParse(command).success
        ? streamerServiceCommandSchema.parse(command)
        : null;
    if (parsedCommand === null) {
      return {
        ok: false,
        commandId: isObject(command) && typeof command.commandId === "string" ? command.commandId : null,
        currentRevision: null,
        error: typedError("validation", "UI command request is invalid"),
      };
    }

    let response: Response;
    try {
      const headers = await this.authHeaders();
      headers.set("content-type", "application/json");
      headers.set("x-chatxpt-command", "1");
      response = await this.request(joinUrl(this.endpoint, null), {
        method: "POST",
        headers,
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ command: parsedCommand }),
      });
    } catch {
      return {
        ok: false,
        commandId: parsedCommand.commandId,
        currentRevision: null,
        error: typedError("dependency-unavailable", "UI gateway command request failed"),
      };
    }

    const body = await readJson(response);
    if (!isObject(body) || body.ok !== true || typeof body.revision !== "number") {
      return {
        ok: false,
        reality: parseReality(body),
        commandId: parsedCommand.commandId,
        currentRevision: null,
        error: parseError(
          body,
          typedError("internal", "UI gateway returned a malformed command result"),
        ),
      };
    }
    const receipt = isObject(body.receipt)
      ? {
          commandId:
            typeof body.receipt.commandId === "string"
              ? body.receipt.commandId
              : parsedCommand.commandId,
          acceptedAt:
            typeof body.receipt.acceptedAt === "number" ? body.receipt.acceptedAt : 0,
          eventTypes: Array.isArray(body.receipt.eventTypes)
            ? body.receipt.eventTypes.filter((event): event is string => typeof event === "string")
            : [],
        }
      : {
          commandId: parsedCommand.commandId,
          acceptedAt: 0,
          eventTypes: [],
        };
    const reality = parseReality(body);
    if (reality === undefined) {
      return {
        ok: false,
        commandId: parsedCommand.commandId,
        currentRevision: null,
        error: typedError("internal", "UI gateway returned an incomplete command result"),
      };
    }
    return {
      ok: true,
      reality,
      outcome: body.outcome === "duplicate" ? "duplicate" : "committed",
      commandId: receipt.commandId,
      currentRevision: body.revision,
      delivery:
        body.delivery === "pending-recovery" || body.delivery === "not-republished"
          ? body.delivery
          : "published",
      receipt,
      views: isObject(body.views) ? body.views as unknown as RoleViewModels : null,
      serviceCommand: parseServiceCommandResult(body.serviceCommand),
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
