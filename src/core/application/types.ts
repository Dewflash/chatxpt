import type {
  AudienceSnapshot,
  CommandEnvelope,
  DomainError,
  GameplaySnapshot,
  LiveDirectorState,
  QuestCycleState,
  RecentQuestSummary,
  QuestEngineEvent,
  RoleViewModels,
  ServiceHealth,
  StreamSession,
  StreamerProfile,
} from "../contracts";

export interface AuthoritativeSessionState {
  readonly session: StreamSession;
  readonly profile: StreamerProfile;
  readonly services: readonly ServiceHealth[];
  readonly gameplay: GameplaySnapshot | null;
  readonly audience: AudienceSnapshot | null;
  readonly questCycle: QuestCycleState;
  readonly emergencyPaused: boolean;
  readonly communityHype: number;
  readonly recentQuests?: readonly RecentQuestSummary[];
  readonly liveDirector?: LiveDirectorState | null;
}

export interface ProjectionContext {
  readonly participationMode: "twitch-extension" | "hosted-board" | "twitch-chat" | "unavailable";
  readonly viewerId: string | null;
  readonly sessionPoints: number;
  readonly acceptedCandidateId: string | null;
  readonly connection: ServiceHealth;
}

export interface ViewerRecoveryState {
  readonly sessionId: string;
  readonly questCycleId: string;
  readonly acceptedCandidateId: string | null;
  readonly acceptedAt: number | null;
  readonly sessionPoints: number;
  readonly sourceMode: "twitch-extension" | "hosted-board" | "twitch-chat" | null;
}

export interface AcceptedCommandReceipt {
  readonly command: CommandEnvelope;
  readonly commandFingerprint: string;
  readonly state: AuthoritativeSessionState;
  readonly events: readonly QuestEngineEvent[];
  readonly acceptedAt: number;
}

export type CommitAuthoritativeStateResult =
  | { readonly status: "committed"; readonly receipt: AcceptedCommandReceipt }
  | { readonly status: "duplicate"; readonly receipt: AcceptedCommandReceipt }
  | { readonly status: "stale"; readonly currentRevision: number }
  | { readonly status: "participation-conflict"; readonly reason: "vote-already-accepted" };

export type OrchestratorDelivery = "published" | "pending-recovery" | "not-republished";

export interface AcceptedOrchestratorResult {
  readonly ok: true;
  readonly outcome: "committed" | "duplicate";
  readonly receipt: AcceptedCommandReceipt;
  readonly views: RoleViewModels | null;
  readonly delivery: OrchestratorDelivery;
  readonly deliveryError?: DomainError;
}

export interface RejectedOrchestratorResult {
  readonly ok: false;
  readonly error: DomainError;
}

export type OrchestratorResult = AcceptedOrchestratorResult | RejectedOrchestratorResult;
