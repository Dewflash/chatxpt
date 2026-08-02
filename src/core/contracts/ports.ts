import type { CommandEnvelope } from "./commands";
import type { ContractEnvelope, DomainError, ServiceHealth } from "./common";
import type { ParticipationCapabilities, StreamSession } from "./session";
import type { StreamerProfile } from "./profile";
import type { CandidateBatch, QuestCycleState, QuestEngineEventDraft } from "./quests";
import type {
  AudienceEvent,
  AudienceSnapshot,
  GameplayFrameObservation,
  GameplaySnapshot,
  IntelligenceSnapshot,
} from "./signals";
import type { OverlayViewModel, StreamerViewModel, ViewerViewModel } from "./views";

export interface EphemeralGameplayFrame {
  readonly observation: GameplayFrameObservation;
  readonly image: CanvasImageSource;
  release(): void;
}

export interface FrameSource {
  frames(signal?: AbortSignal): AsyncIterable<EphemeralGameplayFrame>;
}

export interface AudienceEventSource {
  events(signal?: AbortSignal): AsyncIterable<AudienceEvent>;
}

export interface StreamerProfileReader {
  read(streamerId: string): Promise<StreamerProfile | null>;
}

export interface IntelligenceInput {
  readonly envelope: ContractEnvelope;
  readonly gameplay: GameplaySnapshot;
  readonly audience: AudienceSnapshot;
  readonly profile: StreamerProfile;
}

export interface IntelligenceProvider {
  analyse(input: IntelligenceInput, signal?: AbortSignal): Promise<IntelligenceSnapshot>;
}

export interface CandidateInput {
  readonly envelope: ContractEnvelope;
  readonly intelligence: IntelligenceSnapshot;
  readonly profile: StreamerProfile;
  readonly recentQuestTitles: readonly string[];
}

export interface CandidateProvider {
  generate(input: CandidateInput, signal?: AbortSignal): Promise<CandidateBatch>;
}

export interface QuestEngineInput {
  readonly currentState: QuestCycleState;
  readonly command: CommandEnvelope;
  readonly candidateBatch: CandidateBatch | null;
  readonly now: number;
}

export interface QuestEngineDecision {
  readonly nextState: QuestCycleState;
  readonly events: readonly QuestEngineEventDraft[];
}

export type QuestEngineResult =
  | { readonly ok: true; readonly decision: QuestEngineDecision }
  | { readonly ok: false; readonly error: DomainError };

export interface QuestEngine {
  decide(input: QuestEngineInput): Promise<QuestEngineResult> | QuestEngineResult;
}

export interface RoleViewModels {
  readonly streamer: StreamerViewModel;
  readonly viewer: ViewerViewModel;
  readonly overlay: OverlayViewModel;
}

export interface ViewModelProjectionInput {
  readonly envelope: ContractEnvelope;
  readonly session: StreamSession;
  readonly profile: StreamerProfile;
  readonly services: readonly ServiceHealth[];
  readonly gameplay: GameplaySnapshot | null;
  readonly audience: AudienceSnapshot | null;
  readonly questCycle: QuestCycleState;
  readonly participationMode: "twitch-extension" | "hosted-board" | "twitch-chat" | "unavailable";
  readonly capabilities: ParticipationCapabilities;
  readonly viewerId: string | null;
  readonly sessionPoints: number;
  readonly communityHype: number;
  readonly acceptedCandidateId: string | null;
  readonly connection: ServiceHealth;
}

export interface ViewModelProjector {
  project(input: ViewModelProjectionInput): Promise<RoleViewModels> | RoleViewModels;
}
