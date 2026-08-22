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
      onConnectTwitchWithoutAccount: () => undefined,
    }));

    expect(html).toContain("Demo account preview");
    expect(html).toContain("Sign in to ChatXPT");
    expect(html).toContain("streamer@chatxpt.local");
    expect(html).toContain("The preview password is not transmitted or stored.");
    expect(html).toContain("Connect Twitch without demo account");
    expect(html).toContain("does not create a Studio session or connect Twitch");
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
  it("clears session capture state without logging out or changing the chosen app-login path", () => {
    const storage = memoryStorage({
      "chatxpt.local-preview-account.v1": "preview",
      "chatxpt.local-preview-account-bypass.v1": "true",
      "chatxpt.studio.gameplayCapture.v1": "capture",
      "chatxpt.unrelated": "keep",
    });

    clearCleanStartBrowserState(storage);

    expect(storage.getItem("chatxpt.local-preview-account.v1")).toBe("preview");
    expect(storage.getItem("chatxpt.local-preview-account-bypass.v1")).toBe("true");
    expect(storage.getItem("chatxpt.studio.gameplayCapture.v1")).toBeNull();
    expect(storage.getItem("chatxpt.unrelated")).toBe("keep");
  });
});
