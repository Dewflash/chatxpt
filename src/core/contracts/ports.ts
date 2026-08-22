import type { CommandEnvelope } from "./commands";
import type { AcceptedVoteTallySnapshot } from "./participation";
import type { ContractEnvelope, DomainError, ServiceHealth } from "./common";
import type { ParticipationCapabilities, StreamSession } from "./session";
import type { StreamerProfile, StreamerSessionOverride } from "./profile";
import type {
  CandidateBatch,
  QuestCompletionRule,
  QuestCycleState,
  QuestEngineEventDraft,
} from "./quests";
import type {
  AudienceEvent,
  AudienceSnapshot,
  GameplayFrameObservation,
  GameplaySnapshot,
  IntelligenceSnapshot,
  LiveDirectorState,
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
  readonly streamerGoal: string | null;
  readonly activeChatXptQuest: string | null;
}

export interface CandidateProvider {
  generate(input: CandidateInput, signal?: AbortSignal): Promise<CandidateBatch>;
}

export interface QuestEngineInput {
  readonly currentState: QuestCycleState;
  readonly command: CommandEnvelope;
  readonly candidateBatch: CandidateBatch | null;
  /** Effective saved broadcaster profile used only for lifecycle preferences. */
  readonly profile?: StreamerProfile | null;
  /** Present only for a valid system.vote-close boundary; it never prescribes a winner. */
  readonly acceptedVoteTally?: AcceptedVoteTallySnapshot | null;
  /**
   * Present only for a valid system.vote-close boundary. This is the neutral
   * current context Role 3 may use to revalidate close-time safety and
   * feasibility; it never contains Twitch, provider, UI, or persistence payloads.
   */
  readonly voteCloseValidationContext?: VoteCloseValidationContext | null;
  /**
   * Present only for quest progress commands. It supplies neutral current
   * evidence and the active quest's completion rule; commands still cannot
   * prescribe success, failure, rewards, or lifecycle state.
   */
  readonly questProgressValidationContext?: QuestProgressValidationContext | null;
  readonly now: number;
}

export interface VoteCloseValidationContext {
  readonly profile: StreamerProfile;
  readonly session: StreamSession;
  readonly gameplay: GameplaySnapshot | null;
  readonly audience: AudienceSnapshot | null;
  readonly recentQuests: readonly RecentQuestSummary[];
}

export interface RecentQuestSummary {
  readonly title: string;
  readonly occurredAt: number;
}

export interface QuestProgressValidationContext {
  readonly profile: StreamerProfile;
  readonly session: StreamSession;
  readonly gameplay: GameplaySnapshot | null;
  readonly audience: AudienceSnapshot | null;
  readonly completionRule: QuestCompletionRule | null;
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

export interface DirectorCueConversionInput {
  readonly envelope: ContractEnvelope;
  readonly candidates: readonly unknown[] | null;
  readonly intelligence: IntelligenceSnapshot;
  readonly profile: StreamerProfile;
  readonly currentState: QuestCycleState;
  readonly recentQuests: readonly RecentQuestSummary[];
  readonly now: number;
  readonly seed: string;
  readonly liveDirector: LiveDirectorState;
  readonly command: Extract<CommandEnvelope, { readonly type: "system.intelligence-ready" }>;
  readonly emergencyPaused: boolean;
  readonly sessionEnded: boolean;
  readonly questImpossible: boolean;
}

export type DirectorCueConversionResult =
  | {
      readonly ok: true;
      readonly cueId: string;
      readonly batch: CandidateBatch;
      readonly decision: QuestEngineDecision;
      readonly readyForStreamerApproval: true;
    }
  | {
      readonly ok: false;
      readonly disposition: "no-publication";
      readonly code: string;
      readonly reason: string;
      readonly error?: DomainError;
    };

export interface DirectorCueConverter {
  convert(input: DirectorCueConversionInput): DirectorCueConversionResult;
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
  readonly emergencyPaused: boolean;
  readonly participationMode: "twitch-extension" | "hosted-board" | "twitch-chat" | "unavailable";
  readonly capabilities: ParticipationCapabilities;
  readonly viewerId: string | null;
  readonly sessionPoints: number;
  readonly communityHype: number;
  readonly acceptedCandidateId: string | null;
  readonly connection: ServiceHealth;
  readonly sessionOverride?: StreamerSessionOverride | null;
  readonly liveDirector?: LiveDirectorState | null;
}

export interface ViewModelProjector {
  project(input: ViewModelProjectionInput): Promise<RoleViewModels> | RoleViewModels;
}
