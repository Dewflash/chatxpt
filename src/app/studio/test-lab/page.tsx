import { StreamerAuthorizedClient } from "../../streamer-authorized-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function StudioTestLabPage() {
  return <StreamerAuthorizedClient surface="studio-test-lab" />;
}
