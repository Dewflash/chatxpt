import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const baseUrl = new URL(process.env.CHATXPT_SMOKE_BASE_URL ?? "http://localhost:3210");

function required(name) {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required for the canonical runtime smoke`);
  return value;
}

const studioSetupKey = required("CHATXPT_STUDIO_SETUP_KEY");
const overlaySetupKey = required("CHATXPT_OBS_OVERLAY_SETUP_KEY");
const gameplaySetupKey = required("CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY");
const eventSubSecret = required("TWITCH_EVENTSUB_SECRET");

async function response(path, options = {}, expectedStatus = 200) {
  const result = await fetch(new URL(path, baseUrl), options);
  assert.equal(
    result.status,
    expectedStatus,
    `${options.method ?? "GET"} ${path} returned ${result.status}: ${await result.clone().text()}`,
  );
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

function cookieFrom(setCookie) {
  assert.ok(setCookie, "Expected a Set-Cookie response header");
  return setCookie.split(";", 1)[0];
}

const checks = [];

const { payload: health } = await json("/api/health/deployment");
assert.equal(health.persistence.mode, "memory");
assert.equal(health.gameplayIngress.configured, true);
checks.push("deployment health reports explicit memory mode and configured Gameplay Capture");

const { payload: twitchReadiness } = await json("/api/twitch/setup/readiness");
assert.equal(twitchReadiness.ok, true);
assert.deepEqual(twitchReadiness.missing, []);
checks.push("Twitch readiness exposes all required paths without missing configuration");

const studioStart = await json(
  "/api/studio/session/start",
  postJson(
    {
      channelId: "123456789",
      displayName: "Canonical Runtime Smoke",
      gameId: "smoke-game",
      gameName: "Smoke Test Game",
    },
    { "x-chatxpt-studio-setup-key": studioSetupKey },
  ),
  201,
);
assert.equal(studioStart.payload.ok, true);
assert.equal(studioStart.payload.view.session.status, "preparing");
assert.ok(studioStart.payload.roomCode);
const sessionId = studioStart.payload.view.session.sessionId;
const roomCode = studioStart.payload.roomCode;
const studioSetCookie = studioStart.result.headers.get("set-cookie");
assert.match(studioSetCookie ?? "", /HttpOnly/i);
assert.match(studioSetCookie ?? "", /SameSite=Strict/i);
const studioCookie = cookieFrom(studioSetCookie);

const { payload: studioRead } = await json("/api/studio/session", {
  headers: { cookie: studioCookie },
});
assert.equal(studioRead.view.session.sessionId, sessionId);
checks.push("Studio creates and recovers one signed channel-bound preparing session");

const overlayGrant = await json(
  "/api/obs/overlay/grant",
  postJson(
    { width: 1920, height: 1080 },
    {
      "x-chatxpt-obs-overlay-setup-key": overlaySetupKey,
      cookie: studioCookie,
    },
  ),
  201,
);
const overlayUrl = new URL(overlayGrant.payload.descriptor.url);
const overlayToken = new URLSearchParams(overlayUrl.hash.slice(1)).get("overlayAccessToken");
const overlayBroadcasterId = overlayUrl.searchParams.get("broadcasterId");
assert.ok(overlayToken);
assert.equal(overlayBroadcasterId, studioStart.payload.view.session.broadcasterId);
assert.equal(overlayUrl.searchParams.has("overlayAccessToken"), false);
assert.equal(overlayGrant.payload.descriptor.readOnly, true);
assert.equal(overlayGrant.payload.descriptor.reusableAcrossSessions, true);
const { payload: overlayState } = await json(
  `/api/obs/overlay/state?broadcasterId=${encodeURIComponent(overlayBroadcasterId)}`,
  { headers: { authorization: `Bearer ${overlayToken}` } },
);
assert.equal(overlayState.view.envelope.sessionId, sessionId);
checks.push("OBS installation keeps its read-only token in the fragment and resolves the broadcaster's active session");

const gameplayGrant = await json(
  "/api/gameplay/ingress/grant",
  postJson(
    { sessionId },
    { "x-chatxpt-gameplay-setup-key": gameplaySetupKey },
  ),
  201,
);
const { payload: gameplayAuthority } = await json("/api/gameplay/ingress/snapshot", {
  headers: { authorization: `Bearer ${gameplayGrant.payload.grant.token}` },
});
assert.equal(gameplayAuthority.authority.sessionId, sessionId);
checks.push("Gameplay Capture grant is independently authenticated and session-bound");

const hostedAccess = await json(
  "/api/hosted-board/access",
  postJson({ roomCode }),
  201,
);
const hostedSetCookie = hostedAccess.result.headers.get("set-cookie");
assert.match(hostedSetCookie ?? "", /HttpOnly/i);
assert.match(hostedSetCookie ?? "", /SameSite=Strict/i);
const hostedCookie = cookieFrom(hostedSetCookie);
const { payload: hostedViewer } = await json("/api/hosted-board/viewer", {
  headers: { cookie: hostedCookie },
});
assert.equal(hostedViewer.view.envelope.sessionId, sessionId);
assert.equal(hostedViewer.view.participationMode, "hosted-board");
checks.push("Hosted Quest Board exchanges its room code for private shared-ledger access");

const challengeBody = JSON.stringify({
  challenge: "canonical-runtime-smoke-challenge",
  subscription: { type: "channel.chat.message" },
});
const messageId = "canonical-runtime-smoke-eventsub";
const messageTimestamp = new Date().toISOString();
const messageSignature = `sha256=${createHmac("sha256", eventSubSecret)
  .update(messageId)
  .update(messageTimestamp)
  .update(challengeBody)
  .digest("hex")}`;
const challenge = await response(
  "/api/twitch/eventsub",
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "twitch-eventsub-message-id": messageId,
      "twitch-eventsub-message-timestamp": messageTimestamp,
      "twitch-eventsub-message-signature": messageSignature,
      "twitch-eventsub-message-type": "webhook_callback_verification",
    },
    body: challengeBody,
  },
);
assert.equal(await challenge.text(), "canonical-runtime-smoke-challenge");
checks.push("EventSub accepts an exact raw-body HMAC challenge response");

for (const path of [
  "/studio",
  "/config.html",
  "/live-config.html",
  "/viewer.html",
  `/quest-board/${encodeURIComponent(roomCode)}`,
  `/obs-overlay?broadcasterId=${encodeURIComponent(overlayBroadcasterId)}`,
  "/diagnostics/gameplay-extraction",
]) {
  const page = await response(path);
  assert.match(page.headers.get("content-type") ?? "", /text\/html/);
}
checks.push("all canonical management, viewer, fallback, overlay, and capture pages render");

console.log(JSON.stringify({
  result: "passed",
  persistence: "memory",
  evidenceClass: "memory-backed",
  checks,
  limitations: [
    "Uses local test-only credentials and process-memory persistence.",
    "Does not prove Twitch-issued JWTs, real EventSub delivery, Supabase, OBS, camera permission, or a deployed origin.",
  ],
}, null, 2));
