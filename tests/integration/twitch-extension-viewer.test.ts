import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { TwitchExtensionViewerApplication } from "../../src/app";
import { createMemoryPersistenceRuntime } from "../../src/realtime";

const SECRET_BYTES = Buffer.from("0123456789abcdef0123456789abcdef", "utf8");
const SECRET = SECRET_BYTES.toString("base64");

function signedToken(
  now: number,
  opaqueUserId: string,
  channelId = "twitch-channel-one",
) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      channel_id: channelId,
      exp: Math.floor((now + 5 * 60_000) / 1_000),
      opaque_user_id: opaqueUserId,
      role: "viewer",
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", SECRET_BYTES)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function candidates() {
  return [
    {
      id: "candidate-one",
      title: "Hold Your Ground",
      instruction: "Stay in your current playable area for the next thirty seconds.",
      durationSeconds: 30,
      difficulty: "easy" as const,
      rewardPoints: 100,
      rationale: "A clear local diagnostic candidate for the signed viewer path.",
    },
    {
      id: "candidate-two",
      title: "Caster Mode",
      instruction: "Narrate the next thirty seconds like a dramatic sports commentator.",
      durationSeconds: 30,
      difficulty: "medium" as const,
      rewardPoints: 150,
      rationale: "A distinct local diagnostic candidate for the signed viewer path.",
    },
    {
      id: "candidate-three",
      title: "Audience Check-In",
      instruction: "Explain your next move to the audience before taking another action.",
      durationSeconds: 30,
      difficulty: "easy" as const,
      rewardPoints: 100,
      rationale: "An understandable diagnostic candidate for the signed viewer path.",
    },
  ];
}

describe("authenticated Twitch Extension viewer application", () => {
  it("opens a diagnostic local cycle, privately acknowledges votes, and restores them after token refresh", async () => {
    let now = 2_000_000_000_000;
    let sequence = 0;
    const persistence = createMemoryPersistenceRuntime();
    const application = new TwitchExtensionViewerApplication({
      persistence,
      extensionSecret: SECRET,
      localDiagnostics: true,
      now: () => now,
      nextId: () => `test-${++sequence}`,
    });
    application.stageLocalDiagnosticQuests(candidates());
    const firstToken = signedToken(now, "Uviewer-one");
    const firstHeader = `Bearer ${firstToken}`;

    const beforeVote = await application.readViewer(firstHeader);
    expect(beforeVote).toMatchObject({
      participationMode: "twitch-extension",
      canVote: true,
      canReact: true,
      acceptedCandidateId: null,
      questCycle: { status: "voting", voteTallies: [] },
    });
    expect(beforeVote.questCycle.options).toHaveLength(3);

    const reacted = await application.react(firstHeader, {
      commandId: "viewer-one-reaction",
      reaction: "hype",
    });
    expect(reacted).toMatchObject({
      ok: true,
      outcome: "committed",
      view: { communityHype: 1, canReact: true },
    });
    const duplicateReaction = await application.react(firstHeader, {
      commandId: "viewer-one-reaction",
      reaction: "hype",
    });
    expect(duplicateReaction).toMatchObject({ ok: true, outcome: "duplicate" });

    const accepted = await application.vote(firstHeader, {
      commandId: "viewer-one-vote",
      candidateId: "candidate-two",
    });
    expect(accepted).toMatchObject({
      ok: true,
      outcome: "committed",
      view: { acceptedCandidateId: "candidate-two", canVote: false },
    });
    if (!accepted.ok) return;
    expect(accepted.view.questCycle.voteTallies).toEqual([
      { candidateId: "candidate-one", votes: 0 },
      { candidateId: "candidate-two", votes: 1 },
      { candidateId: "candidate-three", votes: 0 },
    ]);

    const duplicate = await application.vote(firstHeader, {
      commandId: "viewer-one-vote",
      candidateId: "candidate-two",
    });
    expect(duplicate).toMatchObject({ ok: true, outcome: "duplicate" });

    now += 1_000;
    const refreshed = await application.readViewer(`Bearer ${signedToken(now, "Uviewer-one")}`);
    expect(refreshed.acceptedCandidateId).toBe("candidate-two");
    expect(refreshed.canVote).toBe(false);

    const anotherViewer = await application.readViewer(
      `Bearer ${signedToken(now, "Uviewer-two")}`,
    );
    expect(anotherViewer.acceptedCandidateId).toBeNull();
    expect(anotherViewer.questCycle.voteTallies).toEqual([]);

    now += 30_000;
    const selected = await application.readViewer(`Bearer ${signedToken(now, "Uviewer-one")}`);
    expect(selected).toMatchObject({
      questCycle: {
        status: "selected",
        activeCandidateId: "candidate-two",
        progress: null,
      },
    });
    now += 10_000;
    const active = await application.readViewer(`Bearer ${signedToken(now, "Uviewer-one")}`);
    expect(active).toMatchObject({
      questCycle: {
        status: "active",
        activeCandidateId: "candidate-two",
        progress: { value: 0 },
      },
    });
    const progressed = await application.updateLocalDiagnosticQuest({ type: "progress", value: 0.5 });
    expect(progressed.questCycle.progress?.value).toBe(0.5);
    const succeeded = await application.updateLocalDiagnosticQuest({
      type: "result",
      outcome: "succeed",
    });
    expect(succeeded.questCycle).toMatchObject({
      status: "succeeded",
      result: { outcome: "succeeded" },
    });

    const diagnostic = await application.readLocalDiagnosticSnapshot();
    expect(diagnostic).toMatchObject({
      evidenceClass: "diagnostic",
      votes: { "candidate-one": 0, "candidate-two": 1, "candidate-three": 0 },
    });
  });

  it("supports anonymous Twitch viewers and rejects a token from another channel", async () => {
    const now = 2_000_000_000_000;
    const application = new TwitchExtensionViewerApplication({
      persistence: createMemoryPersistenceRuntime(),
      extensionSecret: SECRET,
      localDiagnostics: true,
      now: () => now,
    });
    application.stageLocalDiagnosticQuests(candidates());
    const anonymousHeader = `Bearer ${signedToken(now, "Aanonymous-viewer")}`;

    const before = await application.readViewer(anonymousHeader);
    expect(before.viewerId).toBeNull();
    const accepted = await application.vote(anonymousHeader, {
      commandId: "anonymous-vote",
      candidateId: "candidate-one",
    });
    expect(accepted).toMatchObject({
      ok: true,
      view: { viewerId: null, acceptedCandidateId: "candidate-one" },
    });

    await expect(
      application.readViewer(`Bearer ${signedToken(now, "Uwrong-channel", "another-channel")}`),
    ).rejects.toMatchObject({ code: "session-not-found" });
  });
});
