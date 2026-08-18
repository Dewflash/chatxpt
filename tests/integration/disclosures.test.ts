import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const disclosure = readFileSync("docs/THIRD_PARTY_DISCLOSURES.md", "utf8");

describe("third-party disclosures", () => {
  it("covers every package dependency used by the repository", () => {
    for (const dependency of Object.keys(packageJson.dependencies)) {
      expect(disclosure, `missing runtime dependency ${dependency}`).toContain(dependency);
    }
    for (const dependency of Object.keys(packageJson.devDependencies)) {
      expect(disclosure, `missing dev dependency ${dependency}`).toContain(dependency);
    }
  });

  it("keeps service and evidence limitations explicit", () => {
    for (const phrase of [
      "Twitch",
      "OBS",
      "Supabase Free",
      "Vercel",
      "`gpt-5.6-terra`",
      "existing prepaid/promotional credit",
      "falls back algorithmically",
      "Zero Data Retention",
      "No third-party datasets are bundled",
      "A passing fixture test is not live Twitch, OBS, cloud, or provider evidence",
    ]) {
      expect(disclosure).toContain(phrase);
    }
  });

  it("names non-MVP platforms as not implemented instead of supported", () => {
    const notImplementedSection = disclosure.split("## Not Implemented In The Twitch MVP")[1] ?? "";

    expect(notImplementedSection).toContain("YouTube");
    expect(notImplementedSection).toContain("Discord");
    expect(notImplementedSection).toContain("non-Twitch streaming adapter");
  });
});
