import { createFixtureUiGatewaySnapshot, sessionHistorySnapshotSchema } from "@/core";
import { StudioManagementSurface, TwitchLiveConfigSurface } from "@/streamer";

export const dynamic = "force-dynamic";

export default async function LiveDirectorDiagnosticPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly surface?: string }>;
}) {
  const { surface } = await searchParams;
  const view = createFixtureUiGatewaySnapshot().views.streamer;
  const historyGeneratedAt = view.envelope.occurredAt + 30_000;
  const historyCandidateId = view.questCycle.options[0]?.candidateId ?? "fixture-history-candidate";
  const history = sessionHistorySnapshotSchema.parse({
    contractVersion: view.envelope.contractVersion,
    broadcasterId: view.session.broadcasterId,
    generatedAt: historyGeneratedAt,
    source: "test-fixture",
    evidenceClass: "fixture",
    limit: 25,
    entries: [
      {
        sessionId: view.session.sessionId,
        questCycleId: "fixture-history-success",
        sessionRevision: view.session.revision,
        title: "Hold Your Ground",
        activeCandidateId: historyCandidateId,
        outcome: "succeeded",
        reason: "Fixture quest succeeded.",
        startedAt: historyGeneratedAt - 20_000,
        endedAt: historyGeneratedAt,
        durationSeconds: 20,
        acceptedVoteCount: 3,
        voteTallies: [{ candidateId: historyCandidateId, votes: 3 }],
        rewardPointsAwarded: 100,
        evidenceClass: "fixture",
      },
      {
        sessionId: view.session.sessionId,
        questCycleId: "fixture-history-skipped",
        sessionRevision: Math.max(0, view.session.revision - 1),
        title: null,
        activeCandidateId: null,
        outcome: "skipped",
        reason: "Fixture streamer skip.",
        startedAt: null,
        endedAt: historyGeneratedAt - 180_000,
        durationSeconds: null,
        acceptedVoteCount: 0,
        voteTallies: [],
        rewardPointsAwarded: 0,
        evidenceClass: "fixture",
      },
    ],
    summary: {
      totalQuestCycles: 2,
      succeeded: 1,
      failed: 0,
      cancelled: 0,
      skipped: 1,
      expired: 0,
      totalAcceptedVotes: 3,
      totalRewardPointsAwarded: 100,
      averageCompletionSeconds: 20,
    },
    privacy: {
      rawChatHistoryRetained: false,
      viewerIdentifiersIncluded: false,
      privateVoteReceiptsIncluded: false,
      retentionNote:
        "Session history stores terminal quest outcomes and aggregate engagement only; raw chat and viewer identifiers are not retained in this read model.",
    },
  });
  if (surface === "studio") {
    return <StudioManagementSurface view={view} history={history} />;
  }
  return (
    <TwitchLiveConfigSurface
      view={view}
      studioHref="/diagnostics/live-director?surface=studio"
      popoutHref="/diagnostics/live-director?surface=live-config"
    />
  );
}
