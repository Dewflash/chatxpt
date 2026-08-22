export interface LatestOnlyDeliveryOptions<T> {
  readonly deliver: (value: T) => Promise<void>;
  readonly onError?: (error: unknown) => "continue" | "stop";
}

/**
 * Keeps capture/analysis producers independent from a slower network consumer.
 * At most one delivery runs at a time and, while it runs, only the newest
 * pending value is retained. This prevents stale frame snapshots from forming
 * an unbounded queue without slowing local frame analysis to server latency.
 */
export class LatestOnlyDelivery<T> {
  private pending: T | null = null;
  private draining: Promise<void> | null = null;
  private stopped = false;
  private idleWaiters: Array<() => void> = [];

  constructor(private readonly options: LatestOnlyDeliveryOptions<T>) {}

  push(value: T): boolean {
    if (this.stopped) return false;
    this.pending = value;
    this.scheduleDrain();
    return true;
  }

  stop(): void {
    this.stopped = true;
    this.pending = null;
    if (this.draining === null) this.resolveIdleWaiters();
  }

  async whenIdle(): Promise<void> {
    if (this.draining === null && this.pending === null) return;
    await new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private async drain(): Promise<void> {
    while (!this.stopped && this.pending !== null) {
      const value = this.pending;
      this.pending = null;
      try {
        await this.options.deliver(value);
      } catch (error) {
        if (this.options.onError?.(error) === "stop") {
          this.stop();
        }
      }
    }
  }

  private scheduleDrain(): void {
    if (this.draining !== null || this.stopped || this.pending === null) return;
    const task = this.drain();
    this.draining = task;
    void task.finally(() => {
      if (this.draining !== task) return;
      this.draining = null;
      this.scheduleDrain();
      this.resolveIdleWaiters();
    });
  }

  private resolveIdleWaiters(): void {
    if (this.draining !== null || this.pending !== null) return;
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
}
