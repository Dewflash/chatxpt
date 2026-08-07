import {
  commandEnvelopeSchema,
  domainErrorSchema,
  overlayViewModelSchema,
  streamerServiceCommandResultSchema,
  streamerServiceCommandSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
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

function parseSnapshotForRole<Role extends UiGatewaySnapshotRole>(
  role: Role,
  value: unknown,
): RoleViewModels[Role] | null {
  const parsed =
    role === "streamer"
      ? streamerViewModelSchema.safeParse(value)
      : role === "viewer"
        ? viewerViewModelSchema.safeParse(value)
        : overlayViewModelSchema.safeParse(value);
  return parsed.success ? parsed.data as RoleViewModels[Role] : null;
}

function parseRoleViewModels(value: unknown): RoleViewModels | null {
  if (!isObject(value)) return null;
  const streamer = streamerViewModelSchema.safeParse(value.streamer);
  const viewer = viewerViewModelSchema.safeParse(value.viewer);
  const overlay = overlayViewModelSchema.safeParse(value.overlay);
  if (!streamer.success || !viewer.success || !overlay.success) return null;
  return {
    streamer: streamer.data,
    viewer: viewer.data,
    overlay: overlay.data,
  };
}

function roleViewModelsMatchCommand(
  views: RoleViewModels,
  command: CommandEnvelope | StreamerServiceCommand,
  revision: number,
): boolean {
  return [views.streamer, views.viewer, views.overlay].every(
    (view) =>
      view.envelope.sessionId === command.sessionId &&
      view.session.sessionId === command.sessionId &&
      view.envelope.revision === revision,
  );
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
    const snapshot = parseSnapshotForRole(input.role, body.snapshot);
    const revision = snapshot?.envelope.revision ?? null;
    const reality = parseReality(body);
    if (
      revision === null ||
      reality === undefined ||
      body.role !== input.role ||
      body.sessionId !== input.sessionId ||
      snapshot?.session.sessionId !== input.sessionId
    ) {
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
    const parsedEnvelopeCommand = commandEnvelopeSchema.safeParse(command);
    const parsedServiceCommand = streamerServiceCommandSchema.safeParse(command);
    const parsedCommand = parsedEnvelopeCommand.success
      ? parsedEnvelopeCommand.data
      : parsedServiceCommand.success
        ? parsedServiceCommand.data
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
    const views = body.views === null || body.views === undefined
      ? null
      : parseRoleViewModels(body.views);
    if (
      (body.views !== null && body.views !== undefined && views === null) ||
      (views !== null && !roleViewModelsMatchCommand(views, parsedCommand, body.revision))
    ) {
      return {
        ok: false,
        reality,
        commandId: parsedCommand.commandId,
        currentRevision: null,
        error: typedError("internal", "UI gateway returned malformed command views"),
      };
    }
    const serviceCommand = parseServiceCommandResult(body.serviceCommand);
    if (
      parsedServiceCommand.success &&
      (serviceCommand === undefined ||
        (serviceCommand.commandId !== null && serviceCommand.commandId !== parsedCommand.commandId))
    ) {
      return {
        ok: false,
        reality,
        commandId: parsedCommand.commandId,
        currentRevision: null,
        error: typedError("internal", "UI gateway returned an incomplete service command result"),
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
      views,
      serviceCommand,
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
