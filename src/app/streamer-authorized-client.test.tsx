import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  LocalPreviewAccountGate,
  twitchOauthErrorMessage,
} from "./streamer-authorized-client";

describe("LocalPreviewAccountGate", () => {
  it("renders an honest local account step before Twitch connection", () => {
    const html = renderToStaticMarkup(h(LocalPreviewAccountGate, {
      loading: false,
      onSignIn: () => undefined,
    }));

    expect(html).toContain("Demo account preview");
    expect(html).toContain("Sign in to ChatXPT");
    expect(html).toContain("streamer@chatxpt.local");
    expect(html).toContain("The preview password is not transmitted or stored.");
    expect(html).not.toContain("Connect Twitch");
  });
});

describe("twitchOauthErrorMessage", () => {
  it("explains missing product-owned Twitch application configuration", () => {
    expect(twitchOauthErrorMessage("misconfigured")).toContain(
      "no registered Twitch application ID and secret",
    );
    expect(twitchOauthErrorMessage("misconfigured")).not.toContain("channel ID");
  });
});
