import { TwitchExtensionViewerClient } from "./twitch-extension-viewer-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TwitchViewerPage() {
  return (
    <>
      {/* Twitch requires its Extension Helper on every viewer surface. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"></script>
      <TwitchExtensionViewerClient />
    </>
  );
}
