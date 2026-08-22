import { randomBytes } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const filePath = resolve(process.env.CHATXPT_LOCAL_ENV_PATH || ".env.local");

async function existingSource() {
  try {
    return await readFile(filePath, "utf8");
  } catch (caught) {
    if (caught?.code === "ENOENT") return "";
    throw caught;
  }
}

function secret() {
  return randomBytes(48).toString("base64url");
}

const source = await existingSource();
const defaults = [
  ["NEXT_PUBLIC_APP_ENV", "local"],
  ["CHATXPT_LLM_ENABLED", "false"],
  ["CHATXPT_TWITCH_EVENTSUB_TRANSPORT", "websocket"],
  ["TWITCH_EVENTSUB_SECRET", secret()],
  ["CHATXPT_STUDIO_SESSION_SECRET", secret()],
  ["CHATXPT_HOSTED_BOARD_SECRET", secret()],
  ["CHATXPT_STUDIO_SETUP_KEY", secret()],
  ["CHATXPT_OBS_OVERLAY_SETUP_KEY", secret()],
  ["CHATXPT_GAMEPLAY_INGRESS_SETUP_KEY", secret()],
];
let next = source;
const additions = [];
for (const [name, value] of defaults) {
  const assignment = new RegExp(`^${name}=(.*)$`, "mu");
  const existing = next.match(assignment);
  if (existing !== null && !["", "\"\"", "''"].includes(existing[1].trim())) continue;
  if (existing !== null) {
    next = next.replace(assignment, `${name}=${value}`);
  } else {
    additions.push(`${name}=${value}`);
  }
}

const changedCount = defaults.filter(([name]) => {
  const before = source.match(new RegExp(`^${name}=(.*)$`, "mu"))?.[1].trim();
  return before === undefined || ["", "\"\"", "''"].includes(before);
}).length;

if (changedCount > 0) {
  const prefix = source.length === 0
    ? "# ChatXPT local runtime values. Generated once; never commit this file.\n"
    : next.endsWith("\n") ? "" : "\n";
  next = `${next}${prefix}${additions.join("\n")}${additions.length > 0 ? "\n" : ""}`;
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, next, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, filePath);
}
await chmod(filePath, 0o600);

console.log(
  changedCount === 0
    ? "ChatXPT local runtime values already exist."
    : `Prepared ${changedCount} private ChatXPT local runtime values.`,
);
