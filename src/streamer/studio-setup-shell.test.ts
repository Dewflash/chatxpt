import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { contractFixtureStreamerView } from "../core/testing";
import { StudioSetupShell, type StudioSetupShellProps } from ".";

function render(props: Partial<StudioSetupShellProps> = {}): string {
  return renderToStaticMarkup(
    h(StudioSetupShell, {
      view: contractFixtureStreamerView,
      experience: "first-time",
      ...props,
    }),
  );
}

describe("StudioSetupShell", () => {
  it("keeps preview state visibly separate from live readiness", () => {
    const html = render();

    expect(html).toContain("Preview only");
    expect(html).toContain("Live connection not confirmed");
    expect(html).not.toContain("Fixture preview");
    expect(html).not.toContain("Not live workflow evidence");
    expect(html).toContain("Overall readiness unconfirmed");
    expect(html).toContain("Start session");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Start session/su);
    expect(html).not.toContain("Ready to stream");
    expect(html).toContain("No readiness score");
    expect(html).not.toMatch(/\b\d+% ready\b/iu);
  });

  it("renders only the service health supplied by the Studio view", () => {
    const html = render({
      view: {
        ...contractFixtureStreamerView,
        services: [
          {
            service: "twitch-setup",
            status: "misconfigured",
            checkedAt: 1_786_000_000_000,
            message: "Extension registration is incomplete.",
            retryable: false,
          },
          {
            service: "obs-capture",
            status: "permission-denied",
            checkedAt: 1_786_000_001_000,
            message: "Camera permission is required.",
            retryable: true,
          },
        ],
      },
    });

    expect(html).toContain("Twitch Setup");
    expect(html).toContain("Needs setup");
    expect(html).toContain("Extension registration is incomplete.");
    expect(html).toContain("Obs Capture");
    expect(html).toContain("Permission denied");
    expect(html).toContain("Retry permitted");
    expect(html).toContain("Actions are unavailable for now");
  });

  it("handles out-of-range observation times without failing the shell", () => {
    const html = render({
      view: {
        ...contractFixtureStreamerView,
        services: [
          {
            ...contractFixtureStreamerView.services[0],
            checkedAt: Number.MAX_SAFE_INTEGER,
          },
        ],
      },
    });

    expect(html).toContain("Time unavailable");
    expect(html).toContain("Overall readiness unconfirmed");
  });

  it("shows a guided sequence without deriving completed steps", () => {
    const html = render({
      activeStep: "capture",
      completedSteps: ["welcome", "twitch"],
      onSelectStep: () => undefined,
    });

    expect(html).toContain('aria-current="step"');
    expect(html).toContain('data-state="complete"');
    expect(html).toContain('data-state="current"');
    expect(html).toContain('data-state="upcoming"');
    expect(html).toContain("Use a raw-game Virtual Camera scene");
  });

  it("groups saved preferences and keeps AI detail expandable", () => {
    const html = render({ experience: "returning" });

    expect(html).toContain("Welcome back, Fixture Streamer");
    expect(html).toContain("Game");
    expect(html).toContain("Streamer style");
    expect(html).toContain("Quest intensity");
    expect(html).toContain("Safety &amp; restrictions");
    expect(html).toContain("Accessibility");
    expect(html).toContain("Universal Visual");
    expect(html).toContain("Activity Intensity");
    expect(html).toContain("Unknown");
    expect(html).toContain("Confidence");
    expect(html).toContain("Sidequest generation status is not reported yet");
  });

  it("renders an honest loading state without a fabricated snapshot", () => {
    const html = render({ view: null, loading: true });

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading Studio status");
    expect(html).toContain("Checking your Studio snapshot");
    expect(html).not.toContain("Readiness checklist");
    expect(html).not.toContain("Saved profile");
  });

  it("retains the last Studio state while reconnecting but leaves actions unavailable", () => {
    const html = render({ reconnecting: true });

    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("The last Studio state remains visible");
    expect(html).not.toContain("Revision 0");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Start session/su);
  });

  it("exposes labelled navigation and the current page without requiring route ownership", () => {
    const html = render({ onNavigate: () => undefined });

    expect(html).toContain('aria-label="Studio sections"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Setup");
    expect(html).toContain("Profile");
    expect(html).toContain("Live quests");
    expect(html).toContain("Test Lab");
  });
});
