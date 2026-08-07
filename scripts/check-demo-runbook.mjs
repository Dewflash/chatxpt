import { readFileSync } from "node:fs";

const runbookPath = "docs/evidence/GOLDEN_REHEARSAL_RUNBOOK.md";
const content = readFileSync(runbookPath, "utf8");

const requiredPhrases = [
  "# Golden Rehearsal Runbook",
  "Evidence Rules",
  "Required Resources",
  "Preflight",
  "Memory-Backed Dry Run",
  "Real Twitch And OBS Run",
  "Failure Matrix",
  "Evidence Manifest Entry",
  "Stop Conditions",
  "`twitch-broadcaster`",
  "`viewer-session-a`",
  "`viewer-session-b`",
  "`obs-gameplay-machine`",
  "`streamer-desktop-browser`",
  "`viewer-mobile-browser`",
  "`demo-recording`",
  "never present them as live extraction or live Twitch evidence",
  "Record unknown gameplay or audience facts as `unknown`",
  "OBS is capturing the ChatXPT overlay as gameplay input",
  "The same authoritative revision cannot be matched",
];

const missing = requiredPhrases.filter((phrase) => !content.includes(phrase));
if (missing.length > 0) {
  console.error(`Golden rehearsal runbook is missing required content:\n- ${missing.join("\n- ")}`);
  process.exit(1);
}

const forbidden = [
  /password\s*[:=]/i,
  /client[_ -]?secret\s*[:=]/i,
  /oauth[_ -]?token\s*[:=]/i,
  /https:\/\/(?!github\.com\/Dewflash\/chatxpt|dev\.twitch\.tv\/)/i,
];

for (const pattern of forbidden) {
  if (pattern.test(content)) {
    console.error(`Golden rehearsal runbook contains forbidden private or unrestricted-link pattern: ${pattern}`);
    process.exit(1);
  }
}

console.log("Golden rehearsal runbook check passed");
