import { expect, test } from "@playwright/test";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || "4187"}`;
const lite = `${basePath}/lite/`;
const pro = `${origin}${basePath}/pro/`;
const player = "QA Embedded Keeper";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(name => {
    if (localStorage.getItem("cs.lite.installation.v1")) return;
    const installationId = "66666666-6666-4666-8666-666666666666";
    localStorage.setItem("cs.lite.installation.v1", installationId);
    localStorage.setItem("cs.lite.roster.v1", JSON.stringify({
      version: 1, installationId, teamId: "qa-embedded", teamName: "QA Embedded FC",
      revision: "2026-11-01T12:00:00.000Z",
      players: [{ id: "qa-keeper", name, number: 1, position: "GK", available: true }],
    }));
  }, player);
});

test("Lite opens the local Pro squad and restores the launcher across browser history", async ({ page }) => {
  // The preceding local document makes an extra shell entry observable on the last Back.
  await page.goto(lite + "manifest.json");
  await page.goto(lite);
  const launcher = page.locator("#proViewBtn");
  const links = page.locator('a[onclick*="openProUpgrade"]');
  const destinations = await links.evaluateAll(anchors => anchors.map(a => (a as HTMLAnchorElement).href));
  expect([...new Set(destinations)]).toEqual([pro]);

  await launcher.click();
  const frame = page.frameLocator("#proFrame");
  const back = page.getByRole("button", { name: "Back to Clubstride Lite" });
  await expect(page.locator("#proFrame")).toHaveJSProperty("src", pro);
  await expect(frame.getByText(player, { exact: true }).first()).toBeVisible();
  await expect(back).toBeFocused();

  await page.goBack();
  await expect(back).toBeHidden();
  await expect(launcher).toBeFocused();
  await page.goForward();
  await expect(back).toBeFocused();
  await expect(frame.getByText(player, { exact: true }).first()).toBeVisible();
  await back.click();
  await expect(launcher).toBeFocused();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.csProShell))).toBe(false);
  await page.goBack();
  await expect(page).toHaveURL(origin + lite + "manifest.json");
});

test("Lite stays open and explains an offline launch when Pro is unavailable", async ({ page, context }) => {
  await page.goto(lite);
  await context.setOffline(true);
  await page.locator("#proViewBtn").click();
  await expect(page.locator("#proToggleNote")).toBeVisible();
  await expect(page.locator("#proShell")).toBeHidden();
  await expect(page.locator("#proFrame")).not.toHaveAttribute("src", /.+/);
  await expect(page).toHaveURL(origin + lite);
  await page.locator("#tabBtn_roster").click();
  await expect(page.locator("#squadPodsList").getByText(player, { exact: true })).toBeVisible();
});

test("reloading Pro inside Lite keeps one shell entry and restores the launching control", async ({ page }) => {
  await page.goto(lite);
  const launcher = page.locator("#proViewBtn");
  await launcher.click();
  const squad = page.frameLocator("#proFrame").getByText(player, { exact: true }).first();
  await expect(squad).toBeVisible();
  await page.reload();
  await expect(squad).toBeVisible();
  await page.getByRole("button", { name: "Back to Clubstride Lite" }).click();
  await expect(launcher).toBeFocused();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.csProShell))).toBe(false);
});
