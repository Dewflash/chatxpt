import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { demoStudioIntegrationHealthView } from "./demo-integration-health";
import { StudioIntegrationHealthPanel, StudioIntegrationsHealth } from "./studio-integrations";

describe("Studio integrations health surface", () => {
  it("renders through the shared design-system boundary", () => {
    const html = renderToStaticMarkup(
      h(StudioIntegrationsHealth, { view: demoStudioIntegrationHealthView }),
    );

    expect(html).toContain('data-theme="twitch"');
    expect(html).toContain("ChatXPT Studio");
    expect(html).toContain("Integrations");
    expect(html).toContain("Demo blocked");
    expect(html).toContain("Evidence boundary");
    expect(html).toContain("fixture view");
    expect(html).toContain("Twitch app and Extension");
    expect(html).toContain("OBS capture and overlay");
  });

  it("exports the Role 1 mount wrapper without changing the rendered contract", () => {
    const html = renderToStaticMarkup(
      h(StudioIntegrationHealthPanel, { view: demoStudioIntegrationHealthView }),
    );

    expect(html).toContain("Runtime dependencies");
    expect(html).toContain("Supabase realtime and storage");
    expect(html).toContain("No, ChatXPT infrastructure");
  });
});
