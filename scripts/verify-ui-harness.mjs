import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { chromium } from "playwright";

const port = Number(process.env.CHATXPT_UI_HARNESS_PORT ?? 3100);
const host = "127.0.0.1";
const existingUrl = process.env.CHATXPT_UI_HARNESS_URL ?? "http://localhost:3000/diagnostics/ui-harness";
const spawnedUrl = `http://${host}:${port}/diagnostics/ui-harness`;
const screenshotPath = resolve(process.argv[2] ?? "/private/tmp/chatxpt-ui-harness.png");

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function reachable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await reachable(url)) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const useExistingServer = await reachable(existingUrl);
const url = useExistingServer ? existingUrl : spawnedUrl;
const apiUrl = new URL("/api/diagnostics/ui-gateway", url).toString();
const server = useExistingServer
  ? null
  : spawn(
      "npm",
      ["run", "dev", "--", "--hostname", host, "--port", String(port)],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

let serverOutput = "";
server?.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server?.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

let browser;
try {
  await waitForServer(url);
  const reset = await fetch(apiUrl, { method: "DELETE" });
  if (!reset.ok) throw new Error(`Could not reset diagnostic gateway: ${reset.status}`);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url);
  await page.getByText("Fixture revision 3").waitFor();
  await page.getByRole("button", { name: "Viewer Board" }).click();
  await page.getByRole("button", { name: "0 votes" }).first().click();
  await page.getByRole("heading", { name: "Vote Accepted" }).waitFor();
  await page.getByRole("button", { name: "Overlay" }).click();
  await page.getByRole("heading", { name: "Hold Your Ground" }).waitFor();
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Diagnostic UI harness verified at ${url}`);
  console.log(`Screenshot: ${screenshotPath}`);
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
