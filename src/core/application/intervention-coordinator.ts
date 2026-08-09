import {
  CONTRACT_VERSION,
  candidateBatchSchema,
  contractEnvelopeSchema,
  domainErrorSchema,
  intelligenceSnapshotSchema,
  systemIntelligenceCommandSchema,
  type CandidateBatch,
  type CandidateInput,
  type CandidateProvider,
  type ContractEnvelope,
  type DomainError,
  type IntelligenceSnapshot,
  type RecentQuestSummary,
} from "../contracts";
import type { AuthoritativeSessionState, OrchestratorResult } from "./types";

export interface InterventionPolicyInput {
  readonly currentState: AuthoritativeSessionState["questCycle"];
  readonly intelligence: IntelligenceSnapshot;
  readonly profile: AuthoritativeSessionState["profile"];
  readonly emergencyPaused: boolean;
  readonly recentQuests: readonly RecentQuestSummary[];
  readonly now: number;
}

export interface InterventionDecision {
  readonly shouldPropose: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly evidenceSignalIds: readonly string[];
}

export interface InterventionPolicy {
  decide(input: InterventionPolicyInput): Promise<InterventionDecision> | InterventionDecision;
}

export interface CandidateBatchWriter {
  store(batch: CandidateBatch): Promise<void>;
}

export interface IntelligenceReadyExecutor {
  execute(input: unknown): Promise<OrchestratorResult>;
}

export interface InterventionCoordinatorInput {
  readonly state: AuthoritativeSessionState;
  readonly intelligence: IntelligenceSnapshot;
  readonly recentQuests: readonly RecentQuestSummary[];
  readonly candidateInputEnvelope: ContractEnvelope;
  readonly commandId: string;
  readonly correlationId: string;
  readonly systemActorId: string;
  readonly issuedAt: number;
  readonly signal?: AbortSignal;
}

export type InterventionCoordinatorResult =
  | {
      readonly ok: true;
      readonly outcome: "denied";
      readonly decision: InterventionDecision;
      readonly orchestrator: null;
      readonly candidateBatch: null;
    }
  | {
      readonly ok: true;
      readonly outcome: "submitted";
      readonly decision: InterventionDecision;
      readonly orchestrator: OrchestratorResult;
      readonly candidateBatch: CandidateBatch;
    }
  | { readonly ok: false; readonly error: DomainError };

function failure(code: DomainError["code"], message: string, retryable = false): InterventionCoordinatorResult {
  return { ok: false, error: domainErrorSchema.parse({ code, message, retryable }) };
}

export class Role1InterventionCoordinator {
  constructor(
    private readonly policy: InterventionPolicy,
    private readonly candidates: CandidateProvider,
    private readonly candidateBatches: CandidateBatchWriter,
    private readonly executor: IntelligenceReadyExecutor,
    private readonly now: () => number = Date.now,
  ) {}

  async run(input: InterventionCoordinatorInput): Promise<InterventionCoordinatorResult> {
    const intelligence = intelligenceSnapshotSchema.safeParse(input.intelligence);
    const envelope = contractEnvelopeSchema.safeParse(input.candidateInputEnvelope);
    if (!intelligence.success || !envelope.success) {
      return failure("validation", "Intervention input is not canonical");
    }
    if (
      intelligence.data.envelope.sessionId !== input.state.session.sessionId ||
      intelligence.data.envelope.questCycleId !== input.state.questCycle.envelope.questCycleId ||
      intelligence.data.envelope.revision !== input.state.session.revision ||
      envelope.data.sessionId !== input.state.session.sessionId ||
      envelope.data.questCycleId !== input.state.questCycle.envelope.questCycleId ||
      envelope.data.revision !== input.state.session.revision
    ) {
      return failure("validation", "Intervention input belongs to different authoritative state");
    }

    const now = this.now();
    const decision = await this.policy.decide({
      currentState: input.state.questCycle,
      intelligence: intelligence.data,
      profile: input.state.profile,
      emergencyPaused: input.state.emergencyPaused,
      recentQuests: input.recentQuests,
      now,
    });
    if (!decision.shouldPropose) {
      return {
        ok: true,
        outcome: "denied",
        decision,
        orchestrator: null,
        candidateBatch: null,
      };
    }

    let batch: CandidateBatch;
    try {
      const candidateInput: CandidateInput = {
        envelope: envelope.data,
        intelligence: intelligence.data,
        profile: input.state.profile,
        recentQuestTitles: input.recentQuests.map((quest) => quest.title),
      };
      batch = candidateBatchSchema.parse(await this.candidates.generate(candidateInput, input.signal));
      if (
        batch.envelope.sessionId !== input.state.session.sessionId ||
        batch.envelope.questCycleId !== input.state.questCycle.envelope.questCycleId ||
        batch.envelope.revision !== input.state.session.revision ||
        batch.envelope.evidenceClass !== input.state.questCycle.envelope.evidenceClass
      ) {
        return failure("validation", "Generated candidate batch does not match authoritative state");
      }
      await this.candidateBatches.store(batch);
    } catch {
      return failure("dependency-unavailable", "Candidate generation or storage failed", true);
    }

    const command = systemIntelligenceCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: input.state.session.sessionId,
      questCycleId: input.state.questCycle.envelope.questCycleId,
      commandId: input.commandId,
      correlationId: input.correlationId,
      expectedRevision: input.state.session.revision,
      issuedAt: input.issuedAt,
      actor: { kind: "system", actorId: input.systemActorId },
      type: "system.intelligence-ready",
      candidateBatchId: batch.envelope.messageId,
    });

    return {
      ok: true,
      outcome: "submitted",
      decision,
      candidateBatch: batch,
      orchestrator: await this.executor.execute(command),
    };
  }
}
