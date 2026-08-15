import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = "twitch-extension";
const htmlFiles = ["viewer.html", "config.html", "live-config.html"] as const;
const twitchHelperUrl = "https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js";
const releasePackage = "release/chatxpt-twitch-extension-finals.zip";

function readAsset(path: string): string {
  return readFileSync(join(process.cwd(), packageRoot, path), "utf8");
}

describe("Twitch Extension upload package", () => {
  it("ships only hostable assets in the release archive", () => {
    const archive = readFileSync(join(process.cwd(), releasePackage));
    const expectedEntries = [
      "viewer.html",
      "config.html",
      "live-config.html",
      "assets/extension.css",
      "assets/environment.js",
      "assets/viewer.js",
    ];

    for (const entry of expectedEntries) {
      expect(archive.includes(Buffer.from(entry))).toBe(true);
    }
    expect(archive.includes(Buffer.from("README.md"))).toBe(false);
  });

  it("contains root-level html paths required by Twitch Asset Hosting", () => {
    for (const file of htmlFiles) {
      const source = readAsset(file);

      expect(source).toContain("<!doctype html>");
      expect(source).toContain('href="assets/extension.css"');
      expect(source).toContain("ChatXPT");
    }
  });

  it("keeps upload files CSP-friendly for Twitch hosting", () => {
    for (const file of htmlFiles) {
      const source = readAsset(file);
      const scriptSources = Array.from(
        source.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/gi),
        (match) => match[1],
      );
      const expectedScripts =
        file === "viewer.html"
          ? [twitchHelperUrl, "assets/environment.js", "assets/viewer.js"]
          : [twitchHelperUrl];

      expect(scriptSources).toEqual(expectedScripts);
      expect(source.indexOf("<script")).toBeLessThan(source.indexOf('href="assets/extension.css"'));
      expect(source).not.toMatch(/<script(?![^>]*src="(?:https:\/\/extension-files\.twitch\.tv\/helper\/v1\/twitch-ext\.min\.js|assets\/environment\.js|assets\/viewer\.js)"[^>]*><\/script>)/i);
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

  it("binds JWT egress to a build-owned EBS origin and does not overclaim Twitch evidence", () => {
    const readme = readAsset("README.md");
    const combinedHtml = htmlFiles.map((file) => readAsset(file)).join("\n");
    const viewerJs = readAsset("assets/viewer.js");
    const environmentJs = readAsset("assets/environment.js");

    expect(readme).toContain("do not by themselves prove a real Twitch Local Test");
    expect(readme).toContain("Twitch Extension Helper");
    expect(readme).toContain("bearer token must never be redirectable");
    expect(environmentJs).toContain('ebsOrigin: "https://localhost:3000"');
    expect(environmentJs).not.toContain("location.search");
    expect(viewerJs).toContain("onAuthorized");
    expect(viewerJs).toContain("/api/twitch/extension/viewer");
    expect(viewerJs).toContain("/api/twitch/extension/commands");
    expect(viewerJs).toContain("authorization: `Bearer ${token}`");
    expect(viewerJs).not.toContain("/api/demo-participation");
    expect(viewerJs).not.toContain("localStorage");
    expect(viewerJs).not.toContain("voterKey");
    expect(combinedHtml).toContain("Vote for the sidequest");
    expect(combinedHtml).not.toContain("Role 1");
    expect(combinedHtml).not.toContain("Role 4");
    expect(combinedHtml).not.toContain("Role 5");
  });
});
