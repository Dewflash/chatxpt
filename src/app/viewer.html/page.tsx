import { DemoExtensionViewer } from "./demo-extension-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TwitchViewerPage() {
  return <DemoExtensionViewer />;
}
