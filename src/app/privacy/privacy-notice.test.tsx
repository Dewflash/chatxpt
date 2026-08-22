import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyNoticePage, { metadata } from "./page";

describe("public privacy notice", () => {
  it("publishes the Twitch, gameplay, participation, retention, and provider boundaries", () => {
    const html = renderToStaticMarkup(<PrivacyNoticePage />);

    expect(metadata.title).toContain("Privacy Notice");
    expect(html).toContain("Twitch-issued Extension authorization");
    expect(html).toContain("session-scoped pseudonymous participant key");
    expect(html).toContain("Raw OBS camera frames");
    expect(html).toContain("Raw Twitch chat text");
    expect(html).toContain("optional OpenAI provider");
    expect(html).toContain("never raw frames, raw chat, usernames, viewer identity, Twitch IDs, or credentials");
    expect(html).toContain("does not sell personal information");
    expect(html).toContain("not legal advice");
  });
});
