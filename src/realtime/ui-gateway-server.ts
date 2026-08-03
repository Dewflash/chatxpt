import "server-only";

import type {
  UiGatewayCommandResult,
  UiGatewayDispatchRequest,
  UiGatewayHealthResult,
  UiGatewayReadRequest,
  UiGatewayReadResult,
} from "../core";

export interface UiGatewayServer {
  health(): Promise<UiGatewayHealthResult> | UiGatewayHealthResult;
  read(input: UiGatewayReadRequest, accessToken: string | null): Promise<UiGatewayReadResult>;
  dispatch(
    input: UiGatewayDispatchRequest,
    accessToken: string | null,
  ): Promise<UiGatewayCommandResult>;
}

export function diagnosticHarnessEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return (
    environment.NODE_ENV !== "production" &&
    environment.CHATXPT_ENABLE_DIAGNOSTIC_HARNESS === "true"
  );
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization === null || !authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token === "" ? null : token;
}

export function mutationRequestAllowed(request: Request): boolean {
  if (request.headers.get("x-chatxpt-command") !== "1") return false;
  if (bearerToken(request) !== null) return true;

  const origin = request.headers.get("origin");
  if (origin === null) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
