import { TwitchExtensionRouteShell } from "../twitch-extension-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TwitchConfigPage() {
  return <TwitchExtensionRouteShell surface="config" />;
}
