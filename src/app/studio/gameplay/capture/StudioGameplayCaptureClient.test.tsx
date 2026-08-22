import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudioGameplayCaptureClient } from "./StudioGameplayCaptureClient";

describe("StudioGameplayCaptureClient recovery navigation", () => {
  it("shows game-aware detector columns before compact stopped capture controls", () => {
    const html = renderToStaticMarkup(h(StudioGameplayCaptureClient));

    expect(html).toContain("Live Detector Proof");
    expect(html).toContain("Generic profile");
    expect(html).toContain('id="proof-condition"');
    expect(html).toContain('id="proof-activity"');
    expect(html).toContain('id="proof-environment"');
    expect(html).toContain('id="proof-others"');
    expect(html).toContain("Player condition");
    expect(html).toContain("Coming soon");
    expect(html).toContain("Stream Capture");
    expect(html).toContain("Stream Capture instructions");
    expect(html).toContain('role="tooltip"');
    expect(html).toContain("Select the matching game profile.");
    expect(html).toContain("Select Screen or Window");
    expect(html).toContain("Connect OBS Virtual Camera");
    expect(html).not.toContain("Stop capture");
    expect(html).toContain("Current selected source");
    expect(html).toContain("None");
    expect(html).toContain("Current Studio session");
    expect(html).toContain("Game profile");
    expect(html).toContain('<option value="minecraft">Minecraft</option>');
    expect(html).toContain('<option value="brawl-stars">Brawl Stars</option>');
    expect(html).toContain('<option value="generic" selected="">Generic game</option>');
    expect(html).toContain("autoPlay=\"\"");
    expect(html).toContain("Last successful capture: None");
    expect(html.indexOf("Current Studio session")).toBeLessThan(html.indexOf("Game profile"));
    expect(html.indexOf("Game profile")).toBeLessThan(html.indexOf("Select Screen or Window"));
    expect(html.indexOf("Live Detector Proof")).toBeLessThan(html.indexOf("Stream Capture"));
    expect(html).not.toContain("Gameplay Capture status");
    expect(html).not.toContain("Detected Game Facts");
    expect(html).not.toContain("This page connects the product capture path");
    expect(html).not.toContain("Returning here lets you reconnect it");
    expect(html).not.toContain('target="_blank"');
  });
});
