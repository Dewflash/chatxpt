import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudioGameplayCaptureClient } from "./StudioGameplayCaptureClient";

describe("StudioGameplayCaptureClient recovery navigation", () => {
  it("shows only connection controls until capture starts and never opens a new Studio tab", () => {
    const html = renderToStaticMarkup(h(StudioGameplayCaptureClient));

    expect(html).toContain("Connect capture");
    expect(html).toContain("Select Screen or Window");
    expect(html).toContain("Connect OBS Virtual Camera");
    expect(html).toContain("Both choices use the same local gameplay analysis engine.");
    expect(html).toContain("Current selected source");
    expect(html).toContain("None selected — select a screen or window");
    expect(html).toContain("autoPlay=\"\"");
    expect(html).toContain("After you connect, this preview shows the exact feed ChatXPT analyzes.");
    expect(html).not.toContain("Live detector proof");
    expect(html).not.toContain("Gameplay Capture status");
    expect(html).not.toContain("Detected Game Facts");
    expect(html).toContain('<a href="/studio">Back to Studio home</a>');
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain("Open Gameplay Engine in another tab");
  });
});
