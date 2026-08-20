import { StreamerAuthorizedClient } from "../streamer-authorized-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function StudioPage() {
  return <StreamerAuthorizedClient surface="studio-home" />;
}
