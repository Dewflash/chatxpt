import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  startFromVerifiedTwitch: vi.fn(),
  resumeExistingFromVerifiedTwitch: vi.fn(),
  ensureLocalEventSub: vi.fn(),
  useLocalEventSub: vi.fn(),
}));

vi.mock("@/app/server/studio-session", async () => {
  const actual = await vi.importActual<typeof import("@/app/server/studio-session")>(
    "@/app/server/studio-session",
  );
  return {
    ...actual,
    getStudioSessionApplication: () => ({
      read: mocks.read,
      startFromVerifiedTwitch: mocks.startFromVerifiedTwitch,
      resumeExistingFromVerifiedTwitch: mocks.resumeExistingFromVerifiedTwitch,
    }),
  };
});

vi.mock("@/app/server/twitch-local-eventsub", () => ({
  ensureLocalTwitchEventSub: mocks.ensureLocalEventSub,
  shouldUseLocalTwitchEventSub: mocks.useLocalEventSub,
}));

import {
  TWITCH_BROADCASTER_CONNECTION_COOKIE,
  TwitchBroadcasterConnectionAuthority,
  studioSessionSecret,
} from "@/app/server/twitch-connection-grant";

import { GET } from "./route";

describe("Studio session automatic Twitch resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TWITCH_CLIENT_SECRET", "existing-twitch-client-secret");
    mocks.useLocalEventSub.mockReturnValue(true);
    mocks.ensureLocalEventSub.mockResolvedValue(undefined);
    mocks.read.mockRejectedValue(new Error("Studio session cookie missing"));
    mocks.startFromVerifiedTwitch.mockResolvedValue({
      view: { session: { sessionId: "session-1", broadcasterId: "broadcaster-1" } },
      readiness: { label: "Connected Twitch session" },
      roomCode: "ABCDEFGH",
      grant: "new-studio-grant",
      expiresAt: 1_800_000_000_000,
    });
    mocks.resumeExistingFromVerifiedTwitch.mockResolvedValue(null);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("recreates the authoritative Studio grant from the signed one-time Twitch connection", async () => {
    const connection = new TwitchBroadcasterConnectionAuthority(studioSessionSecret()).issue({
      version: 1,
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: "27471",
      gameName: "Minecraft",
      expiresAt: Date.now() + 60_000,
    });
    const response = await GET(new NextRequest("http://localhost:3000/api/studio/session", {
      headers: { cookie: `${TWITCH_BROADCASTER_CONNECTION_COOKIE}=${connection}` },
    }));

    expect(mocks.startFromVerifiedTwitch).toHaveBeenCalledWith({
      channelId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: "27471",
      gameName: "Minecraft",
    });
    expect(mocks.ensureLocalEventSub).toHaveBeenCalledWith("broadcaster-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      view: { session: { sessionId: "session-1", broadcasterId: "broadcaster-1" } },
      roomCode: "ABCDEFGH",
    });
    expect(response.headers.get("set-cookie")).toContain("chatxpt_studio_session=new-studio-grant");
  });

  it("switches an ended browser grant to a newer active Twitch session without creating one offline", async () => {
    mocks.read.mockResolvedValue({
      view: { session: { sessionId: "ended-session", status: "ended" } },
      readiness: { label: "Twitch stream ended" },
      roomCode: "OLDROOM1",
    });
    mocks.resumeExistingFromVerifiedTwitch.mockResolvedValue({
      view: { session: { sessionId: "new-live-session", status: "live" } },
      readiness: { label: "Twitch stream is live" },
      roomCode: "NEWROOM1",
      grant: "new-live-studio-grant",
      expiresAt: 1_800_000_000_000,
    });
    const connection = new TwitchBroadcasterConnectionAuthority(studioSessionSecret()).issue({
      version: 1,
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: "27471",
      gameName: "Minecraft",
      expiresAt: Date.now() + 60_000,
    });
    const response = await GET(new NextRequest("http://localhost:3000/api/studio/session", {
      headers: {
        cookie: `chatxpt_studio_session=ended-grant; ${TWITCH_BROADCASTER_CONNECTION_COOKIE}=${connection}`,
      },
    }));

    expect(mocks.resumeExistingFromVerifiedTwitch).toHaveBeenCalledOnce();
    expect(mocks.startFromVerifiedTwitch).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      view: { session: { sessionId: "new-live-session", status: "live" } },
    });
    expect(response.headers.get("set-cookie")).toContain(
      "chatxpt_studio_session=new-live-studio-grant",
    );
  });
});
