import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  contractFixtureCandidateBatch,
  contractFixtureStreamerView,
} from "../core/testing";
import { streamerViewModelSchema } from "../core";
import { StudioStatusSurface } from "./studio-status";

const options = contractFixtureCandidateBatch.candidates;

describe("StudioStatusSurface", () => {
  it("renders a safe loading state without implying readiness", () => {
    const html = renderToStaticMarkup(h(StudioStatusSurface, { view: null }));

    expect(html).toContain("Loading Studio snapshot");
    expect(html).not.toContain("Demo ready");
    expect(html).not.toContain("Ready to stream");
  });

  it("lists service health individually instead of deriving an overall ready verdict", () => {
    const view = streamerViewModelSchema.parse({
      ...contractFixtureStreamerView,
      services: [
        {
          service: "twitch",
          status: "misconfigured",
          checkedAt: contractFixtureStreamerView.envelope.occurredAt,
          retryable: true,
          message: "OAuth callback is not configured.",
        },
        {
          service: "obs-capture",
          status: "ready",
          checkedAt: contractFixtureStreamerView.envelope.occurredAt,
          retryable: false,
          message: "OBS Virtual Camera is visible.",
        },
      ],
    });
    const html = renderToStaticMarkup(h(StudioStatusSurface, { view }));

    expect(html).toContain("Integration health");
    expect(html).toContain("twitch");
    expect(html).toContain("misconfigured");
    expect(html).toContain("OAuth callback is not configured.");
    expect(html).toContain("obs-capture");
    expect(html).toContain("No overall readiness score is derived in this UI.");
    expect(html).not.toContain("Demo blocked");
    expect(html).not.toContain("Demo ready");
  });

  it("summarises gameplay and audience evidence without relabelling fixtures as live", () => {
    const html = renderToStaticMarkup(h(StudioStatusSurface, { view: contractFixtureStreamerView }));

    expect(html).toContain("Signals");
    expect(html).toContain("Gameplay");
    expect(html).toContain("Audience");
    expect(html).toContain("fixture");
    expect(html).toContain("Unknown facts stay unknown");
    expect(html).not.toContain(">live</span>");
  });

  it("renders exactly three proposed quest options and available actions from authority", () => {
    const view = streamerViewModelSchema.parse({
      ...contractFixtureStreamerView,
      session: {
        ...contractFixtureStreamerView.session,
        status: "live",
      },
      questCycle: {
        ...contractFixtureStreamerView.questCycle,
        status: "proposed",
        options,
        availableStreamerActions: ["approve", "reject"],
      },
    });
    const html = renderToStaticMarkup(h(StudioStatusSurface, { view }));

    for (const option of options) {
      expect(html).toContain(option.title);
    }
    expect(html).toContain("Available actions: approve, reject");
  });

  it("announces emergency pause as the dominant live-control state", () => {
    const view = streamerViewModelSchema.parse({
      ...contractFixtureStreamerView,
      emergencyPaused: true,
    });
    const html = renderToStaticMarkup(h(StudioStatusSurface, { view }));

    expect(html).toContain("Emergency pause active");
    expect(html).toContain('role="alert"');
  });
});
