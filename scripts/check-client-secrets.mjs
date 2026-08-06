import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultBuildRoot = path.join(repositoryRoot, ".next");

const fixedServerOnlyNames = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TWITCH_CLIENT_SECRET",
  "TWITCH_EXTENSION_SECRET",
  "CHATXPT_OBS_OVERLAY_SETUP_KEY",
  "OPENAI_API_KEY",
];

const sensitiveNamePattern = /(SECRET|TOKEN|API_KEY|SERVICE_ROLE|PRIVATE|PASSWORD)/i;
const staticClientExtensions = new Set([".css", ".js", ".json", ".map", ".mjs", ".txt"]);
const prerenderedClientExtensions = new Set([".css", ".html", ".json", ".meta", ".rsc", ".txt"]);

function normaliseProjectPath(absolutePath, buildRoot) {
  return path.relative(buildRoot, absolutePath).split(path.sep).join("/");
}

function configuredSecretNames(environment = process.env) {
  const names = new Set(fixedServerOnlyNames);
  for (const name of Object.keys(environment)) {
    if (name.startsWith("NEXT_PUBLIC_")) continue;
    if (sensitiveNamePattern.test(name)) names.add(name);
  }
  return [...names].sort();
}

function configuredSecretValues(environment = process.env) {
  const values = [];
  for (const name of configuredSecretNames(environment)) {
    const value = environment[name]?.trim();
    if (value !== undefined && value.length >= 8) {
      values.push({ label: `value for ${name}`, value });
    }
  }

  for (const [index, value] of (environment.CHATXPT_SECRET_SCAN_SENTINELS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 8)
    .entries()) {
    values.push({ label: `sentinel ${index + 1}`, value });
  }

  return values;
}

async function walkFiles(root, allowedExtensions) {
  if (!existsSync(root)) return [];
  const files = [];

  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (allowedExtensions === null || allowedExtensions.has(path.extname(entry.name))) {
        files.push(absolute);
      }
    }
  }

  if ((await stat(root)).isDirectory()) await walk(root);
  return files;
}

export async function clientArtifactFiles(buildRoot = defaultBuildRoot) {
  const roots = [
    { directory: path.join(buildRoot, "static"), extensions: staticClientExtensions },
    { directory: path.join(buildRoot, "server", "app"), extensions: prerenderedClientExtensions },
    { directory: path.join(buildRoot, "server", "pages"), extensions: prerenderedClientExtensions },
  ];
  const files = (await Promise.all(roots.map((root) => walkFiles(root.directory, root.extensions)))).flat();
  return files.sort();
}

export async function scanClientArtifacts({
  buildRoot = defaultBuildRoot,
  environment = process.env,
} = {}) {
  if (!existsSync(buildRoot)) {
    return {
      scannedFiles: 0,
      violations: [`Build output not found at ${normaliseProjectPath(buildRoot, repositoryRoot)}; run npm run build first.`],
    };
  }

  const files = await clientArtifactFiles(buildRoot);
  const serverOnlyNames = configuredSecretNames(environment);
  const serverOnlyValues = configuredSecretValues(environment);
  const violations = [];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    const projectPath = normaliseProjectPath(file, buildRoot);

    for (const name of serverOnlyNames) {
      if (text.includes(name)) {
        violations.push(`server-only env name ${name} found in client artifact ${projectPath}`);
      }
    }

    for (const secret of serverOnlyValues) {
      if (text.includes(secret.value)) {
        violations.push(`${secret.label} found in client artifact ${projectPath}`);
      }
    }
  }

  return { scannedFiles: files.length, violations };
}

export async function writeFixtureArtifact(buildRoot, projectPath, content) {
  const absolute = path.join(buildRoot, projectPath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
}

async function main() {
  const result = await scanClientArtifacts();
  if (result.violations.length > 0) {
    console.error("Client secret scan failed:");
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Client secret scan passed (${result.scannedFiles} browser-delivered artifacts).`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
