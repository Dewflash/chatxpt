import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  startFromVerifiedTwitch: vi.fn(),
  synchronizeOnline: vi.fn(),
  saveAuthorization: vi.fn(),
  ensureLocalEventSub: vi.fn(),
  useLocalEventSub: vi.fn(),
  oauthConfiguration: vi.fn(),
}));

vi.mock("@/integrations/server", () => ({
  TwitchOAuthClient: class {
    constructor(configuration: unknown) {
      mocks.oauthConfiguration(configuration);
    }

    connect(code: string) {
      return mocks.connect(code);
    }
  },
}));

vi.mock("@/app/server/studio-session", () => ({
  getStudioSessionApplication: () => ({
    startFromVerifiedTwitch: mocks.startFromVerifiedTwitch,
    synchronizeVerifiedTwitchOnline: mocks.synchronizeOnline,
  }),
}));

vi.mock("@/app/server/twitch-local-eventsub", () => ({
  ensureLocalTwitchEventSub: mocks.ensureLocalEventSub,
  shouldUseLocalTwitchEventSub: mocks.useLocalEventSub,
}));

vi.mock("@/app/server/twitch-local-authorization", () => ({
  TwitchLocalAuthorizationStore: class {
    save(input: unknown) {
      return mocks.saveAuthorization(input);
    }
  },
}));

import { GET } from "./route";

function callbackRequest(search: string, stateCookie = "csrf-state") {
  return new Request(`http://localhost:3000/api/twitch/oauth/callback?${search}`, {
    headers: { cookie: `chatxpt_twitch_oauth_state=${stateCookie}` },
  });
}

describe("Twitch OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TWITCH_CLIENT_SECRET", "existing-twitch-client-secret");
    mocks.useLocalEventSub.mockReturnValue(true);
    mocks.saveAuthorization.mockResolvedValue(undefined);
    mocks.ensureLocalEventSub.mockResolvedValue(undefined);
    mocks.connect.mockResolvedValue({
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: "27471",
      gameName: "Minecraft",
      grantedScopes: ["user:read:chat", "user:bot", "channel:bot"],
      tokenExpiresInSeconds: 3_600,
      stream: {
        status: "live",
        startedAt: 1_799_999_000_000,
      },
      authorization: {
        accessToken: "user-access-token",
        refreshToken: "user-refresh-token",
        expiresAt: 1_800_000_000_000,
      },
      eventSub: {
        status: "pending",
        subscriptionId: "eventsub-chat",
        subscriptionIds: ["eventsub-chat", "eventsub-online", "eventsub-offline"],
        detail: "pending",
      },
    });
    mocks.startFromVerifiedTwitch.mockResolvedValue({
      grant: "signed-studio-grant",
      expiresAt: 1_800_000_000_000,
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("exchanges verified Twitch identity for an authoritative Studio session cookie", async () => {
    const response = await GET(callbackRequest("code=oauth-code&state=csrf-state"));

    expect(mocks.connect).toHaveBeenCalledWith("oauth-code");
    expect(mocks.oauthConfiguration).toHaveBeenCalledWith(expect.objectContaining({
      eventSubTransport: "websocket",
      eventSubWebhookUrl: "http://localhost:3000/api/twitch/eventsub",
    }));
    expect(mocks.startFromVerifiedTwitch).toHaveBeenCalledWith({
      channelId: "broadcaster-1",
      displayName: "Streamer One",
      gameId: "27471",
      gameName: "Minecraft",
    });
    expect(mocks.synchronizeOnline).toHaveBeenCalledWith({
      broadcasterId: "broadcaster-1",
      displayName: "Streamer One",
      deliveryId: "oauth-live:broadcaster-1:1799999000000",
      occurredAt: 1_799_999_000_000,
    });
    expect(mocks.saveAuthorization).toHaveBeenCalledWith(expect.objectContaining({
      broadcasterId: "broadcaster-1",
      accessToken: "user-access-token",
      refreshToken: "user-refresh-token",
    }));
    expect(mocks.ensureLocalEventSub).toHaveBeenCalledWith("broadcaster-1");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/studio?oauth=connected&eventsub=configured",
    );
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("chatxpt_studio_session=signed-studio-grant");
    expect(cookie).toContain("chatxpt_twitch_connection=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).not.toContain("chatxpt_twitch_oauth_state=csrf-state");
  });

  it("rejects a callback whose state does not match before contacting Twitch", async () => {
    const response = await GET(callbackRequest("code=oauth-code&state=wrong-state"));

    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.startFromVerifiedTwitch).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/studio?oauth=error&reason=state",
    );
  });
});
