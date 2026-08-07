import { describe, expect, it } from "vitest";

import { createOverlayDemoView, createViewerDemoView } from "./demo-fixtures";
import {
  activeQuest,
  buildViewerReactionCommand,
  buildViewerVoteCommand,
  overlayPlacementClass,
  remainingSeconds,
  serviceStatusLabel,
  visibleQuestOptions,
  voteShareFor,
} from "./surface-model";

describe("Role 5 viewer surface helpers", () => {
  it("keeps exactly three visible voting options from the canonical view model", () => {
    const view = createViewerDemoView();

    expect(visibleQuestOptions(view.questCycle)).toHaveLength(3);
    expect(voteShareFor(view.questCycle, "guardian-protocol")).toBe(47);
  });

  it("builds a viewer vote command without changing authoritative tallies", () => {
    const view = createViewerDemoView();
    const beforeVotes = view.questCycle.voteTallies[0]?.votes;

    const command = buildViewerVoteCommand({
      view,
      candidateId: "guardian-protocol",
      voterKey: "fixture-viewer-key",
      issuedAt: 1_786_200_001_000,
    });

    expect(command.type).toBe("viewer.vote");
    expect(command.expectedRevision).toBe(view.envelope.revision);
    expect(command.sourceMode).toBe("twitch-extension");
    expect(command.commandId.startsWith("viewer-vote-")).toBe(true);
    expect(view.questCycle.voteTallies[0]?.votes).toBe(beforeVotes);
  });

  it("builds viewer reaction commands without claiming reaction acceptance locally", () => {
    const view = createViewerDemoView();

    const command = buildViewerReactionCommand({
      view,
      reaction: "hype",
      issuedAt: 1_786_200_001_001,
    });

    expect(command.type).toBe("viewer.react");
    expect(command.reaction).toBe("hype");
    expect(command.expectedRevision).toBe(view.envelope.revision);
    expect(command.commandId).toBe("viewer-react-hype-1786200001001");
  });

  it("summarises health and overlay states for UI presentation", () => {
    const reconnecting = createViewerDemoView({ connection: "degraded" });
    const overlay = createOverlayDemoView("active");

    expect(serviceStatusLabel(reconnecting.connection)).toBe("Degraded");
    expect(activeQuest(overlay.questCycle)?.title).toBe("Guardian Protocol");
    expect(overlayPlacementClass(overlay)).toBe("edge");
    expect(remainingSeconds(1_786_200_016_000, overlay.questCycle.endsAt)).toBe(43);
  });
});
