/** Role 1 public boundary for authoritative commands, snapshots, and realtime health. */
export {
  ChatXptOrchestrator,
  commandEnvelopeSchema,
  domainErrorSchema,
  overlayViewModelSchema,
  serviceHealthSchema,
  streamerViewModelSchema,
  viewerViewModelSchema,
} from "../core";
export type {
  AcceptedCommandReceipt,
  AuthoritativeSessionState,
  CommandAuthorizer,
  CommandEnvelope,
  CommitAuthoritativeStateInput,
  DomainError,
  MessageIdFactory,
  OverlayViewModel,
  OrchestratorDependencies,
  OrchestratorResult,
  ProjectionContextResolver,
  ServiceHealth,
  ServerClock,
  SessionStateRepository,
  StatePublisher,
  StreamerViewModel,
  ViewerViewModel,
} from "../core";
