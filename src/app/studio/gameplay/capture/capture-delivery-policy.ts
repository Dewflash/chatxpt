export const CAPTURE_DELIVERY_STALE_AFTER_MS = 12_000;

export type CaptureDeliveryResponseAction =
  | "accepted"
  | "refresh-authority"
  | "skip-stale"
  | "throttled"
  | "retry"
  | "fatal";

/**
 * Browser capture may be briefly suspended while the streamer switches to the
 * game. Never send a queued frame that is already close to the server's
 * 15-second live-ingress boundary; the next fresh frame is authoritative.
 */
export function captureSnapshotIsStale(
  occurredAt: number,
  now = Date.now(),
): boolean {
  return occurredAt < now - CAPTURE_DELIVERY_STALE_AFTER_MS;
}

/** Keeps recoverable delivery failures from owning or stopping the media feed. */
export function captureDeliveryResponseAction(input: {
  readonly responseOk: boolean;
  readonly status: number;
  readonly resultReason?: string;
  readonly errorCode?: string;
  readonly retryable?: boolean;
}): CaptureDeliveryResponseAction {
  if (input.responseOk) return "accepted";
  if (input.resultReason === "state-mismatch") return "refresh-authority";
  if (
    input.resultReason === "older-snapshot" ||
    input.errorCode === "stale-snapshot"
  ) {
    return "skip-stale";
  }
  if (input.status === 429) return "throttled";
  if (input.retryable === true || input.status === 401 || input.status >= 500) {
    return "retry";
  }
  return "fatal";
}
