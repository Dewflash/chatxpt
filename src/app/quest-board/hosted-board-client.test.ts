import { describe, expect, it } from "vitest";

import { HOSTED_BOARD_RECOVERY_POLL_INTERVAL_MS } from "./[roomCode]/hosted-board-client";

describe("Hosted Board client recovery cadence", () => {
  it("refreshes within the short winner and next-cycle transition windows", () => {
    expect(HOSTED_BOARD_RECOVERY_POLL_INTERVAL_MS).toBe(1_500);
    expect(HOSTED_BOARD_RECOVERY_POLL_INTERVAL_MS).toBeLessThan(5_000);
  });
});
