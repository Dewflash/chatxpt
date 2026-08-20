import { StreamerAuthorizedClient } from "../../streamer-authorized-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function StudioProfilePage() {
  return <StreamerAuthorizedClient surface="studio-profile" />;
}
