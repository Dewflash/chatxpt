import {
  CONTRACT_VERSION,
  acceptedVoteTallySnapshotSchema,
  candidateBatchSchema,
  commandEnvelopeSchema,
  domainErrorSchema,
  overlayViewModelSchema,
  questCycleStateSchema,
  questEngineEventDraftSchema,
  questEngineEventSchema,
  serviceHealthSchema,
  streamSessionSchema,
  streamerProfileSchema,
  streamerViewModelSchema,
  audienceSnapshotSchema,
  gameplaySnapshotSchema,
  timestampSchema,
  viewerViewModelSchema,
  type CommandEnvelope,
  type ContractEnvelope,
  type DomainError,
  type QuestEngineResult,
  type QuestEngineDecision,
  type RoleViewModels,
  type ViewModelProjectionInput,
  type AcceptedVoteTallySnapshot,
  type VoteCloseValidationContext,
} from "../contracts";
import type { OrchestratorDependencies } from "./ports";
import { canonicalJsonStringify, commandFingerprint } from "./fingerprint";
import type {
  AcceptedCommandReceipt,
  AuthoritativeSessionState,
  OrchestratorResult,
  ProjectionContext,
} from "./types";

function error(code: DomainError["code"], message: string, retryable = false): DomainError {
  return domainErrorSchema.parse({ code, message, retryable });
}

function sameCommand(receipt: AcceptedCommandReceipt, fingerprint: string): boolean {
  return receipt.commandFingerprint === fingerprint;
}

function receiptInvariantError(receipt: AcceptedCommandReceipt): DomainError | null {
  try {
    if (
      !commandEnvelopeSchema.safeParse(receipt.command).success ||
      receipt.commandFingerprint !== commandFingerprint(receipt.command) ||
      !timestampSchema.safeParse(receipt.acceptedAt).success ||
      !Array.isArray(receipt.events) ||
      receipt.events.some((event) => !questEngineEventSchema.safeParse(event).success)
    ) {
      return error("internal", "Stored command receipt is invalid");
    }
    return stateInvariantError(receipt.state);
  } catch {
    return error("internal", "Stored command receipt is invalid");
  }
}

function stateInvariantError(state: AuthoritativeSessionState): DomainError | null {
  if (
    !streamSessionSchema.safeParse(state.session).success ||
    !streamerProfileSchema.safeParse(state.profile).success ||
    !questCycleStateSchema.safeParse(state.questCycle).success ||
    (state.gameplay !== null && !gameplaySnapshotSchema.safeParse(state.gameplay).success) ||
    (state.audience !== null && !audienceSnapshotSchema.safeParse(state.audience).success) ||
    state.services.some((service) => !serviceHealthSchema.safeParse(service).success) ||
    !Number.isSafeInteger(state.communityHype) ||
    state.communityHype < 0
  ) {
    return error("internal", "Stored authoritative session state is invalid");
  }
  if (state.session.sessionId !== state.questCycle.envelope.sessionId) {
    return error("internal", "Stored session and quest-cycle identities disagree");
  }
  if (state.session.revision !== state.questCycle.envelope.revision) {
    return error("internal", "Stored session and quest-cycle revisions disagree");
  }
  if (state.profile.streamerId !== state.session.broadcasterId) {
    return error("internal", "Stored streamer profile does not own the session");
  }
  for (const snapshot of [state.gameplay, state.audience]) {
    if (snapshot !== null && snapshot.envelope.sessionId !== state.session.sessionId) {
      return error("internal", "Stored intelligence belongs to another session");
    }
    if (
      snapshot !== null &&
      snapshot.envelope.evidenceClass !== state.questCycle.envelope.evidenceClass
    ) {
      return error("internal", "Stored intelligence evidence disagrees with session state");
    }
  }
  return null;
}

function authoritativeEnvelope(
  dependencies: OrchestratorDependencies,
  command: CommandEnvelope,
  state: AuthoritativeSessionState,
  questCycleId: string | null,
  revision: number,
  occurredAt: number,
  kind: "quest-state" | "quest-event" | "view-model",
): ContractEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    sessionId: state.session.sessionId,
    questCycleId,
    messageId: dependencies.ids.nextId(kind),
    correlationId: command.correlationId,
    revision,
    occurredAt,
    receivedAt: occurredAt,
    source: "orchestrator",
    evidenceClass: state.questCycle.envelope.evidenceClass,
  };
}

function authoritativeDecision(
  dependencies: OrchestratorDependencies,
  command: CommandEnvelope,
  current: AuthoritativeSessionState,
  decision: QuestEngineDecision,
  acceptedAt: number,
): { state: AuthoritativeSessionState; events: AcceptedCommandReceipt["events"] } | DomainError {
  const parsedDecision = questCycleStateSchema.safeParse(decision.nextState);
  if (!parsedDecision.success) {
    return error("validation", "Quest engine returned an invalid next state");
  }
  if (parsedDecision.data.envelope.sessionId !== current.session.sessionId) {
    return error("validation", "Quest engine cannot move state to another session");
  }
  const parsedEvents = questEngineEventDraftSchema.array().max(128).safeParse(decision.events);
  if (!parsedEvents.success) {
    return error("validation", "Quest engine returned invalid event drafts");
  }

  const revision = current.session.revision + 1;
  const questEnvelope = authoritativeEnvelope(
    dependencies,
    command,
    current,
    parsedDecision.data.envelope.questCycleId,
    revision,
    acceptedAt,
    "quest-state",
  );
  const questCycle = questCycleStateSchema.parse({
    ...parsedDecision.data,
    envelope: questEnvelope,
  });
  const state: AuthoritativeSessionState = {
    ...current,
    session: { ...current.session, revision },
    questCycle,
  };
  const events = [];
  for (const event of parsedEvents.data) {
    const parsedEvent = questEngineEventSchema.safeParse({
      envelope: authoritativeEnvelope(
        dependencies,
        command,
        state,
        questCycle.envelope.questCycleId,
        revision,
        acceptedAt,
        "quest-event",
      ),
      event,
    });
    if (!parsedEvent.success) {
      return error("internal", "Authoritative event stamping produced invalid state", true);
    }
    events.push(parsedEvent.data);
  }
  return { state, events };
}

function projectionInput(
  dependencies: OrchestratorDependencies,
  command: CommandEnvelope,
  state: AuthoritativeSessionState,
  context: ProjectionContext,
  acceptedAt: number,
): ViewModelProjectionInput {
  return {
    envelope: authoritativeEnvelope(
      dependencies,
      command,
      state,
      state.questCycle.envelope.questCycleId,
      state.session.revision,
      acceptedAt,
      "view-model",
    ),
    session: state.session,
    profile: state.profile,
    services: state.services,
    gameplay: state.gameplay,
    audience: state.audience,
    questCycle: state.questCycle,
    participationMode: context.participationMode,
    capabilities: state.session.capabilities,
    viewerId: context.viewerId,
    sessionPoints: context.sessionPoints,
    communityHype: state.communityHype,
    acceptedCandidateId: context.acceptedCandidateId,
    connection: context.connection,
  };
}

function validateViews(views: RoleViewModels, envelope: ContractEnvelope): RoleViewModels | DomainError {
  const parsed = {
    streamer: streamerViewModelSchema.safeParse(views.streamer),
    viewer: viewerViewModelSchema.safeParse(views.viewer),
    overlay: overlayViewModelSchema.safeParse(views.overlay),
  };
  if (!parsed.streamer.success || !parsed.viewer.success || !parsed.overlay.success) {
    return error("internal", "View-model projector returned invalid role state", true);
  }

  for (const view of [parsed.streamer.data, parsed.viewer.data, parsed.overlay.data]) {
    if (
      view.envelope.contractVersion !== envelope.contractVersion ||
      view.envelope.sessionId !== envelope.sessionId ||
      view.envelope.questCycleId !== envelope.questCycleId ||
      view.envelope.messageId !== envelope.messageId ||
      view.envelope.revision !== envelope.revision ||
      view.envelope.correlationId !== envelope.correlationId ||
      view.envelope.occurredAt !== envelope.occurredAt ||
      view.envelope.receivedAt !== envelope.receivedAt ||
      view.envelope.source !== envelope.source ||
      view.envelope.evidenceClass !== envelope.evidenceClass
    ) {
      return error("internal", "Projected view envelope does not match authoritative state", true);
    }
  }
  if (
    canonicalJsonStringify(parsed.streamer.data.session) !==
      canonicalJsonStringify(parsed.viewer.data.session) ||
    canonicalJsonStringify(parsed.streamer.data.session) !==
      canonicalJsonStringify(parsed.overlay.data.session) ||
    canonicalJsonStringify(parsed.streamer.data.questCycle) !==
      canonicalJsonStringify(parsed.viewer.data.questCycle) ||
    canonicalJsonStringify(parsed.streamer.data.questCycle) !==
      canonicalJsonStringify(parsed.overlay.data.questCycle)
  ) {
    return error("internal", "Projected role views disagree on authoritative state", true);
  }

  return {
    streamer: parsed.streamer.data,
    viewer: parsed.viewer.data,
    overlay: parsed.overlay.data,
  };
}

export class ChatXptOrchestrator {
  constructor(private readonly dependencies: OrchestratorDependencies) {}

  async execute(input: unknown): Promise<OrchestratorResult> {
    const parsedCommand = commandEnvelopeSchema.safeParse(input);
    if (!parsedCommand.success) {
      return { ok: false, error: error("validation", "Command does not match the canonical schema") };
    }
    const command = parsedCommand.data;
    const fingerprint = commandFingerprint(command);

    let current: AuthoritativeSessionState | null;
    try {
      current = await this.dependencies.repository.load(command.sessionId);
    } catch {
      return { ok: false, error: error("dependency-unavailable", "Session state is unavailable", true) };
    }
    if (current === null) {
      return { ok: false, error: error("validation", "Session does not exist") };
    }
    let invariantError: DomainError | null;
    try {
      invariantError = stateInvariantError(current);
    } catch {
      return { ok: false, error: error("internal", "Stored authoritative state is unreadable") };
    }
    if (invariantError !== null) {
      return { ok: false, error: invariantError };
    }

    let authorizationError: DomainError | null;
    try {
      authorizationError = await this.dependencies.authorizer.authorize(command, current);
    } catch {
      return { ok: false, error: error("dependency-unavailable", "Command authorization is unavailable", true) };
    }
    if (authorizationError !== null) {
      const parsedError = domainErrorSchema.safeParse(authorizationError);
      return {
        ok: false,
        error: parsedError.success
          ? parsedError.data
          : error("internal", "Command authorizer returned an invalid error"),
      };
    }

    let existing: AcceptedCommandReceipt | null;
    try {
      existing = await this.dependencies.repository.findReceipt(command.commandId);
    } catch {
      return { ok: false, error: error("dependency-unavailable", "Command receipt lookup failed", true) };
    }
    if (existing !== null) {
      const existingError = receiptInvariantError(existing);
      if (existingError !== null) {
        return { ok: false, error: existingError };
      }
      if (!sameCommand(existing, fingerprint)) {
        return { ok: false, error: error("duplicate", "Command ID was already used for different input") };
      }
      return {
        ok: true,
        outcome: "duplicate",
        receipt: existing,
        views: null,
        delivery: "not-republished",
      };
    }

    if (command.expectedRevision !== current.session.revision) {
      return { ok: false, error: error("stale-revision", "Command expected a stale session revision") };
    }

    let candidateBatch = null;
    if (command.type === "system.intelligence-ready") {
      try {
        candidateBatch = await this.dependencies.candidateBatches.read(
          command.candidateBatchId,
          command.sessionId,
        );
      } catch {
        return { ok: false, error: error("dependency-unavailable", "Candidate batch lookup failed", true) };
      }
      if (candidateBatch === null) {
        return { ok: false, error: error("dependency-unavailable", "Candidate batch is unavailable", true) };
      }
      const parsedBatch = candidateBatchSchema.safeParse(candidateBatch);
      if (!parsedBatch.success || parsedBatch.data.envelope.messageId !== command.candidateBatchId) {
        return { ok: false, error: error("validation", "Candidate batch does not match its command") };
      }
      if (
        parsedBatch.data.envelope.sessionId !== command.sessionId ||
        parsedBatch.data.envelope.questCycleId !== command.questCycleId ||
        parsedBatch.data.envelope.revision !== command.expectedRevision ||
        parsedBatch.data.envelope.evidenceClass !== current.questCycle.envelope.evidenceClass
      ) {
        return { ok: false, error: error("validation", "Candidate batch belongs to different state") };
      }
      candidateBatch = parsedBatch.data;
    }

    let acceptedAt: number;
    try {
      acceptedAt = this.dependencies.clock.now();
    } catch {
      return { ok: false, error: error("dependency-unavailable", "Server clock is unavailable", true) };
    }
    if (!timestampSchema.safeParse(acceptedAt).success) {
      return { ok: false, error: error("internal", "Server clock returned an invalid timestamp") };
    }

    let acceptedVoteTally: AcceptedVoteTallySnapshot | null = null;
    let voteCloseValidationContext: VoteCloseValidationContext | null = null;
    if (
      command.type === "system.vote-close" &&
      current.questCycle.status === "voting" &&
      current.questCycle.endsAt !== null &&
      current.questCycle.options.length === 3
    ) {
      const candidateIds = current.questCycle.options.map((candidate) => candidate.candidateId) as [
        string,
        string,
        string,
      ];
      let untrustedTally: unknown;
      try {
        untrustedTally = await this.dependencies.acceptedVotes.readAcceptedVoteTally({
          sessionId: command.sessionId,
          questCycleId: command.questCycleId,
          revision: command.expectedRevision,
          candidateIds,
          acceptedBefore: current.questCycle.endsAt,
          closedAt: acceptedAt,
        });
      } catch {
        return {
          ok: false,
          error: error("dependency-unavailable", "Accepted vote tally is unavailable", true),
        };
      }
      const parsedTally = acceptedVoteTallySnapshotSchema.safeParse(untrustedTally);
      if (
        !parsedTally.success ||
        parsedTally.data.sessionId !== command.sessionId ||
        parsedTally.data.questCycleId !== command.questCycleId ||
        parsedTally.data.revision !== command.expectedRevision ||
        parsedTally.data.closedAt !== acceptedAt ||
        canonicalJsonStringify(parsedTally.data.tallies.map((tally) => tally.candidateId)) !==
          canonicalJsonStringify(candidateIds)
      ) {
        return { ok: false, error: error("validation", "Accepted vote tally does not match the closing cycle") };
      }
      acceptedVoteTally = parsedTally.data;
      voteCloseValidationContext = {
        profile: current.profile,
        session: current.session,
        gameplay: current.gameplay,
        audience: current.audience,
      };
    }
    let untrustedEngineResult: unknown;
    try {
      untrustedEngineResult = await this.dependencies.engine.decide({
        currentState: current.questCycle,
        command,
        candidateBatch,
        acceptedVoteTally,
        voteCloseValidationContext,
        now: acceptedAt,
      });
    } catch {
      return { ok: false, error: error("internal", "Quest engine failed unexpectedly", true) };
    }
    if (
      typeof untrustedEngineResult !== "object" ||
      untrustedEngineResult === null ||
      !("ok" in untrustedEngineResult) ||
      typeof untrustedEngineResult.ok !== "boolean"
    ) {
      return { ok: false, error: error("internal", "Quest engine returned an invalid result") };
    }
    const engineResult = untrustedEngineResult as QuestEngineResult;
    if (!engineResult.ok) {
      const parsedError = domainErrorSchema.safeParse(engineResult.error);
      return {
        ok: false,
        error: parsedError.success
          ? parsedError.data
          : error("internal", "Quest engine returned an invalid error"),
      };
    }

    let authoritative: ReturnType<typeof authoritativeDecision>;
    try {
      authoritative = authoritativeDecision(
        this.dependencies,
        command,
        current,
        engineResult.decision,
        acceptedAt,
      );
    } catch {
      return { ok: false, error: error("internal", "Authoritative state stamping failed", true) };
    }
    if ("code" in authoritative) {
      return { ok: false, error: authoritative };
    }

    let untrustedCommitResult: unknown;
    try {
      untrustedCommitResult = await this.dependencies.repository.commit({
        command,
        commandFingerprint: fingerprint,
        expectedRevision: command.expectedRevision,
        nextState: authoritative.state,
        events: authoritative.events,
        acceptedAt,
      });
    } catch {
      return { ok: false, error: error("dependency-unavailable", "Authoritative commit failed", true) };
    }
    if (
      typeof untrustedCommitResult !== "object" ||
      untrustedCommitResult === null ||
      !("status" in untrustedCommitResult) ||
      !["committed", "duplicate", "stale", "participation-conflict"].includes(
        String(untrustedCommitResult.status),
      )
    ) {
      return { ok: false, error: error("internal", "State repository returned an invalid commit result") };
    }
    const commitResult = untrustedCommitResult as Awaited<
      ReturnType<OrchestratorDependencies["repository"]["commit"]>
    >;
    if (commitResult.status === "stale") {
      return { ok: false, error: error("stale-revision", "A concurrent command changed the session") };
    }
    if (commitResult.status === "participation-conflict") {
      return { ok: false, error: error("duplicate", "This viewer already has an accepted vote in the cycle") };
    }
    if (commitResult.status === "duplicate") {
      const duplicateError = receiptInvariantError(commitResult.receipt);
      if (duplicateError !== null) {
        return { ok: false, error: duplicateError };
      }
      if (!sameCommand(commitResult.receipt, fingerprint)) {
        return { ok: false, error: error("duplicate", "Command ID was concurrently reused") };
      }
      return {
        ok: true,
        outcome: "duplicate",
        receipt: commitResult.receipt,
        views: null,
        delivery: "not-republished",
      };
    }

    const receipt = commitResult.receipt;
    const committedReceiptError = receiptInvariantError(receipt);
    if (committedReceiptError !== null) {
      return { ok: false, error: committedReceiptError };
    }
    let views: RoleViewModels;
    try {
      const context = await this.dependencies.projectionContext.resolve(receipt.state, command);
      const inputForProjection = projectionInput(
        this.dependencies,
        command,
        receipt.state,
        context,
        acceptedAt,
      );
      const projected = await this.dependencies.projector.project(inputForProjection);
      const validated = validateViews(projected, inputForProjection.envelope);
      if ("code" in validated) {
        return {
          ok: true,
          outcome: "committed",
          receipt,
          views: null,
          delivery: "pending-recovery",
          deliveryError: validated,
        };
      }
      views = validated;
    } catch {
      return {
        ok: true,
        outcome: "committed",
        receipt,
        views: null,
        delivery: "pending-recovery",
        deliveryError: error("internal", "Committed state could not be projected", true),
      };
    }

    try {
      await this.dependencies.publisher.publish(views);
    } catch {
      return {
        ok: true,
        outcome: "committed",
        receipt,
        views,
        delivery: "pending-recovery",
        deliveryError: error("dependency-unavailable", "Committed state could not be broadcast", true),
      };
    }

    return { ok: true, outcome: "committed", receipt, views, delivery: "published" };
  }
}
