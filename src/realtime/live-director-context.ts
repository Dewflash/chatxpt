import {
  audiencePointerAggregateSchema,
  canonicalJsonStringify,
  type AudiencePointerAggregate,
} from "../core";
import { PersistenceConflictError, type AudiencePointerAggregateRepository } from "./types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Ephemeral handoff from the audience-analysis producer to the sole
 * orchestrator. Only the composed AudiencePointer is committed afterward.
 */
export class EphemeralAudiencePointerAggregateRepository
  implements AudiencePointerAggregateRepository
{
  private readonly aggregates = new Map<string, AudiencePointerAggregate>();

  async store(input: AudiencePointerAggregate): Promise<void> {
    const aggregate = audiencePointerAggregateSchema.parse(input);
    const existing = this.aggregates.get(aggregate.pointerId);
    if (existing !== undefined) {
      if (canonicalJsonStringify(existing) === canonicalJsonStringify(aggregate)) return;
      throw new PersistenceConflictError("unknown", "Audience pointer aggregate ID was reused");
    }
    this.aggregates.set(aggregate.pointerId, clone(aggregate));
  }

  async read(pointerId: string, sessionId: string): Promise<AudiencePointerAggregate | null> {
    const aggregate = this.aggregates.get(pointerId);
    if (aggregate === undefined || aggregate.envelope.sessionId !== sessionId) return null;
    return clone(aggregate);
  }
}
