import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = "twitch-extension";
const htmlFiles = ["viewer.html", "config.html", "live-config.html"] as const;
const twitchHelperUrl = "https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js";

function readAsset(path: string): string {
  return readFileSync(join(process.cwd(), packageRoot, path), "utf8");
}

describe("Twitch Extension upload package", () => {
  it("contains root-level html paths required by Twitch Asset Hosting", () => {
    for (const file of htmlFiles) {
      const source = readAsset(file);

      expect(source).toContain("<!doctype html>");
      expect(source).toContain('href="assets/extension.css"');
      expect(source).toContain("ChatXPT");
    }
  });

  it("keeps upload shells CSP-friendly for Twitch hosting", () => {
    for (const file of htmlFiles) {
      const source = readAsset(file);
      const scriptSources = Array.from(
        source.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/gi),
        (match) => match[1],
      );

      expect(scriptSources).toEqual([twitchHelperUrl]);
      expect(source.indexOf("<script")).toBeLessThan(source.indexOf('href="assets/extension.css"'));
      expect(source).not.toMatch(/<script(?![^>]*src="https:\/\/extension-files\.twitch\.tv\/helper\/v1\/twitch-ext\.min\.js"[^>]*><\/script>)/i);
      expect(source).not.toMatch(/\sstyle=/i);
      expect(source).not.toMatch(/<style\b/i);
      expect(source.match(/https?:\/\//g)).toEqual(["https://"]);
    }
  });

  it("keeps the stylesheet local and free of external requests", () => {
    const css = readAsset("assets/extension.css");

    expect(css).toContain(".shell");
    expect(css).not.toMatch(/@import/i);
    expect(css).not.toMatch(/url\(/i);
    expect(css).not.toMatch(/https?:\/\//i);
  });

  it("labels the package as a setup shell, not live Twitch evidence", () => {
    const readme = readAsset("README.md");
    const combinedHtml = htmlFiles.map((file) => readAsset(file)).join("\n");

    expect(readme).toContain("path-validation shell only");
    expect(readme).toContain("does not claim live viewer voting");
    expect(readme).toContain("Twitch Extension Helper");
    expect(combinedHtml).toContain("Setup shell");
    expect(combinedHtml).not.toContain("Role 1");
    expect(combinedHtml).not.toContain("Role 4");
    expect(combinedHtml).not.toContain("Role 5");
  });
});
