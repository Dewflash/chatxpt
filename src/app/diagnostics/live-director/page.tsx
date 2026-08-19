import { createFixtureUiGatewaySnapshot } from "@/core";
import { StudioManagementSurface, TwitchLiveConfigSurface } from "@/streamer";

export const dynamic = "force-dynamic";

export default async function LiveDirectorDiagnosticPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly surface?: string }>;
}) {
  const { surface } = await searchParams;
  const view = createFixtureUiGatewaySnapshot().views.streamer;
  if (surface === "studio") {
    return <StudioManagementSurface view={view} />;
  }
  return (
    <TwitchLiveConfigSurface
      view={view}
      studioHref="/diagnostics/live-director?surface=studio"
      popoutHref="/diagnostics/live-director?surface=live-config"
    />
  );
}
