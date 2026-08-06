// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TWITCH_EXTENSION_CONFIG_PATH,
  TWITCH_EXTENSION_LIVE_CONFIG_PATH,
  TWITCH_EXTENSION_VIEWER_PATH,
} from "../../src/integrations";
import { TwitchExtensionRouteShell } from "../../src/app";

describe("Twitch Extension route shells", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the viewer registration shell without requiring Twitch secrets", () => {
    render(<TwitchExtensionRouteShell surface="viewer" />);

    expect(screen.getByRole("heading", { name: "Viewer Quest Surface Reserved" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(TWITCH_EXTENSION_VIEWER_PATH))).toBeInTheDocument();
    expect(screen.getByText("Readiness")).toBeInTheDocument();
    expect(screen.getByText("setup required")).toBeInTheDocument();
    expect(screen.getByText("twitch-app: unavailable")).toBeInTheDocument();
    expect(screen.getByText("twitch-extension: unavailable")).toBeInTheDocument();
    expect(screen.getByText(/No Twitch secrets are included/)).toBeInTheDocument();
  });

  it("renders config and live config route shells for Twitch registration", () => {
    render(
      <>
        <TwitchExtensionRouteShell surface="config" />
        <TwitchExtensionRouteShell surface="live-config" />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Extension Config Surface Reserved" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Live Control Surface Reserved" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(TWITCH_EXTENSION_CONFIG_PATH))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(TWITCH_EXTENSION_LIVE_CONFIG_PATH))).toBeInTheDocument();
  });

  it("marks shells ready when Twitch app and Extension credentials are configured", () => {
    vi.stubEnv("TWITCH_CLIENT_ID", "fixture-client");
    vi.stubEnv("TWITCH_CLIENT_SECRET", "fixture-client-secret");
    vi.stubEnv("TWITCH_EXTENSION_CLIENT_ID", "fixture-extension");
    vi.stubEnv("TWITCH_EXTENSION_SECRET", "fixture-extension-secret");

    render(<TwitchExtensionRouteShell surface="viewer" />);

    expect(screen.getByText("ready")).toBeInTheDocument();
    const body = document.body.textContent ?? "";
    expect(body).not.toContain("fixture-client-secret");
    expect(body).not.toContain("fixture-extension-secret");
  });
});
