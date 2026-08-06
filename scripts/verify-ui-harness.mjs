import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

import { chromium } from "playwright";

const port = Number(process.env.CHATXPT_UI_HARNESS_PORT ?? 3100);
const host = "127.0.0.1";
const existingUrl = process.env.CHATXPT_UI_HARNESS_URL ?? "http://localhost:3000/diagnostics/ui-harness";
const spawnedUrl = `http://${host}:${port}/diagnostics/ui-harness`;
const requestedScreenshotPath = resolve(process.argv[2] ?? "/private/tmp/chatxpt-ui-harness.png");
const screenshotDirectory = extname(requestedScreenshotPath) === ".png"
  ? join(dirname(requestedScreenshotPath), basename(requestedScreenshotPath, ".png"))
  : requestedScreenshotPath;
const overlayScreenshotPath = join(screenshotDirectory, "desktop-overlay-after-vote.png");
const primaryScreenshotPath = extname(requestedScreenshotPath) === ".png"
  ? requestedScreenshotPath
  : overlayScreenshotPath;

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
  await mkdir(screenshotDirectory, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url);
  await page.getByText("Fixture revision 3").waitFor();
  await page.screenshot({
    path: join(screenshotDirectory, "desktop-studio-ready.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Live Config" }).click();
  await page.getByRole("heading", { name: "voting Controls" }).waitFor();
  await page.screenshot({
    path: join(screenshotDirectory, "desktop-live-config.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Viewer Board" }).click();
  await page.getByRole("button", { name: "0 votes" }).first().click();
  await page.getByRole("heading", { name: "Vote Accepted" }).waitFor();
  await page.screenshot({
    path: join(screenshotDirectory, "desktop-viewer-vote-accepted.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Overlay", exact: true }).click();
  await page.getByRole("heading", { name: "Hold Your Ground" }).waitFor();
  await page.screenshot({ path: overlayScreenshotPath, fullPage: true });
  if (primaryScreenshotPath !== overlayScreenshotPath) {
    await page.screenshot({ path: primaryScreenshotPath, fullPage: true });
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(url);
  await mobile.getByText("Fixture revision 4").waitFor();
  await mobile.getByRole("button", { name: "Viewer Board" }).click();
  await mobile.getByRole("heading", { name: "Choose A Quest" }).waitFor();
  await mobile.screenshot({
    path: join(screenshotDirectory, "mobile-viewer-board.png"),
    fullPage: true,
  });

  const failure = await browser.newPage({ viewport: { width: 820, height: 740 } });
  await failure.route("**/api/diagnostics/ui-gateway?**", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: {
          code: "forbidden",
          message: "Fixture gateway denial for screenshot verification.",
        },
      }),
    });
  });
  await failure.goto(url);
  await failure.getByText("forbidden: Fixture gateway denial for screenshot verification.").waitFor();
  await failure.screenshot({
    path: join(screenshotDirectory, "desktop-gateway-error.png"),
    fullPage: true,
  });

  console.log(`Diagnostic UI harness verified at ${url}`);
  console.log(`Primary screenshot: ${primaryScreenshotPath}`);
  console.log(`Screenshot directory: ${screenshotDirectory}`);
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
