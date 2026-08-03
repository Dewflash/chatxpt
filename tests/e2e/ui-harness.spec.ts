import { expect, test } from "@playwright/test";

const surfaces = ["studio", "config", "live-config", "viewer", "hosted-board", "overlay"];

for (const surface of surfaces) {
  test(`${surface} diagnostic host is visibly fixture-only`, async ({ page }) => {
    await page.goto(`/diagnostics/ui-harness/${surface}`);

    await expect(page.getByText("FIXTURE / DIAGNOSTIC HARNESS")).toBeVisible();
    await expect(page.getByText("NOT LIVE EVIDENCE")).toBeVisible();
    await expect(page.getByRole("heading", { name: `${surface} host` })).toBeVisible();
    await expect(page.getByText("evidence: fixture")).toBeVisible();
  });
}

test("the browser client returns revisions and reproduces token expiry", async ({ page }, testInfo) => {
  await page.goto("/diagnostics/ui-harness/studio");
  await page.getByRole("button", { name: "Send typed sample command" }).click();
  await expect(page.getByText("committed: revision 1")).toBeVisible();

  await page.getByLabel("Identity fixture").selectOption("expired");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Diagnostic access token has expired",
  );

  await page.screenshot({
    path: testInfo.outputPath("ui-harness-studio.png"),
    fullPage: true,
  });
});

test("a moderator can use Live Config without receiving Studio access", async ({ page }) => {
  await page.goto("/diagnostics/ui-harness/live-config");
  await page.getByLabel("Identity fixture").selectOption("moderator");
  await expect(page.getByText("auth: authenticated")).toBeVisible();
  await page.getByRole("button", { name: "Send typed sample command" }).click();
  await expect(page.getByText("committed: revision 1")).toBeVisible();
});
