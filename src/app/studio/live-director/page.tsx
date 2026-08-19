import { StreamerAuthorizedClient } from "../../streamer-authorized-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Studio-cookie protected compact surface for a private pop-out or OBS Custom Dock. */
export default function StudioLiveDirectorPage() {
  return <StreamerAuthorizedClient surface="studio-live-config" />;
}
