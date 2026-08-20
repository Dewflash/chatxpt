import { StreamerAuthorizedClient } from "../../streamer-authorized-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function StudioLiveAnalyticsPage() {
  return <StreamerAuthorizedClient surface="studio-live-analytics" />;
}
