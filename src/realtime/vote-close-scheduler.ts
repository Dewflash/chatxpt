import "server-only";

import {
  CONTRACT_VERSION,
  domainErrorSchema,
  systemVoteCloseCommandSchema,
  timestampSchema,
  type DomainError,
  type OrchestratorResult,
  type ServerClock,
  type SystemVoteCloseCommand,
} from "../core";
import type { DueVoteCycleReader } from "./types";

export const SYSTEM_VOTE_CLOSE_ACTOR_ID = "chatxpt-vote-close-scheduler";

export interface AuthoritativeCommandExecutor {
  execute(input: unknown): Promise<OrchestratorResult>;
}

export interface VoteCloseCommandIdentityInput {
  readonly sessionId: string;
  readonly questCycleId: string;
  readonly votingEndsAt: number;
}

export interface VoteCloseCommandIdFactory {
  forCycle(input: VoteCloseCommandIdentityInput): Promise<string> | string;
}

export interface VoteCloseAttempt {
  readonly sessionId: string;
  readonly questCycleId: string | null;
  readonly commandId: string | null;
  readonly result: OrchestratorResult;
}

export type VoteCloseSweepResult =
  | { readonly ok: true; readonly attempts: readonly VoteCloseAttempt[] }
  | { readonly ok: false; readonly error: DomainError };

function failure(
  code: DomainError["code"],
  message: string,
  retryable = false,
): Extract<OrchestratorResult, { readonly ok: false }> {
  return { ok: false, error: domainErrorSchema.parse({ code, message, retryable }) };
}

export class Sha256VoteCloseCommandIds implements VoteCloseCommandIdFactory {
  async forCycle(input: VoteCloseCommandIdentityInput): Promise<string> {
    const bytes = new TextEncoder().encode(
      JSON.stringify([input.sessionId, input.questCycleId, input.votingEndsAt]),
    );
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
    return `vote-close-${hex}`;
  }
}

export class VoteCloseScheduler {
  constructor(
    private readonly dueVotes: DueVoteCycleReader,
    private readonly executor: AuthoritativeCommandExecutor,
    private readonly clock: ServerClock = { now: Date.now },
    private readonly commandIds: VoteCloseCommandIdFactory = new Sha256VoteCloseCommandIds(),
  ) {}

  async closeDue(): Promise<VoteCloseSweepResult> {
    let at: number;
    try {
      at = this.clock.now();
    } catch {
      return {
        ok: false,
        error: failure("dependency-unavailable", "Vote-close server clock is unavailable", true).error,
      };
    }
    if (!timestampSchema.safeParse(at).success) {
      return { ok: false, error: failure("validation", "Vote-close sweep time is invalid").error };
    }

    let due;
    try {
      due = await this.dueVotes.dueVoteCycles(at);
    } catch {
      return {
        ok: false,
        error: failure("dependency-unavailable", "Due vote-cycle lookup failed", true).error,
      };
    }

    const attempts: VoteCloseAttempt[] = [];
    for (const state of due) {
      const questCycleId = state.questCycle.envelope.questCycleId;
      const votingEndsAt = state.questCycle.endsAt;
      if (
        state.session.status !== "live" ||
        state.questCycle.status !== "voting" ||
        questCycleId === null ||
        votingEndsAt === null ||
        votingEndsAt > at
      ) {
        attempts.push({
          sessionId: state.session.sessionId,
          questCycleId,
          commandId: null,
          result: failure("validation", "Due vote-cycle reader returned a non-due state"),
        });
        continue;
      }

      let commandId: string;
      let command: SystemVoteCloseCommand;
      try {
        commandId = await this.commandIds.forCycle({
          sessionId: state.session.sessionId,
          questCycleId,
          votingEndsAt,
        });
        command = systemVoteCloseCommandSchema.parse({
          contractVersion: CONTRACT_VERSION,
          sessionId: state.session.sessionId,
          questCycleId,
          commandId,
          correlationId: commandId,
          expectedRevision: state.session.revision,
          issuedAt: votingEndsAt,
          actor: { kind: "system", actorId: SYSTEM_VOTE_CLOSE_ACTOR_ID },
          type: "system.vote-close",
        });
      } catch {
        attempts.push({
          sessionId: state.session.sessionId,
          questCycleId,
          commandId: null,
          result: failure("internal", "Vote-close command identity could not be created", true),
        });
        continue;
      }

      let result: OrchestratorResult;
      try {
        result = await this.executor.execute(command);
      } catch {
        result = failure("dependency-unavailable", "Vote-close command execution failed", true);
      }
      attempts.push({
        sessionId: state.session.sessionId,
        questCycleId,
        commandId,
        result,
      });
    }
    return { ok: true, attempts };
  }
}
