import { TwitchExtensionRouteShell } from "../twitch-extension-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TwitchLiveConfigPage() {
  return <TwitchExtensionRouteShell surface="live-config" />;
}
