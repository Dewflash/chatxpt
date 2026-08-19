import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = new URL(process.env.CHATXPT_SMOKE_BASE_URL ?? "http://localhost:3210");

function required(name) {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required for the Role 5 memory smoke`);
  return value;
}

const extensionSecret = required("TWITCH_EXTENSION_SECRET");
const eventSubSecret = required("TWITCH_EVENTSUB_SECRET");
const overlaySetupKey = required("CHATXPT_OBS_OVERLAY_SETUP_KEY");
const studioSetupKey = required("CHATXPT_STUDIO_SETUP_KEY");
const extensionSecretBytes = Buffer.from(extensionSecret, "base64");
assert.ok(extensionSecretBytes.length >= 16, "TWITCH_EXTENSION_SECRET must decode to at least 16 bytes");

async function response(path, options = {}, expectedStatus = 200) {
  const result = await fetch(new URL(path, baseUrl), options);
  if (result.status !== expectedStatus) {
    const detail = await result.clone().text();
    assert.equal(
      result.status,
      expectedStatus,
      `${options.method ?? "GET"} ${path} returned ${result.status}: ${detail}`,
    );
  }
  return result;
}

async function json(path, options = {}, expectedStatus = 200) {
  const result = await response(path, options, expectedStatus);
  return { result, payload: await result.json() };
}

function postJson(body, headers = {}) {
  return {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

function bearer(token) {
  return { authorization: `Bearer ${token}` };
}

function cookieFrom(setCookie) {
  assert.ok(setCookie, "Expected a Set-Cookie response header");
  return setCookie.split(";", 1)[0];
}

function signedViewerToken(channelId, opaqueUserId) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({
    channel_id: channelId,
    exp: Math.floor((Date.now() + 10 * 60_000) / 1_000),
    opaque_user_id: opaqueUserId,
    role: "viewer",
  })).toString("base64url");
  const signature = createHmac("sha256", extensionSecretBytes)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

async function extensionView(token) {
  const { payload } = await json("/api/twitch/extension/viewer", {
    headers: bearer(token),
  });
  assert.equal(payload.ok, true);
  return payload.view;
}

async function extensionCommand(token, command) {
  const { payload } = await json(
    "/api/twitch/extension/commands",
    postJson(command, bearer(token)),
  );
  return payload;
}

async function overlayView(sessionId, token) {
  const { payload } = await json(
    `/api/obs/overlay/state?sessionId=${encodeURIComponent(sessionId)}`,
    { headers: bearer(token) },
  );
  assert.equal(payload.ok, true);
  return payload.view;
}

function authoritativeRef(view) {
  return {
    sessionId: view.envelope.sessionId,
    questCycleId: view.envelope.questCycleId,
    revision: view.envelope.revision,
    status: view.questCycle.status,
  };
}

function assertSameAuthority(label, views) {
  assert.ok(views.length > 1, `${label} requires more than one view`);
  const expected = authoritativeRef(views[0]);
  for (const view of views.slice(1)) {
    assert.deepEqual(authoritativeRef(view), expected, `${label} diverged across clients`);
  }
  return expected;
}

async function sendChatMessage({ channelId, chatterId, messageId, text }) {
  const rawBody = JSON.stringify({
    subscription: { type: "channel.chat.message" },
    event: {
      broadcaster_user_id: channelId,
      chatter_user_id: chatterId,
      message_id: messageId,
      message: { text },
    },
  });
  const messageTimestamp = new Date().toISOString();
  const signature = `sha256=${createHmac("sha256", eventSubSecret)
    .update(messageId)
    .update(messageTimestamp)
    .update(rawBody)
    .digest("hex")}`;
  await response(
    "/api/twitch/eventsub",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "twitch-eventsub-message-id": messageId,
        "twitch-eventsub-message-timestamp": messageTimestamp,
        "twitch-eventsub-message-signature": signature,
        "twitch-eventsub-message-type": "notification",
      },
      body: rawBody,
    },
    204,
  );
}

function candidateSet(prefix) {
  return [
    {
      id: `${prefix}-candidate-one`,
      title: "Hold Your Ground",
      instruction: "Stay in your current playable area for the next thirty seconds.",
      durationSeconds: 30,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: "A safe diagnostic candidate for the Role 5 memory rehearsal.",
    },
    {
      id: `${prefix}-candidate-two`,
      title: "Caster Mode",
      instruction: "Narrate the next thirty seconds like a dramatic sports commentator.",
      durationSeconds: 30,
      difficulty: "medium",
      rewardPoints: 150,
      rationale: "A distinct diagnostic candidate for the Role 5 memory rehearsal.",
    },
    {
      id: `${prefix}-candidate-three`,
      title: "Audience Check-In",
      instruction: "Explain your next move to the audience before taking another action.",
      durationSeconds: 30,
      difficulty: "easy",
      rewardPoints: 100,
      rationale: "An understandable diagnostic candidate for the Role 5 memory rehearsal.",
    },
  ];
}

const checks = [];
const runId = Date.now().toString(36);
const primaryChannelId = `role-5-memory-primary-${runId}`;
const viewerAToken = signedViewerToken(primaryChannelId, "Urole5-viewer-a");
const viewerBToken = signedViewerToken(primaryChannelId, "Arole5-viewer-b");
const primaryCandidates = candidateSet("primary");

try {
  await json("/api/demo-participation", postJson({ type: "clear" }));
  const staged = await json(
    "/api/demo-participation",
    postJson({ type: "publish-quests", quests: primaryCandidates }),
  );
  assert.equal(staged.payload.evidenceClass, "local-demo");
  assert.equal(staged.payload.quests.length, 3);

  const initialA = await extensionView(viewerAToken);
  const initialB = await extensionView(viewerBToken);
  const initialRef = assertSameAuthority("initial two-viewer voting state", [initialA, initialB]);
  assert.equal(initialRef.status, "voting");
  assert.equal(initialA.questCycle.options.length, 3);
  assert.equal(initialA.viewerId === null, false);
  assert.equal(initialB.viewerId, null);
  assert.equal(initialA.acceptedCandidateId, null);
  assert.equal(initialB.acceptedCandidateId, null);
  assert.deepEqual(initialA.questCycle.voteTallies, []);
  assert.deepEqual(initialB.questCycle.voteTallies, []);
  checks.push("two isolated signed viewer contexts share one three-option voting revision");

  const overlayGrant = await json(
    "/api/obs/overlay/grant",
    postJson(
      { sessionId: initialRef.sessionId, width: 1280, height: 720 },
      { "x-chatxpt-obs-overlay-setup-key": overlaySetupKey },
    ),
    201,
  );
  const overlayUrl = new URL(overlayGrant.payload.descriptor.url);
  const overlayToken = new URLSearchParams(overlayUrl.hash.slice(1)).get("overlayAccessToken");
  assert.ok(overlayToken);
  assert.equal(overlayGrant.payload.descriptor.readOnly, true);
  assert.equal(overlayUrl.searchParams.has("overlayAccessToken"), false);

  const reaction = await extensionCommand(viewerAToken, {
    commandId: `role-5-memory-reaction-a-${runId}`,
    reaction: "hype",
  });
  assert.equal(reaction.ok, true);
  assert.equal(reaction.outcome, "committed");
  assert.equal(reaction.view.communityHype, 1);
  const duplicateReaction = await extensionCommand(viewerAToken, {
    commandId: `role-5-memory-reaction-a-${runId}`,
    reaction: "hype",
  });
  assert.equal(duplicateReaction.ok, true);
  assert.equal(duplicateReaction.outcome, "duplicate");

  const winnerCandidateId = primaryCandidates[1].id;
  const voteA = await extensionCommand(viewerAToken, {
    commandId: `role-5-memory-vote-a-${runId}`,
    candidateId: winnerCandidateId,
  });
  const voteB = await extensionCommand(viewerBToken, {
    commandId: `role-5-memory-vote-b-${runId}`,
    candidateId: winnerCandidateId,
  });
  assert.equal(voteA.ok, true);
  assert.equal(voteB.ok, true);
  assert.equal(voteA.outcome, "committed");
  assert.equal(voteB.outcome, "committed");
  assert.equal(voteA.view.acceptedCandidateId, winnerCandidateId);
  assert.equal(voteB.view.acceptedCandidateId, winnerCandidateId);

  const duplicateVote = await extensionCommand(viewerAToken, {
    commandId: `role-5-memory-vote-a-${runId}`,
    candidateId: winnerCandidateId,
  });
  assert.equal(duplicateVote.ok, true);
  assert.equal(duplicateVote.outcome, "duplicate");

  const refreshedViewerAToken = signedViewerToken(primaryChannelId, "Urole5-viewer-a");
  const votingA = await extensionView(refreshedViewerAToken);
  const votingB = await extensionView(viewerBToken);
  const votingOverlay = await overlayView(initialRef.sessionId, overlayToken);
  const votingRef = assertSameAuthority("authoritative two-vote tally", [
    votingA,
    votingB,
    votingOverlay,
  ]);
  assert.equal(votingA.acceptedCandidateId, winnerCandidateId);
  assert.equal(votingB.acceptedCandidateId, winnerCandidateId);
  assert.deepEqual(votingOverlay.questCycle.voteTallies, [
    { candidateId: primaryCandidates[0].id, votes: 0 },
    { candidateId: winnerCandidateId, votes: 2 },
    { candidateId: primaryCandidates[2].id, votes: 0 },
  ]);
  assert.equal(votingOverlay.communityHype, 1);
  checks.push("two votes, private acknowledgements, duplicate idempotency, shared hype, and read-only OBS tally converge");

  const voteEndsAt = votingA.questCycle.endsAt;
  assert.ok(voteEndsAt !== null, "Voting must expose an authoritative end time");
  const waitMs = Math.max(0, voteEndsAt - Date.now() + 150);
  assert.ok(waitMs <= 35_000, `Unexpected diagnostic vote wait: ${waitMs}ms`);
  await delay(waitMs);

  let activeOverlay = await overlayView(initialRef.sessionId, overlayToken);
  if (activeOverlay.questCycle.status === "voting") {
    await delay(250);
    activeOverlay = await overlayView(initialRef.sessionId, overlayToken);
  }
  const activeA = await extensionView(refreshedViewerAToken);
  const activeB = await extensionView(viewerBToken);
  const activeRef = assertSameAuthority("authoritative winner activation", [
    activeA,
    activeB,
    activeOverlay,
  ]);
  assert.equal(activeRef.status, "active");
  assert.equal(activeOverlay.questCycle.activeCandidateId, winnerCandidateId);
  assert.equal(activeOverlay.readOnly, true);
  checks.push("authoritative vote close activates the same winner for both viewers and OBS");

  const progress = await json(
    "/api/demo-participation",
    postJson({ type: "quest-progress", value: 0.5 }),
  );
  assert.equal(progress.payload.accepted, true);
  const progressA = await extensionView(refreshedViewerAToken);
  const progressB = await extensionView(viewerBToken);
  const progressOverlay = await overlayView(initialRef.sessionId, overlayToken);
  const progressRef = assertSameAuthority("authoritative quest progress", [
    progressA,
    progressB,
    progressOverlay,
  ]);
  assert.equal(progressRef.status, "active");
  assert.equal(progressOverlay.questCycle.progress?.value, 0.5);

  const result = await json(
    "/api/demo-participation",
    postJson({ type: "quest-result", outcome: "completed" }),
  );
  assert.equal(result.payload.accepted, true);
  const terminalA = await extensionView(refreshedViewerAToken);
  const terminalB = await extensionView(viewerBToken);
  const terminalOverlay = await overlayView(initialRef.sessionId, overlayToken);
  const terminalRef = assertSameAuthority("authoritative terminal result", [
    terminalA,
    terminalB,
    terminalOverlay,
  ]);
  assert.equal(terminalRef.status, "succeeded");
  assert.equal(terminalOverlay.questCycle.result?.outcome, "succeeded");
  assert.equal(terminalA.acceptedCandidateId, winnerCandidateId);
  assert.equal(terminalB.acceptedCandidateId, winnerCandidateId);
  checks.push("progress and successful result remain on one revision with private vote recovery intact");

  const fallbackStart = await json(
    "/api/studio/session/start",
    postJson(
      {
        channelId: `role-5-memory-hosted-${runId}`,
        displayName: "Role 5 Hosted Memory Rehearsal",
        gameId: null,
        gameName: null,
      },
      { "x-chatxpt-studio-setup-key": studioSetupKey },
    ),
    201,
  );
  const roomCode = fallbackStart.payload.roomCode;
  assert.match(roomCode, /^[A-HJ-NP-Z2-9]{8}$/);
  const hostedAccessA = await json(
    "/api/hosted-board/access",
    postJson({ roomCode }),
    201,
  );
  const hostedAccessB = await json(
    "/api/hosted-board/access",
    postJson({ roomCode }),
    201,
  );
  const hostedCookieA = cookieFrom(hostedAccessA.result.headers.get("set-cookie"));
  const hostedCookieB = cookieFrom(hostedAccessB.result.headers.get("set-cookie"));
  assert.notEqual(hostedCookieA, hostedCookieB);
  const hostedA = await json("/api/hosted-board/viewer", { headers: { cookie: hostedCookieA } });
  const hostedB = await json("/api/hosted-board/viewer", { headers: { cookie: hostedCookieB } });
  assert.equal(hostedA.payload.view.participationMode, "hosted-board");
  assert.equal(hostedB.payload.view.participationMode, "hosted-board");
  assert.equal(hostedA.payload.view.viewerId, null);
  assert.equal(hostedB.payload.view.viewerId, null);
  assertSameAuthority("isolated hosted-board fallback access", [
    hostedA.payload.view,
    hostedB.payload.view,
  ]);

  const hostedReconnect = await json(
    "/api/hosted-board/access",
    postJson({ roomCode }, { cookie: hostedCookieA }),
    201,
  );
  const reconnectCookie = cookieFrom(hostedReconnect.result.headers.get("set-cookie"));
  const hostedAfterReconnect = await json("/api/hosted-board/viewer", {
    headers: { cookie: reconnectCookie },
  });
  assert.deepEqual(
    authoritativeRef(hostedAfterReconnect.payload.view),
    authoritativeRef(hostedA.payload.view),
  );
  const invalidHosted = await json(
    "/api/hosted-board/access",
    postJson({ roomCode: "BAD" }),
    404,
  );
  assert.equal(invalidHosted.payload.ok, false);
  assert.equal(invalidHosted.payload.error.code, "session-not-found");
  checks.push("hosted fallback isolates anonymous cookies, reconnects, and rejects an invalid room code safely");

  const chatChannelId = `role-5-memory-chat-${runId}`;
  const chatCandidates = candidateSet("chat");
  await json(
    "/api/demo-participation",
    postJson({ type: "publish-quests", quests: chatCandidates }),
  );
  await extensionView(signedViewerToken(chatChannelId, "Urole5-chat-bootstrap"));
  await sendChatMessage({
    channelId: chatChannelId,
    chatterId: "role5-chat-participant-a",
    messageId: `role5-chat-message-a-${runId}`,
    text: "2",
  });
  await sendChatMessage({
    channelId: chatChannelId,
    chatterId: "role5-chat-participant-a",
    messageId: `role5-chat-message-a-duplicate-choice-${runId}`,
    text: "1",
  });
  await sendChatMessage({
    channelId: chatChannelId,
    chatterId: "role5-chat-participant-b",
    messageId: `role5-chat-message-b-${runId}`,
    text: "2",
  });
  await sendChatMessage({
    channelId: chatChannelId,
    chatterId: "role5-chat-participant-c",
    messageId: `role5-chat-message-ignored-${runId}`,
    text: "vote 1",
  });
  const chatSnapshot = await json("/api/demo-participation");
  assert.equal(chatSnapshot.payload.participationMode, "twitch-extension");
  assert.deepEqual(chatSnapshot.payload.votes, {
    [chatCandidates[0].id]: 0,
    [chatCandidates[1].id]: 2,
    [chatCandidates[2].id]: 0,
  });
  checks.push("signed EventSub exact 1/2/3 chat votes share first-vote-final authority and ignore ordinary chat");

  console.log(JSON.stringify({
    result: "passed",
    evidenceClass: "memory-backed",
    persistence: "memory",
    primary: {
      sessionRef: terminalRef.sessionId,
      questCycleRef: terminalRef.questCycleId,
      votingRevision: votingRef.revision,
      activeRevision: activeRef.revision,
      progressRevision: progressRef.revision,
      terminalRevision: terminalRef.revision,
      winnerCandidateId,
      terminalStatus: terminalRef.status,
    },
    checks,
    limitations: [
      "Uses locally signed diagnostic Twitch JWTs, synthetic candidates, test-only secrets, and process-memory persistence.",
      "Does not prove Twitch-issued identity, Twitch Local or Hosted Test, real EventSub delivery, Supabase Cloud, OBS Browser Source, or a deployed origin.",
      "Hosted fallback recovery is exercised on a separate live memory session; it is not represented as the primary vote cycle.",
      "No non-zero persisted session-points award is claimed.",
    ],
  }, null, 2));
} finally {
  try {
    await json("/api/demo-participation", postJson({ type: "clear" }));
  } catch {
    // Best-effort diagnostic cleanup; the local server process is disposable.
  }
}
