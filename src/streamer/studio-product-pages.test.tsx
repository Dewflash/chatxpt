import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createFixtureUiGatewaySnapshot } from "../core";
import { contractFixtureUiX01ReadinessCatalog } from "../core/testing";
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

const requiredPageSections: Readonly<Record<StudioProductPage, readonly string[]>> = {
  home: ["Stream engagement", "Live Quests", "Chat Analytics", "Live surfaces", "Viewer Voting", "Broadcast Overlay"],
  gameplay: ["Overview", "Game Capture", "Understanding", "Health &amp; Recovery"],
  "live-analytics": ["Overview", "Activity", "Topics", "Session History"],
  "live-quests": ["Now", "Recommendations", "Why", "Voting", "Results"],
  profile: ["Personality", "Stream Presets", "Safety", "Accessibility"],
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
    }));

    expect(html).toContain("ChatXPT");
    expect(html).toContain("<h1>Get ChatXPT ready for this stream</h1>");
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
    expect(html).toContain("Viewer Voting");
    expect(html).toContain("Broadcast Overlay");
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

  it.each(pages)("renders %s without a loaded session and keeps controls unavailable", (page) => {
    const html = renderToStaticMarkup(h(StudioProductPageSurface, {
      page,
      view: null,
      readiness: null,
    }));

    expect(html).toContain("Disconnected");
    expect(html).toContain("Game Capture");
    expect(html).toContain("None");
    expect(html).not.toContain("Not live workflow evidence");
    expect(html).not.toContain("revision label");
    expect(html).not.toContain("Open diagnostics");
    expect(html).not.toContain("scheduled for");
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
    expect(html).toContain("Saved on device");
    expect(html).toContain("Local profile");
    expect(html).toContain("This device only");
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

    expect(html).toContain("Deterministic fallback shown");
    expect(html).toContain("without gameplay or audience evidence");
    expect(html).toContain("Evidence-driven recommendations use trusted signals later");
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
