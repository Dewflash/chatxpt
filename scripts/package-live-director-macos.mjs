import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceBundle = path.join(repositoryRoot, "node_modules", "electron", "dist", "Electron.app");
const sourceApplication = path.join(repositoryRoot, "desktop", "live-director");
const outputDirectory = path.join(repositoryRoot, "dist", "live-director");
const outputBundle = path.join(outputDirectory, "ChatXPT Live Director.app");
const outputApplication = path.join(outputBundle, "Contents", "Resources", "app");
const infoPlist = path.join(outputBundle, "Contents", "Info.plist");

if (process.platform !== "darwin") {
  throw new Error("The current package command creates the macOS ChatXPT Live Director app.");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function setPlistString(key, value) {
  const replaced = run("plutil", ["-replace", key, "-string", value, infoPlist], { allowFailure: true });
  if (replaced.status !== 0) run("plutil", ["-insert", key, "-string", value, infoPlist]);
}

function setPlistBoolean(key, value) {
  const flag = value ? "YES" : "NO";
  const replaced = run("plutil", ["-replace", key, "-bool", flag, infoPlist], { allowFailure: true });
  if (replaced.status !== 0) run("plutil", ["-insert", key, "-bool", flag, infoPlist]);
}

await rm(outputBundle, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(sourceBundle, outputBundle, { recursive: true, verbatimSymlinks: true });
await rm(outputApplication, { recursive: true, force: true });
await mkdir(outputApplication, { recursive: true });
for (const filename of [
  "link.mjs",
  "main.mjs",
  "package.json",
  "preload.mjs",
  "setup.css",
  "setup.html",
  "setup.js",
]) {
  await cp(path.join(sourceApplication, filename), path.join(outputApplication, filename));
}

setPlistString("CFBundleName", "ChatXPT Live Director");
setPlistString("CFBundleDisplayName", "ChatXPT Live Director");
setPlistString("CFBundleIdentifier", "com.chatxpt.live-director");
setPlistString("CFBundleShortVersionString", "0.1.0");
setPlistString("CFBundleVersion", "1");
setPlistString("LSApplicationCategoryType", "public.app-category.utilities");
setPlistBoolean("NSHighResolutionCapable", true);
setPlistBoolean("LSMultipleInstancesProhibited", true);

run("plutil", ["-remove", "CFBundleURLTypes", infoPlist], { allowFailure: true });
run("plutil", [
  "-insert",
  "CFBundleURLTypes",
  "-json",
  JSON.stringify([{
    CFBundleURLName: "com.chatxpt.live-director",
    CFBundleURLSchemes: ["chatxpt"],
  }]),
  infoPlist,
]);

run("codesign", ["--force", "--deep", "--sign", "-", outputBundle]);
run("codesign", ["--verify", "--deep", "--strict", outputBundle]);

process.stdout.write(`${outputBundle}\n`);
