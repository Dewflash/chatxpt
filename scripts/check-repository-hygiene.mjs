import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const forbiddenDirectoryPrefixes = [
  ".next/",
  ".vercel/",
  "coverage/",
  "dist/",
  "node_modules/",
  "out/",
  "playwright-report/",
  "recordings/",
  "screenshots/",
  "supabase/.branches/",
  "supabase/.temp/",
  "test-results/",
  "tmp/",
  "twitch-upload-assets/",
];

function trackedFiles(cwd) {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

export function findForbiddenTrackedFiles(files) {
  return files.filter((file) => {
    const name = basename(file);
    if (name === ".DS_Store" || name === "Thumbs.db") return true;
    if (name.endsWith(".log") || name.endsWith(".swp") || name.endsWith("~")) return true;
    if (name.startsWith(".env") && name !== ".env.example") return true;
    return forbiddenDirectoryPrefixes.some((prefix) => file.startsWith(prefix));
  });
}

function localTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  const target = trimmed.startsWith("<")
    ? trimmed.slice(1, trimmed.indexOf(">"))
    : trimmed.split(/\s+(?=["'])/, 1)[0];

  if (
    target.length === 0 ||
    target.startsWith("#") ||
    target.startsWith("/") ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  ) {
    return null;
  }

  return target.split(/[?#]/, 1)[0];
}

function markdownTargets(content) {
  const targets = [];
  const inline = /!?\[[^\]]*\]\(([^)\n]+)\)/g;
  const definitions = /^\s*\[[^\]]+\]:\s*(\S+)/gm;
  let match;

  while ((match = inline.exec(content)) !== null) targets.push(match[1]);
  while ((match = definitions.exec(content)) !== null) targets.push(match[1]);

  return targets;
}

export function findBrokenMarkdownLinks(cwd, files) {
  const broken = [];

  for (const file of files.filter((candidate) => candidate.endsWith(".md"))) {
    const content = readFileSync(resolve(cwd, file), "utf8");
    for (const rawTarget of markdownTargets(content)) {
      const target = localTarget(rawTarget);
      if (target === null) continue;

      let decodedTarget;
      try {
        decodedTarget = decodeURIComponent(target);
      } catch {
        broken.push(`${file} -> invalid encoded target: ${target}`);
        continue;
      }

      if (!existsSync(resolve(cwd, dirname(file), decodedTarget))) {
        broken.push(`${file} -> ${decodedTarget}`);
      }
    }
  }

  return broken;
}

export function findStaleVerificationClaims(cwd, files) {
  return files
    .filter((file) => file.startsWith("changes/") && file.endsWith(".md"))
    .filter((file) => /Pending in this pass:/i.test(readFileSync(resolve(cwd, file), "utf8")));
}

export function auditRepository(cwd = process.cwd()) {
  const files = trackedFiles(cwd);
  return {
    forbiddenTrackedFiles: findForbiddenTrackedFiles(files),
    brokenMarkdownLinks: findBrokenMarkdownLinks(cwd, files),
    staleVerificationClaims: findStaleVerificationClaims(cwd, files),
  };
}

function printFailures(label, failures) {
  if (failures.length === 0) return;
  console.error(`${label}:\n- ${failures.join("\n- ")}`);
}

const invokedPath = process.argv[1] === undefined ? null : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = auditRepository();
  printFailures("Forbidden tracked artifacts", result.forbiddenTrackedFiles);
  printFailures("Broken local Markdown links", result.brokenMarkdownLinks);
  printFailures("Stale change-fragment verification claims", result.staleVerificationClaims);

  const failureCount = Object.values(result).reduce((total, failures) => total + failures.length, 0);
  if (failureCount > 0) process.exit(1);

  console.log("Repository hygiene check passed");
}
