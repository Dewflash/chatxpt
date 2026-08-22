import { describe, expect, it } from "vitest";

import { LatestOnlyDelivery } from "./latest-only-delivery";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("LatestOnlyDelivery", () => {
  it("does not block a producer and replaces stale pending values", async () => {
    const firstDelivery = deferred();
    const delivered: number[] = [];
    const delivery = new LatestOnlyDelivery<number>({
      deliver: async (value) => {
        delivered.push(value);
        if (value === 1) await firstDelivery.promise;
      },
    });

    expect(delivery.push(1)).toBe(true);
    delivery.push(2);
    delivery.push(3);
    delivery.push(4);
    expect(delivered).toEqual([1]);

    firstDelivery.resolve();
    await delivery.whenIdle();

    expect(delivered).toEqual([1, 4]);
  });

  it("continues with the newest pending value after a recoverable error", async () => {
    const firstDelivery = deferred();
    const delivered: number[] = [];
    const errors: unknown[] = [];
    const delivery = new LatestOnlyDelivery<number>({
      deliver: async (value) => {
        delivered.push(value);
        if (value === 1) {
          await firstDelivery.promise;
          throw new Error("temporary");
        }
      },
      onError: (error) => {
        errors.push(error);
        return "continue";
      },
    });

    delivery.push(1);
    delivery.push(2);
    delivery.push(3);
    firstDelivery.resolve();
    await delivery.whenIdle();

    expect(delivered).toEqual([1, 3]);
    expect(errors).toHaveLength(1);
  });

  it("drops pending values and rejects new work after stop", async () => {
    const firstDelivery = deferred();
    const delivered: number[] = [];
    const delivery = new LatestOnlyDelivery<number>({
      deliver: async (value) => {
        delivered.push(value);
        await firstDelivery.promise;
      },
    });

    delivery.push(1);
    delivery.push(2);
    delivery.stop();
    expect(delivery.push(3)).toBe(false);
    firstDelivery.resolve();
    await delivery.whenIdle();

    expect(delivered).toEqual([1]);
  });
});
