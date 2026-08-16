import { TWITCH_EXTENSION_HELPER_SCRIPT_URL } from "@/integrations";

import { StreamerAuthorizedClient } from "../streamer-authorized-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TwitchLiveConfigPage() {
  return (
    <>
      {/* Twitch requires the Extension Helper as the first script in Extension HTML. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src={TWITCH_EXTENSION_HELPER_SCRIPT_URL}></script>
      <StreamerAuthorizedClient surface="live-config" />
    </>
  );
}
