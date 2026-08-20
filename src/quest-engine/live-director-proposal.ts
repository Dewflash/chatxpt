import {
  CONTRACT_VERSION,
  audienceSnapshotSchema,
  candidateBatchSchema,
  contractEnvelopeSchema,
  domainErrorSchema,
  gameplaySnapshotSchema,
  intelligenceSnapshotSchema,
  systemIntelligenceCommandSchema,
  type CandidateProvider,
  type DirectorCueProposalCoordinator,
  type DirectorCueProposalInput,
  type DirectorCueProposalResult,
  type DomainError,
} from "../core";
import { DefaultDirectorCueConverter } from "./director-cue-conversion";

function failure(
  code: DomainError["code"],
  message: string,
  retryable = false,
): DirectorCueProposalResult {
  return { ok: false, error: domainErrorSchema.parse({ code, message, retryable }) };
}

function inputEnvelope(input: DirectorCueProposalInput) {
  return contractEnvelopeSchema.parse({
    contractVersion: CONTRACT_VERSION,
    sessionId: input.current.session.sessionId,
    questCycleId: input.current.questCycle.envelope.questCycleId,
    messageId: input.command.commandId,
    correlationId: input.command.correlationId,
    revision: input.current.session.revision,
    occurredAt: input.now,
    receivedAt: input.now,
    source: "orchestrator",
    evidenceClass: input.current.questCycle.envelope.evidenceClass,
  });
}

function activeQuestSummary(input: DirectorCueProposalInput): string | null {
  const { questCycle } = input.current;
  if (questCycle.activeCandidateId === null) return null;
  const active = questCycle.options.find(
    ({ candidateId }) => candidateId === questCycle.activeCandidateId,
  );
  return active === undefined ? null : `${active.title}: ${active.instruction}`.trim().slice(0, 240);
}

/**
 * Work-conserving R3-014 adapter. It invokes Role 2 generation when canonical
 * gameplay is available, treats provider failure as normal fallback input,
 * and delegates every proposal decision to Role 3's deterministic converter.
 * It does not persist or publish anything.
 */
export class DefaultLiveDirectorProposalCoordinator
  implements DirectorCueProposalCoordinator
{
  constructor(
    private readonly candidates: CandidateProvider,
    private readonly converter = new DefaultDirectorCueConverter(),
  ) {}

  async propose(input: DirectorCueProposalInput): Promise<DirectorCueProposalResult> {
    if (input.command.action !== "turn-into-vote") {
      return failure("validation", "Only Turn into vote may request a Director Cue proposal");
    }
    if (input.current.gameplay === null) {
      return failure(
        "dependency-unavailable",
        "Current gameplay evidence is unavailable; no quest proposal was published",
        true,
      );
    }

    const envelope = inputEnvelope(input);
    const gameplay = gameplaySnapshotSchema.safeParse({
      ...input.current.gameplay,
      envelope: {
        ...input.current.gameplay.envelope,
        sessionId: envelope.sessionId,
        questCycleId: envelope.questCycleId,
        revision: envelope.revision,
        evidenceClass: envelope.evidenceClass,
      },
    });
    const audience = audienceSnapshotSchema.safeParse(
      input.current.audience === null
        ? {
            envelope: {
              ...envelope,
              messageId: input.command.commandId,
            },
            sampleSize: 0,
            signals: [],
          }
        : {
            ...input.current.audience,
            envelope: {
              ...input.current.audience.envelope,
              sessionId: envelope.sessionId,
              questCycleId: envelope.questCycleId,
              revision: envelope.revision,
              evidenceClass: envelope.evidenceClass,
            },
          },
    );
    if (!gameplay.success || !audience.success) {
      return failure("validation", "Current intelligence could not be normalised for proposal");
    }
    const intelligence = intelligenceSnapshotSchema.safeParse({
      envelope,
      gameplay: gameplay.data,
      audience: audience.data,
    });
    if (!intelligence.success) {
      return failure("validation", "Current intelligence does not match proposal authority");
    }

    let generatedCandidates: readonly unknown[] | null = null;
    try {
      const generated = candidateBatchSchema.safeParse(
        await this.candidates.generate({
          envelope,
          intelligence: intelligence.data,
          profile: input.current.profile,
          recentQuestTitles: (input.current.recentQuests ?? []).map(({ title }) => title),
          activeChatXptQuest: activeQuestSummary(input),
        }),
      );
      if (
        generated.success &&
        generated.data.envelope.sessionId === envelope.sessionId &&
        generated.data.envelope.questCycleId === envelope.questCycleId &&
        generated.data.envelope.revision === envelope.revision &&
        generated.data.envelope.evidenceClass === envelope.evidenceClass
      ) {
        generatedCandidates = generated.data.candidates;
      }
    } catch {
      // Provider refusal, timeout, malformed output, or outage deliberately
      // becomes null input so Role 3 can apply the credential-free fallback.
    }

    const systemCommand = systemIntelligenceCommandSchema.parse({
      contractVersion: CONTRACT_VERSION,
      sessionId: input.current.session.sessionId,
      questCycleId: input.current.questCycle.envelope.questCycleId,
      commandId: input.command.commandId,
      correlationId: input.command.correlationId,
      expectedRevision: input.current.session.revision,
      issuedAt: input.now,
      actor: { kind: "system", actorId: "chatxpt-live-director" },
      type: "system.intelligence-ready",
      candidateBatchId: envelope.messageId,
    });
    const converted = this.converter.convert({
      envelope,
      candidates: generatedCandidates,
      intelligence: intelligence.data,
      profile: input.current.profile,
      currentState: input.current.questCycle,
      recentQuests: input.current.recentQuests ?? [],
      now: input.now,
      seed: input.command.commandId,
      liveDirector: input.liveDirector,
      command: systemCommand,
      emergencyPaused: input.current.emergencyPaused,
      sessionEnded: input.current.session.status === "ended" || input.current.session.status === "offline",
      questImpossible: input.current.questCycle.status !== "idle",
    });
    if (!converted.ok) {
      return failure(
        converted.error?.code ??
          (converted.code === "fallback-exhausted" ? "dependency-unavailable" : "validation"),
        `${converted.reason} No quest proposal was published.`,
        converted.code === "fallback-exhausted",
      );
    }
    return { ok: true, decision: converted.decision };
  }
}
