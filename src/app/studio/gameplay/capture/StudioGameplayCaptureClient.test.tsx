import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot } from "@/core";

import {
  DESKTOP_DIRECTOR_OPEN_URL,
  requestAutomaticDesktopDirectorOpen,
  StudioGameplayCaptureClient,
} from "./StudioGameplayCaptureClient";

describe("StudioGameplayCaptureClient recovery navigation", () => {
  it("shows game-aware detector columns before compact stopped capture controls", () => {
    const html = renderToStaticMarkup(h(StudioGameplayCaptureClient));

    expect(html).toContain("Live Detector Proof");
    expect(html).toContain('id="overview"');
    expect(html).toContain("Generic profile");
    expect(html).toContain('id="proof-condition"');
    expect(html).toContain('id="proof-activity"');
    expect(html).toContain('id="proof-environment"');
    expect(html).toContain('id="proof-others"');
    expect(html).toContain("Activity intensity");
    expect(html).toContain("Connect a gameplay feed first.");
    expect(html).toContain("<dt>Activity intensity</dt><dd>—</dd>");
    expect(html).not.toContain("Waiting for a captured feed");
    expect(html).not.toContain("Planned reads");
    expect(html).not.toContain("Coming soon");
    expect(html).toContain("Stream Capture");
    expect(html).toContain('id="stream-capture"');
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
    expect(html).toContain("Capture Stats");
    expect(html).toContain('id="capture-stats"');
    expect(html.indexOf("Stream Capture")).toBeLessThan(html.indexOf("Capture Stats"));
    expect(html).toContain('id="capture-stats-connection"');
    expect(html).toContain('id="capture-stats-processing"');
    expect(html).toContain('id="capture-stats-gameplay"');
    expect(html).toContain('id="capture-stats-others"');
    expect(html).toContain("Capture health");
    expect(html).toContain("Snapshots accepted");
    expect(html).toContain("Frames analysed");
    expect(html).toContain("Gameplay activity");
    expect(html).toContain("Detected game facts");
    expect(html).toContain("Capture source");
    expect(html).not.toContain("Gameplay Capture status");
    expect(html).not.toContain("This page connects the product capture path");
    expect(html).not.toContain("Returning here lets you reconnect it");
    expect(html).not.toContain('target="_blank"');
  });

  it("opens the already-linked desktop director only for automatic capture setup", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const opened: string[] = [];

    expect(requestAutomaticDesktopDirectorOpen(view, (url) => opened.push(url))).toBe(true);
    expect(opened).toEqual([DESKTOP_DIRECTOR_OPEN_URL]);

    const manualView = {
      ...view,
      profile: {
        ...view.profile,
        desktopDirector: { setupMode: "manual" as const },
      },
    };
    expect(requestAutomaticDesktopDirectorOpen(manualView, (url) => opened.push(url))).toBe(false);
    expect(opened).toEqual([DESKTOP_DIRECTOR_OPEN_URL]);
  });

  it("keeps capture setup safe for legacy profiles and failed desktop protocol launches", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const legacyProfile: Partial<typeof view.profile> = { ...view.profile };
    delete legacyProfile.desktopDirector;
    const legacyView = {
      ...view,
      profile: legacyProfile,
    } as unknown as typeof view;
    const opened: string[] = [];

    expect(requestAutomaticDesktopDirectorOpen(legacyView, (url) => opened.push(url))).toBe(true);
    expect(opened).toEqual([DESKTOP_DIRECTOR_OPEN_URL]);
    expect(requestAutomaticDesktopDirectorOpen(view, () => {
      throw new Error("Desktop protocol unavailable");
    })).toBe(false);
  });
});
