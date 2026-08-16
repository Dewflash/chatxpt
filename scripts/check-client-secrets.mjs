import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const CLIENT_OUTPUT_DIR = ".next/static";
const SECRET_ENV_NAMES = [
  "OPENAI_API_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TWITCH_CLIENT_SECRET",
  "TWITCH_EXTENSION_SECRET",
  "CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY",
];

const SECRET_NAME_PATTERN = /\b(OPENAI_API_KEY|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|TWITCH_CLIENT_SECRET|TWITCH_EXTENSION_SECRET|CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY)\b/g;

async function* walk(directory) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch (caught) {
    throw new Error(`Client bundle directory is unavailable: ${directory}`, { cause: caught });
  }

  for (const entry of entries) {
    const path = join(directory, entry);
    const details = await stat(path);
    if (details.isDirectory()) {
      yield* walk(path);
    } else if (details.isFile()) {
      yield path;
    }
  }
}

function configuredSecretValues() {
  return SECRET_ENV_NAMES
    .map((name) => [name, process.env[name]?.trim()])
    .filter((entry) => typeof entry[1] === "string" && entry[1].length >= 8);
}

const failures = [];
for await (const file of walk(CLIENT_OUTPUT_DIR)) {
  const text = await readFile(file, "utf8").catch(() => null);
  if (text === null) continue;

  for (const [name, value] of configuredSecretValues()) {
    if (text.includes(value)) {
      failures.push(`${file} contains configured secret value ${name}`);
    }
  }

  const names = [...text.matchAll(SECRET_NAME_PATTERN)].map((match) => match[0]);
  if (names.length > 0) {
    failures.push(`${file} contains server-secret environment name(s): ${[...new Set(names)].join(", ")}`);
  }
}

if (failures.length > 0) {
  console.error("Client bundle secret scan failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Client bundle secret scan passed.");
