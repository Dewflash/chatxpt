import { StreamerAuthorizedClient } from "../../streamer-authorized-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function StudioLiveQuestsPage() {
  return <StreamerAuthorizedClient surface="studio-live-quests" />;
}
