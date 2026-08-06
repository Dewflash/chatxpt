import { TwitchExtensionRouteShell } from "../extension-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TwitchViewerPage() {
  return <TwitchExtensionRouteShell surface="viewer" />;
}
