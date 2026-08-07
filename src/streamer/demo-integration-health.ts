import type { ServiceHealth } from "../core";
import { itemFromService, type StudioIntegrationHealthView } from "./integration-health-model";

const CHECKED_AT = 1_786_200_000_000;

function health(
  service: string,
  status: ServiceHealth["status"],
  message: string,
  retryable = false,
): ServiceHealth {
  return {
    service,
    status,
    checkedAt: CHECKED_AT,
    message,
    retryable,
  };
}

export const demoStudioIntegrationHealthView: StudioIntegrationHealthView = {
  generatedAt: CHECKED_AT,
  evidenceClass: "fixture",
  items: [
    itemFromService({
      id: "twitch",
      name: "Twitch app and Extension",
      owner: "Role 1",
      service: health("twitch", "misconfigured", "Hosted Test panel exists, but OAuth callback is not wired in this fixture.", true),
      purpose: "Viewer surface, OAuth callback, channel context, and chat input.",
      technicalDetail: "Hosted Test shell exists. Real Extension auth and callback URL must be supplied by Role 1 deployment.",
      nextAction: "Replace fixture status with Twitch setup readiness API when merged.",
      streamerFacing: true,
    }),
    itemFromService({
      id: "obs",
      name: "OBS capture and overlay",
      owner: "Role 1",
      service: health("obs", "degraded", "Local overlay route exists; real OBS browser-source evidence is still separate."),
      purpose: "Broadcast output plus gameplay capture path for real Brawl Stars evidence.",
      technicalDetail: "Use /overlay for local browser-source checks. Capture/recording proof must come from the streamer machine.",
      nextAction: "Record OBS Browser Source and Brawl Stars capture evidence.",
      streamerFacing: true,
    }),
    itemFromService({
      id: "extraction",
      name: "Gameplay extraction",
      owner: "Role 2",
      service: health("extraction", "degraded", "Role 2 draft evidence exists; live OBS input remains unverified."),
      purpose: "Turns captured gameplay into confidence-scored gameplay signals.",
      technicalDetail: "Diagnostic and fixture paths are not live evidence. Real OBS frames must be labelled separately.",
      nextAction: "Consume Role 2 real-input extraction evidence when PR #72 exits draft.",
      streamerFacing: false,
    }),
    itemFromService({
      id: "ai-provider",
      name: "AI and fallback generation",
      owner: "Role 2",
      service: health("ai-provider", "misconfigured", "Provider decision is still open; deterministic fallback remains available."),
      purpose: "Produces three candidate quests from gameplay, chat, and streamer preferences.",
      technicalDetail: "No normal streamer provider picker. Provider status is operational health only.",
      nextAction: "Wait for joint Role 2/3 provider recommendation and preserve no-credential fallback.",
      streamerFacing: false,
    }),
    itemFromService({
      id: "quest-engine",
      name: "Quest engine and safety",
      owner: "Role 3",
      service: health("quest-engine", "degraded", "Core lifecycle exists, but vote-close PR #57 still needs review/fix completion."),
      purpose: "Validates, activates, resolves, cancels, and rewards quests safely.",
      technicalDetail: "UI must not choose winners or terminal outcomes. Role 3 remains deterministic authority.",
      nextAction: "Clear PR #57 and consume accepted progress/reward seams.",
      streamerFacing: false,
    }),
    itemFromService({
      id: "viewer-surfaces",
      name: "Viewer voting and fallbacks",
      owner: "Role 5",
      service: health("viewer-surfaces", "degraded", "Fixture viewer, hosted board, chat instructions, and overlay are under PR #95."),
      purpose: "Lets viewers vote through Twitch Extension, hosted board, or chat fallback.",
      technicalDetail: "Current Role 5 slice is local fixture UI, not real Twitch/Supabase/multi-viewer evidence.",
      nextAction: "Review PR #95 and replace fixtures with authoritative Role 1 snapshots.",
      streamerFacing: true,
    }),
    itemFromService({
      id: "supabase",
      name: "Supabase realtime and storage",
      owner: "Role 1",
      service: health("supabase", "misconfigured", "Schema is committed; shared cloud project is not configured in this fixture."),
      purpose: "Persists sessions, votes, snapshots, history, access grants, and reconnect state.",
      technicalDetail: "Internal ChatXPT infrastructure. Streamers do not configure Supabase.",
      nextAction: "Create/link preview project, push migrations, and record two-client realtime evidence.",
      streamerFacing: false,
    }),
    itemFromService({
      id: "vercel",
      name: "Vercel deployment",
      owner: "Role 1",
      service: health("vercel", "misconfigured", "No production preview URL is configured in this fixture."),
      purpose: "Public HTTPS app, Twitch OAuth callback, backend API routes, Studio, and hosted board.",
      technicalDetail: "Internal ChatXPT hosting. Streamers see a ChatXPT URL, not Vercel setup.",
      nextAction: "Deploy preview after route/env configuration is safe.",
      streamerFacing: false,
    }),
  ],
};
