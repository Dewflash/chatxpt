import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  clearCleanStartBrowserState,
  LocalPreviewAccountGate,
  twitchOauthErrorMessage,
} from "./streamer-authorized-client";

function memoryStorage(initial: Record<string, string>): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("LocalPreviewAccountGate", () => {
  it("renders an honest local account step before Twitch connection", () => {
    const html = renderToStaticMarkup(h(LocalPreviewAccountGate, {
      loading: false,
      onSignIn: () => undefined,
    }));

    expect(html).toContain("Demo account preview");
    expect(html).toContain("Sign in to ChatXPT");
    expect(html).toContain("streamer@chatxpt.local");
    expect(html).toContain("Local Streamer");
    expect(html).toContain("chatxpt-demo");
    expect(html).toContain("The preview password is not transmitted or stored.");
    expect(html).toContain("must be completed before connecting Twitch or entering Studio");
    expect(html).not.toContain("Connect Twitch without demo account");
  });
});

describe("twitchOauthErrorMessage", () => {
  it("explains missing product-owned Twitch application configuration", () => {
    expect(twitchOauthErrorMessage("misconfigured")).toContain(
      "no registered Twitch application ID and secret",
    );
    expect(twitchOauthErrorMessage("misconfigured")).not.toContain("channel ID");
  });

  it("explains an invalid secret without blaming the redirect URL", () => {
    expect(twitchOauthErrorMessage("secret-mismatch")).toContain("application secret is invalid");
    expect(twitchOauthErrorMessage("secret-mismatch")).not.toContain("callback URL");
  });
});

describe("clearCleanStartBrowserState", () => {
  it("clears the demo account, legacy bypass, and capture preference for a real clean start", () => {
    const storage = memoryStorage({
      "chatxpt.local-preview-account.v1": "preview",
      "chatxpt.local-preview-account-bypass.v1": "true",
      "chatxpt.studio.gameplayCapture.v1": "capture",
      "chatxpt.unrelated": "keep",
    });

    clearCleanStartBrowserState(storage);

    expect(storage.getItem("chatxpt.local-preview-account.v1")).toBeNull();
    expect(storage.getItem("chatxpt.local-preview-account-bypass.v1")).toBeNull();
    expect(storage.getItem("chatxpt.studio.gameplayCapture.v1")).toBeNull();
    expect(storage.getItem("chatxpt.unrelated")).toBe("keep");
  });
});
