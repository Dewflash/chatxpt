import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot } from "../core";
import {
  contractFixtureUiX01ReadinessCatalog,
  contractFixtureUiX06RoleViewCatalog,
} from "../core/testing";
import { StudioProductPageSurface, type StudioProductPage } from "./studio-product-pages";
import { seedLocalFallbackProfile } from "./local-fallback-profile";

const pages: readonly StudioProductPage[] = [
  "home",
  "gameplay",
  "live-analytics",
  "live-quests",
  "profile",
  "stream-settings",
  "test-lab",
];

const pageLabels: Readonly<Record<StudioProductPage, string>> = {
  home: "Home",
  gameplay: "Gameplay Engine",
  "live-analytics": "Live Analytics",
  "live-quests": "Live Quests",
  profile: "Profile &amp; Defaults",
  "stream-settings": "Stream Settings",
  "test-lab": "Test Lab",
};

const requiredPageSections: Readonly<Record<StudioProductPage, readonly string[]>> = {
  home: ["Stream engagement", "Live Quests", "Chat Analytics", "Live surfaces", "Viewer Voting", "Broadcast Overlay"],
  gameplay: ["Overview", "Game Capture", "Understanding", "Health &amp; Recovery"],
  "live-analytics": ["Overview", "Activity", "Topics", "Session History"],
  "live-quests": ["Quest Status", "Recommendations", "Why", "Voting", "Results"],
  profile: ["Personality", "Stream Presets", "Community", "Safety &amp; Accessibility"],
  "stream-settings": ["Saved Source", "Session Override", "Reset to Saved"],
  "test-lab": ["Clean Start Reset", "Sample / Live Source", "Capture Controls", "Observed / Unknown", "Recovery"],
};

function twitchVerifiedReadiness() {
  return {
    ...contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    twitchAuthorization: "verified" as const,
  };
}

describe("StudioProductPageSurface", () => {
  it("renders the ICP-01 Studio route map with product-facing navigation", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"];
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view,
      readiness,
      viewerLiveSurface: h("div", { "data-test-live-surface": "viewer" }, "Canonical Twitch surface"),
      obsLiveSurface: h("div", { "data-test-live-surface": "overlay" }, "Canonical OBS surface"),
    }));

    expect(html).toContain("<strong>ChatXPT</strong><span>Streamer Studio</span>");
    expect(html).toContain("<strong>ChatXPT</strong><h1>Home</h1>");
    expect(html).toContain("Account");
    expect(html).toContain("Twitch");
    expect(html).toContain("Game Capture");
    expect(html).toContain("Gameplay Engine");
    expect(html).toContain("Live Analytics");
    expect(html).toContain("Live Quests");
    expect(html).toContain("Profile &amp; Defaults");
    expect(html).toContain("Stream Settings");
    expect(html).toContain("Test Lab");
    expect(html).toContain("Stream engagement");
    expect(html).toContain("What your stream sees");
    expect(html).toContain('data-live-surface-grid="public"');
    expect(html).toContain("Twitch Extension");
    expect(html).toContain("OBS Overlay");
    expect(html).toContain('data-live-surface="twitch-extension"');
    expect(html).toContain('data-test-live-surface="viewer"');
    expect(html).toContain('data-live-surface="obs-overlay"');
    expect(html).toContain('data-test-live-surface="overlay"');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tab"');
    expect(html).toContain("Viewer Voting");
    expect(html).toContain("Broadcast Overlay");
    expect(html).toContain('aria-label="Stream setup"');
    expect(html).toContain("Live Director</span><span");
    expect(html).toContain("<h3>Twitch</h3><span");
    expect(html).toContain("<h3>Game Capture</h3><span");
    expect(html).toContain("<h3>Viewer Voting</h3><span");
    expect(html).toContain("<h3>Broadcast Overlay</h3><span");
    expect(html.match(/homeSetupAction/g)).toHaveLength(4);
    expect(html).not.toContain("fixture");
    expect(html).not.toContain("Fixture");
    expect(html).not.toContain("tester");
    expect(html).not.toContain("Role ");
  });

  it("keeps Gameplay Engine and Studio navigation in the same tab", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "gameplay",
      view: null,
      readiness: null,
      children: h("p", null, "Gameplay connection controls"),
    }));

    expect(html).toContain("Gameplay connection controls");
    expect(html).toContain('href="/studio/gameplay"');
    expect(html).not.toContain('target="_blank"');
  });

  it("keeps one capture surface mounted in the background on other Studio pages", () => {
    const capture = h("p", { "data-test-capture": "persistent" }, "Persistent capture runtime");
    const gameplayHtml = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "gameplay",
      view: null,
      readiness: null,
      persistentGameplayCapture: capture,
    }));
    const analyticsHtml = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view: null,
      readiness: null,
      persistentGameplayCapture: capture,
    }));

    expect(gameplayHtml).toContain('data-studio-capture-visibility="visible"');
    expect(gameplayHtml).toContain("Persistent capture runtime");
    expect(analyticsHtml).toContain('data-studio-capture-visibility="background"');
    expect(analyticsHtml).toContain("Persistent capture runtime");
    expect(analyticsHtml).toContain("Audience reactions");
  });

  it("gives every persistent Studio navigation item a compact icon", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view: createFixtureUiGatewaySnapshot().views.streamer,
      readiness: twitchVerifiedReadiness(),
    }));

    for (const icon of ["home", "gameplay", "analytics", "quests", "profile", "settings", "lab"]) {
      expect(html).toContain(`data-studio-icon="${icon}"`);
    }
  });

  it.each(pages)("renders %s without a loaded session and keeps controls unavailable", (page) => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page,
      view: null,
      readiness: null,
    }));

    expect(html).toContain("Disconnected");
    expect(html).toContain("Game Capture");
    expect(html).toContain("None");
    expect(html).toContain(`<strong>ChatXPT</strong><h1>${pageLabels[page]}</h1>`);
    expect(html).not.toContain("Not live workflow evidence");
    expect(html).not.toContain("revision label");
    expect(html).not.toContain("Open diagnostics");
    expect(html).not.toContain("scheduled for");
  });

  it("centers connection status separately from the right-aligned account before page controls", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view: createFixtureUiGatewaySnapshot().views.streamer,
      readiness: twitchVerifiedReadiness(),
    }));
    const pageHeader = html.indexOf("<h1>Live Analytics</h1>");
    const connectionStatus = html.indexOf('aria-label="Studio connection status"');
    const twitch = html.indexOf("<dt>Twitch</dt>", connectionStatus);
    const capture = html.indexOf("<dt>Game Capture</dt>", connectionStatus);
    const account = html.indexOf(">Account<");
    const sectionControls = html.indexOf('aria-label="Live Analytics sections"');

    expect(pageHeader).toBeGreaterThan(-1);
    expect(connectionStatus).toBeGreaterThan(pageHeader);
    expect(twitch).toBeGreaterThan(connectionStatus);
    expect(capture).toBeGreaterThan(twitch);
    expect(account).toBeGreaterThan(capture);
    expect(sectionControls).toBeGreaterThan(account);
    expect(html).not.toContain("Understand audience activity during this stream.");
  });

  it("renders an active Twitch OAuth link before the Studio session exists", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view: null,
      readiness: null,
    }));

    expect(html).toContain('href="/api/twitch/oauth/start"');
    expect(html).toContain("Connect Twitch");
    expect(html).not.toContain("Connect Twitch to continue");
  });

  it("keeps Profile & Defaults editable from the established device fallback", () => {
    const local = seedLocalFallbackProfile("Local Streamer", 100);
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "profile",
      view: null,
      readiness: null,
      localProfile: local.profile,
      onLocalProfileChange: () => undefined,
    }));

    expect(html).toContain("Local profile · This device only");
    expect(html).toContain("Local Streamer");
    expect(html).toContain("Competitive");
    expect(html).toContain("Save default game");
    expect(html).toContain("Desktop Director");
    expect(html).toContain("When capture connects");
    expect(html).toContain('type="radio" name="desktopDirectorSetupMode" checked="" value="automatic"');
    expect(html).toContain('type="radio" name="desktopDirectorSetupMode" value="manual"');
    expect(html).toContain('<select name="gameProfile"');
    expect(html).toContain('<option value="minecraft">Minecraft</option>');
    expect(html).toContain('<option value="brawl-stars">Brawl Stars</option>');
    expect(html).toContain('<option value="generic" selected="">Generic game</option>');
    expect(html).toContain("Community");
    expect(html).toContain('type="radio" name="winnerActivationMode" checked="" value="automatic"');
    expect(html).toContain('type="radio" name="winnerActivationMode" value="streamer-approval"');
    expect(html).not.toContain("Extension with hosted board and chat fallbacks");
    const communityPanel = html.slice(html.indexOf('id="community"'), html.indexOf('id="safety-accessibility"'));
    expect(communityPanel).not.toContain("Viewer-led choices");
    expect(communityPanel).not.toContain("Preset description");
    expect(html).toContain("Saved on device");
    expect(html).toContain("Local profile");
    expect(html).toContain("This device only");
  });

  it("renders legacy profiles without desktop director preferences using the automatic default", () => {
    const local = seedLocalFallbackProfile("Legacy Local Streamer", 100);
    const legacyProfile: Partial<typeof local.profile> = { ...local.profile };
    delete legacyProfile.desktopDirector;
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "profile",
      view: null,
      readiness: null,
      localProfile: legacyProfile as typeof local.profile,
      onLocalProfileChange: () => undefined,
    }));

    expect(html).toContain("Desktop Director");
    expect(html).toContain(
      'type="radio" name="desktopDirectorSetupMode" checked="" value="automatic"',
    );
  });

  it("shows the effective quest activation mode on Home before the stream is live", () => {
    const local = seedLocalFallbackProfile("Local Streamer", 100);
    const automaticProfile = {
      ...local.profile,
      streamPresets: local.profile.streamPresets.map((preset) => preset.presetId === local.profile.selectedPresetId
        ? { ...preset, voting: { ...preset.voting, winnerActivationMode: "automatic" as const } }
        : preset),
    };
    const automaticHtml = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view: null,
      readiness: null,
      localProfile: automaticProfile,
    }));
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const manualView = {
      ...base,
      session: { ...base.session, status: "preparing" as const },
      profile: {
        ...base.profile,
        streamPresets: base.profile.streamPresets.map((preset) => preset.presetId === base.profile.selectedPresetId
          ? { ...preset, voting: { ...preset.voting, winnerActivationMode: "streamer-approval" as const } }
          : preset),
      },
    };
    const manualHtml = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view: manualView,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    expect(automaticHtml).toContain("<dt>Approval</dt><dd>Automatic</dd>");
    expect(manualHtml).toContain("<dt>Approval</dt><dd>Manual</dd>");
  });

  it("shows the local account inside Studio navigation instead of floating over content", () => {
    const local = seedLocalFallbackProfile("Local Streamer", 100);
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view: null,
      readiness: null,
      localProfile: local.profile,
      localAccountDisplayName: "Local Streamer",
      onLocalAccountSignOut: () => undefined,
    }));

    expect(html).toContain('aria-label="Local ChatXPT account"');
    expect(html).toContain("Sign out");
  });

  it("shows saved default and active Twitch game as separate settings", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = {
      ...base,
      profile: { ...base.profile, gameId: "brawl-stars", gameName: "Brawl Stars" },
      session: {
        ...base.session,
        currentGame: {
          gameId: "minecraft-java",
          gameName: "Minecraft Java Edition",
          source: "twitch" as const,
        },
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "stream-settings",
      view,
    }));

    expect(html).toContain("Default game: Brawl Stars");
    expect(html).toContain("Current stream: Minecraft Java Edition");
    expect(html).toContain("active game may still come from Twitch or Gameplay Capture");
  });

  it("keeps Stream Settings status in each segment header", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = {
      ...base,
      sessionOverride: {
        appliedAt: 1_787_459_200_000,
        presetId: "chill",
        experiencePatch: { intensity: 0.4 },
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "stream-settings",
      view,
    }));
    const savedSource = html.slice(html.indexOf('id="saved-source"'), html.indexOf('id="session-override"'));
    const sessionOverride = html.slice(html.indexOf('id="session-override"'), html.indexOf('id="reset-to-saved"'));
    const resetSaved = html.slice(html.indexOf('id="reset-to-saved"'));

    expect(savedSource.indexOf("Saved Source")).toBeLessThan(savedSource.indexOf("Saved defaults"));
    expect(sessionOverride.indexOf("Session Override")).toBeLessThan(sessionOverride.indexOf("Override active"));
    expect(resetSaved.indexOf("Reset to Saved")).toBeLessThan(resetSaved.indexOf("Override active"));
  });

  it("reports account, Twitch lifecycle, and profile persistence health independently", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const view = {
      ...snapshot.views.streamer,
      profileConnection: {
        accountStatus: "twitch-verified" as const,
        profileOrigin: "supabase" as const,
        persistenceStatus: "synced" as const,
        checkedAt: 1_000,
        lastPersistedAt: 900,
        message: "Twitch is verified and profile changes are saved to your account.",
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    expect(html).toContain("Twitch verified");
    expect(html).toContain("Twitch");
    expect(html).toContain("Saved to account");
  });

  it("uses the same page header and real capture source across Studio pages", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const gameplay = snapshot.views.streamer.gameplay;
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "live" as const },
      gameplay: gameplay === null ? null : {
        ...gameplay,
        envelope: { ...gameplay.envelope, source: "obs-virtual-camera" as const },
        signals: gameplay.signals.map((signal) => ({
          ...signal,
          observation: {
            ...signal.observation,
            provenance: { ...signal.observation.provenance, source: "obs-virtual-camera" as const },
          },
        })),
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    expect(html).toContain("<h1>Live Analytics</h1>");
    expect(html).toContain('data-state="live">Live</dd>');
    expect(html).toContain("OBS Capture");
  });

  it("labels a connected non-live Twitch session as Preparing and direct capture as Screen Capture", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const gameplay = snapshot.views.streamer.gameplay;
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "preparing" as const },
      gameplay: gameplay === null ? null : {
        ...gameplay,
        envelope: { ...gameplay.envelope, source: "browser-display-capture" as const },
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "gameplay",
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    expect(html).toContain('data-state="preparing">Preparing</dd>');
    expect(html).toContain("Screen Capture");
  });

  it("keeps Test Lab sample/live distinction outside ordinary product pages", () => {
    const home = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view: createFixtureUiGatewaySnapshot().views.streamer,
    }));
    const lab = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "test-lab",
      view: createFixtureUiGatewaySnapshot().views.streamer,
    }));

    expect(home).not.toContain("Sample checks and live source checks");
    expect(lab).toContain("Sample checks stay separate from live state");
    expect(lab).toContain("Start the entire ChatXPT test from the beginning");
    expect(lab).toContain("Reset ChatXPT to clean start");
    expect(lab).toContain("A direct browser tab cannot create a Twitch viewer identity");
    expect(lab).not.toContain('href="/viewer.html"');
  });

  it("keeps the clean-start reset available when Studio has no loaded session", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "test-lab",
      view: null,
      readiness: null,
      onResetSession: () => undefined,
    }));

    expect(html).toContain("Reset ChatXPT to clean start");
    expect(html).toContain("<button");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("shows Generate quest now while the authoritative cycle is idle", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = {
      ...base,
      session: { ...base.session, status: "preparing" as const },
      questCycle: {
        ...base.questCycle,
        status: "idle" as const,
        options: [],
        activeCandidateId: null,
        availableStreamerActions: [],
        voteTallies: [],
        startsAt: null,
        endsAt: null,
        progress: null,
        completionRule: null,
        result: null,
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-quests",
      view,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Generate quest now");
  });

  it("labels an immediate fallback as deterministic and evidence-free", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = {
      ...base,
      questCycle: {
        ...base.questCycle,
        status: "proposed" as const,
        options: base.questCycle.options.map((option) => ({
          ...option,
          sourceSignalIds: [],
          generation: {
            method: "deterministic-fallback" as const,
            provider: null,
            generatedAt: option.generation.generatedAt,
          },
        })),
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-quests",
      view,
    }));

    expect(html).toContain("Deterministic fallback");
    expect(html).not.toContain("Deterministic fallback shown");
    expect(html).not.toContain("without gameplay or audience evidence");
    expect(html).toContain("Why these were recommended");
    expect(html).toContain("Provider output becomes official only after deterministic validation.");
    expect(html).toContain("Generation status");
    expect(html).toContain("Select AI model");
    expect(html).toContain("AI model");
    expect(html).toContain("Presentation only. Quest generation still uses deterministic fallback.");
    expect(html).not.toContain("AI enabled · Preview only");
    expect(html).toContain("Mode: Automatic");
  });

  it("shows compact quest status with the effective profile and game boundaries", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = {
      ...base,
      session: {
        ...base.session,
        currentGame: {
          gameId: "minecraft-java",
          gameName: "Minecraft Java Edition",
          source: "streamer" as const,
        },
      },
      profile: {
        ...base.profile,
        restrictions: ["No jump scares"],
        forbiddenQuestTypes: ["team-sabotage"],
        accessibilityNeeds: ["No flashing prompts"],
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-quests",
      view,
    }));

    expect(html).toContain('<article id="quest-status"');
    expect(html).toContain("<h2>Quest Status</h2>");
    expect(html).not.toContain("<h2>Now</h2>");
    expect(html).toContain("Deterministic safety</dt><dd>Selected");
    expect(html).toContain("Game-fit boundary</dt><dd>Minecraft Java Edition selected");
    expect(html).toContain("Selected defaults</dt><dd>Community");
    expect(html).toContain("No jump scares");
    expect(html).toContain("Block Team Sabotage");
    expect(html).toContain("Accessibility: No flashing prompts");
  });

  it("shows the effective selected preset activation mode in Live Quests", () => {
    const base = createFixtureUiGatewaySnapshot().views.streamer;
    const view = {
      ...base,
      profile: {
        ...base.profile,
        voting: { ...base.profile.voting, winnerActivationMode: "streamer-approval" as const },
        streamPresets: base.profile.streamPresets.map((preset) => ({
          ...preset,
          voting: { ...preset.voting, winnerActivationMode: "streamer-approval" as const },
        })),
      },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-quests",
      view,
    }));

    expect(html).toContain("Mode: Manual");
    expect(html).not.toContain(">Proposed</span></div><div");
  });

  it("uses batch push in automatic mode and candidate selection only in manual mode", () => {
    const automaticView = contractFixtureUiX06RoleViewCatalog["r4.quest.proposed.v1"].streamer;
    const automaticHtml = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-quests",
      view: automaticView,
      onCommand: () => undefined,
    }));
    expect(automaticHtml).toContain("Push quests now");
    expect(automaticHtml.match(/Viewer option/gu)).toHaveLength(3);
    expect(automaticHtml).toContain("No streamer candidate pick is used");
    expect(automaticHtml).not.toContain('aria-pressed="true"');

    const manualView = {
      ...automaticView,
      profile: {
        ...automaticView.profile,
        voting: {
          ...automaticView.profile.voting,
          winnerActivationMode: "streamer-approval" as const,
        },
        streamPresets: automaticView.profile.streamPresets.map((preset) => ({
          ...preset,
          voting: { ...preset.voting, winnerActivationMode: "streamer-approval" as const },
        })),
      },
    };
    const manualHtml = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-quests",
      view: manualView,
      onCommand: () => undefined,
    }));
    expect(manualHtml).toContain("Start selected quest");
    expect(manualHtml).toContain('aria-pressed="true"');
    expect(manualHtml).not.toContain("Push quests now");
  });

  it.each(pages)("renders the required ICP-01 sections for %s", (page) => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page,
      view: createFixtureUiGatewaySnapshot().views.streamer,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    for (const section of requiredPageSections[page]) {
      expect(html).toContain(section);
    }
  });

  it("renders compact truthful Live Analytics without duplicating Live Quests", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view: createFixtureUiGatewaySnapshot().views.streamer,
      readiness: twitchVerifiedReadiness(),
    }));

    expect(html).toContain('data-analytics-metric="audience-mood"');
    expect(html).toContain('data-analytics-metric="chat-activity"');
    expect(html).toContain('data-analytics-metric="active-participants"');
    expect(html).toContain('data-analytics-metric="quest-participation"');
    expect(html).toContain("Previous equal window");
    expect(html).toContain("Current window");
    expect(html).toContain("Audience reactions");
    expect(html).not.toContain("What the audience is reacting to");
    expect(html).toContain("Participation flow");
    expect(html).toContain("Quest result");
    expect(html).toContain("Open Live Quests");
    expect(html).not.toContain("Exactly three official choices");
    expect(html).not.toContain("Data health");
    expect(html).not.toContain("Current rolling aggregates update during this stream");
  });

  it("links Gameplay Engine capture setup to the Studio product route", () => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "gameplay",
      view: createFixtureUiGatewaySnapshot().views.streamer,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    expect(html).toContain('href="/studio/gameplay"');
    expect(html).not.toContain("/studio/gameplay/capture");
    expect(html).not.toContain("/diagnostics/gameplay-extraction");
  });

  it("renders the blocked Home composition without dispatchable start controls", () => {
    const view = createFixtureUiGatewaySnapshot().views.streamer;
    const readiness = contractFixtureUiX01ReadinessCatalog["r4.setup.permission-denied.v1"];
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view,
      readiness,
      onCommand: () => undefined,
    }));

    expect(html).toContain("Resolve the highlighted setup blocker so ChatXPT can monitor the stream.");
    expect(html).toContain("Waiting for Twitch stream");
    expect(html).toContain('href="/studio/gameplay"');
    expect(html).toContain("Allow camera");
    expect(html).not.toContain("<button");
  });

  it("renders live Home as stream control instead of setup start", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "live" as const },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
      onCommand: () => undefined,
    }));

    expect(html).toContain("Live Director · OBS + Game Engine");
    expect(html).toContain("End unavailable");
    expect(html).toContain("Open quests");
  });

  it("renders the connected waiting-for-Twitch composition without a manual start", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "offline" as const },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "home",
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
      onCommand: () => undefined,
    }));

    expect(html).toContain("Twitch connected — waiting for the stream");
    expect(html).toContain("Change stream game");
    expect(html).toContain("Waiting for Twitch stream");
    expect(html).not.toContain("Start ChatXPT");
  });

  it("distinguishes a disconnected Twitch account from configured server credentials", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "live" as const },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view,
      readiness: contractFixtureUiX01ReadinessCatalog["r4.setup.ready.v1"],
    }));

    expect(html).toContain("Twitch disconnected");
    expect(html).toContain("Connect Twitch to receive authorised chat activity.");
    expect(html).not.toContain("Try the quieter route");
  });

  it("distinguishes a connected but offline stream from live chat", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "offline" as const },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view,
      readiness: twitchVerifiedReadiness(),
    }));

    expect(html).toContain("Stream offline");
    expect(html).toContain("Twitch is connected. Chat analytics starts when the stream goes live.");
    expect(html).not.toContain("Try the quieter route");
  });

  it("distinguishes a live stream awaiting its first authorised chat message", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "live" as const },
      audience: null,
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view,
      readiness: twitchVerifiedReadiness(),
    }));

    expect(html).toContain("Live · waiting for chat");
    expect(html).toContain("Waiting for the first authorised Twitch chat message.");
    expect(html).toContain("0 active participants");
  });

  it("distinguishes current chat from a stale audience snapshot", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const currentView = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "live" as const },
      audience: {
        ...snapshot.views.streamer.audience!,
        envelope: {
          ...snapshot.views.streamer.audience!.envelope,
          occurredAt: snapshot.views.streamer.envelope.receivedAt,
          receivedAt: snapshot.views.streamer.envelope.receivedAt,
        },
      },
    };
    const staleView = {
      ...currentView,
      audience: {
        ...currentView.audience,
        envelope: {
          ...currentView.audience.envelope,
          occurredAt: snapshot.views.streamer.envelope.receivedAt - 31_000,
          receivedAt: snapshot.views.streamer.envelope.receivedAt - 31_000,
        },
      },
    };
    const currentHtml = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view: currentView,
      readiness: twitchVerifiedReadiness(),
    }));
    const staleHtml = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view: staleView,
      readiness: twitchVerifiedReadiness(),
    }));

    expect(currentHtml).toContain("Listening");
    expect(staleHtml).toContain("Live · no recent chat");
    expect(staleHtml).toContain("If viewers are chatting, reconnect Twitch chat.");
    expect(staleHtml).not.toContain("Try the quieter route");
  });

  it("does not present retained audience data as live after the stream ends", () => {
    const snapshot = createFixtureUiGatewaySnapshot();
    const view = {
      ...snapshot.views.streamer,
      session: { ...snapshot.views.streamer.session, status: "ended" as const },
    };
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page: "live-analytics",
      view,
      readiness: twitchVerifiedReadiness(),
    }));

    expect(html).toContain("Stream ended");
    expect(html).toContain("Live chat analytics stopped when this stream ended.");
    expect(html).toContain("Open Stream History for retained results");
    expect(html).not.toContain("Try the quieter route");
  });
});
