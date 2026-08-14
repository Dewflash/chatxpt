import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const secretNamePattern =
  /(SUPABASE_(SECRET_KEY|SERVICE_ROLE_KEY)|TWITCH_(CLIENT_SECRET|EXTENSION_SECRET)|CHATXPT_(OBS_OVERLAY|GAMEPLAY_INGRESS)_SETUP_KEY|OPENAI_API_KEY)/;
const fixtureSecretValuePattern =
  /(sb_secret_|service-role|client-secret|extension-secret|overlay-secret|sk-[A-Za-z0-9])/i;

function readText(path: string) {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("Role 1 Vercel preview configuration", () => {
  it("pins the Vercel project to the repository build commands without committed env values", () => {
    const config = JSON.parse(readText("vercel.json")) as {
      framework?: unknown;
      installCommand?: unknown;
      buildCommand?: unknown;
      env?: unknown;
      build?: { env?: unknown };
    };

    expect(config.framework).toBe("nextjs");
    expect(config.installCommand).toBe("npm ci");
    expect(config.buildCommand).toBe("npm run build");
    expect(config.env).toBeUndefined();
    expect(config.build?.env).toBeUndefined();
    expect(JSON.stringify(config)).not.toMatch(secretNamePattern);
  });

  it("documents preview variables and post-deploy checks without embedding secret values", () => {
    const runbook = readText("docs/deployment/VERCEL_PREVIEW.md");

    expect(runbook).toContain("NEXT_PUBLIC_APP_ENV=preview");
    expect(runbook).toContain("NEXT_PUBLIC_SUPABASE_URL=<Supabase project URL>");
    expect(runbook).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>");
    expect(runbook).toContain("SUPABASE_SECRET_KEY=<Supabase secret key>");
    expect(runbook).toContain("TWITCH_CLIENT_SECRET=<Twitch app client secret>");
    expect(runbook).toContain("CHATXPT_OBS_OVERLAY_SETUP_KEY=<Role 1 generated setup key>");
    expect(runbook).toContain("CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY=<Role 1 generated gameplay ingress key>");
    expect(runbook).toContain("/api/health/deployment");
    expect(runbook).toContain("docs/evidence/manifest.json");
    expect(runbook).not.toMatch(fixtureSecretValuePattern);
  });

  it("keeps the environment template aligned with preview health expectations", () => {
    const environmentExample = readText(".env.example");
    const runbook = readText("docs/deployment/VERCEL_PREVIEW.md");

    for (const name of [
      "NEXT_PUBLIC_APP_ENV",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "TWITCH_CLIENT_ID",
      "TWITCH_CLIENT_SECRET",
      "TWITCH_EXTENSION_CLIENT_ID",
      "TWITCH_EXTENSION_SECRET",
      "CHATXPT_OBS_OVERLAY_SETUP_KEY",
      "CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY",
    ]) {
      expect(environmentExample).toContain(`${name}=`);
      expect(runbook).toContain(name);
    }
  });
});
