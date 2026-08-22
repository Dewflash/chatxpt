import { describe, expect, it } from "vitest";

import {
  CAPTURE_DELIVERY_STALE_AFTER_MS,
  captureDeliveryResponseAction,
  captureSnapshotIsStale,
} from "./capture-delivery-policy";

describe("gameplay capture delivery policy", () => {
  it("drops a background-throttled frame without disconnecting capture", () => {
    const now = 1_800_000_020_000;

    expect(captureSnapshotIsStale(now - CAPTURE_DELIVERY_STALE_AFTER_MS, now)).toBe(false);
    expect(captureSnapshotIsStale(now - CAPTURE_DELIVERY_STALE_AFTER_MS - 1, now)).toBe(true);
    expect(captureDeliveryResponseAction({
      responseOk: false,
      status: 409,
      errorCode: "stale-snapshot",
      retryable: true,
    })).toBe("skip-stale");
  });

  it("recovers revision races, out-of-order frames, throttling, and temporary failures", () => {
    expect(captureDeliveryResponseAction({
      responseOk: false,
      status: 409,
      resultReason: "state-mismatch",
    })).toBe("refresh-authority");
    expect(captureDeliveryResponseAction({
      responseOk: false,
      status: 409,
      resultReason: "older-snapshot",
    })).toBe("skip-stale");
    expect(captureDeliveryResponseAction({ responseOk: false, status: 429 })).toBe("throttled");
    expect(captureDeliveryResponseAction({ responseOk: false, status: 503 })).toBe("retry");
    expect(captureDeliveryResponseAction({ responseOk: false, status: 401 })).toBe("retry");
  });

  it("still stops for permanent authorization or invalid-payload failures", () => {
    expect(captureDeliveryResponseAction({ responseOk: false, status: 403 })).toBe("fatal");
    expect(captureDeliveryResponseAction({ responseOk: false, status: 400 })).toBe("fatal");
    expect(captureDeliveryResponseAction({ responseOk: true, status: 202 })).toBe("accepted");
  });
});
