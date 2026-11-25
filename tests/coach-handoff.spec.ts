import { expect, test, type Page } from "@playwright/test";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || "4187"}`;
const clubId = "qa-aurora";
const teamId = "qa-u12-prem";
const names = ["QA Alpha Keeper", "QA Alpha Forward"];

// Seed only a fictional custom club. Never open the imported default club.
async function seed(page: Page, populated = true, coach = true) {
  await page.context().route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue() : route.abort());
  await page.addInitScript(({ clubId, teamId, populated, coach }) => {
    if (localStorage.getItem("qa-fixture-ready")) return;
    localStorage.setItem("qa-fixture-ready", "1");
    const club = { id: clubId, name: "Aurora Test FC", kind: "custom", theme: "red", logo: "" };
    localStorage.setItem("bnfc-clubs", JSON.stringify({ clubs: [club], activeId: clubId }));
    const players = [
      { id: "qa-a1", name: "QA Alpha Keeper", firstName: "QA Alpha", surname: "Keeper", squadNumber: 1, position: "Goalkeeper" },
      { id: "qa-a2", name: "QA Alpha Forward", firstName: "QA Alpha", surname: "Forward", squadNumber: 9, position: "Striker" },
    ].map((p, i) => ({ ...p, teamId, regNumber: `REG-000${i + 1}`, idNumber: "", mobile: "",
      homework: "", seasonFee: 0, sponsoredAmount: 0, payments: [], correspondence: [] }));
    localStorage.setItem(`bnfc-club-${clubId}`, JSON.stringify({ version: 0, state: {
      clubKind: "custom", ageGroups: populated ? [{ id: "ag-u12", name: "U12", displayOrder: 12,
        teams: [{ id: teamId, name: "Prem", division: "Prem" }] }] : [],
      players: populated ? players : [], coaches: populated && coach ? [{ id: "qa-coach", teamId, name: "Coach Rowan Test" }] : [],
      coachTeamId: populated ? teamId : null,
    } }));
    // A receiving tier must replace this old squad rather than silently reuse it.
    localStorage.setItem("Clubstride Mobile_squad", JSON.stringify([{ id: "qa-old", name: "QA Old Player", number: 8, position: "CM" }]));
    localStorage.setItem("bnfc-role", "HEAD_COACH");
    localStorage.setItem("bnfc-role-club", clubId);
  }, { clubId, teamId, populated, coach });
}

async function expectSquad(page: Page, tier: string) {
  if (tier === "lite") {
    // Lite's default pitch view need not list every bench player. Open its squad view.
    await page.locator('#tabBtn_roster').click();
  }
  const squad = page.locator(tier === "lite" ? "#squadPodsList" : "#root");
  for (const name of names) await expect(squad.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("QA Old Player", { exact: true })).toHaveCount(0);
}

for (const route of ["roster", "match"]) {
  for (const tier of ["lite", "pro"]) {
    test(`${route} launches ${tier} at the deployment root`, async ({ page }) => {
      await seed(page);
      await page.goto(`${basePath}/coach/${route}/`);
      const name = route === "roster" ? (tier === "lite" ? "Open Lite" : "Open Pro")
        : (tier === "lite" ? "Pitch-side Lite" : "Pro Tracker");
      const link = page.getByRole("link", { name: new RegExp(name) });
      const response = page.waitForResponse((r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === `${basePath}/${tier}/`);
      await link.click();
      await expect(page).toHaveURL(`${origin}${basePath}/${tier}/`);
      expect((await response).status()).toBe(200);
      const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("cs.lite.roster.v1")!));
      expect(snapshot.teamId).toBe(teamId);
      for (const field of ["ownerId", "cloudTeamId", "readOnly"]) expect(snapshot).not.toHaveProperty(field);
      expect(snapshot.players.map((p: { name: string }) => p.name)).toEqual(names);
    });
  }
}

for (const tier of ["lite", "pro"]) {
  test(`assign a coach and squad in Football, then open ${tier}`, async ({ page }, testInfo) => {
    // Pro's checked-in Expo HTML references /Football/pro assets. Do not mask this with server aliases.
    test.skip(tier === "pro" && basePath !== "/Football", "The bundled Pro entry hardcodes /Football/pro asset paths.");
    await seed(page, false);
    await page.goto(`${basePath}/coach/`);
    await page.locator('[data-age-tile="U12"]').click();
    await page.locator('[data-field="division"]').selectOption("Prem");
    const opened = await page.locator("[data-open-team]").getAttribute("data-open-team");
    await page.goto(`${basePath}/`);
    await page.getByRole("button", { name: "Open club admin", exact: true }).click();
    await page.goto(`${basePath}/admin/people/`);
    for (const [index, surname] of ["Keeper", "Forward"].entries()) {
      await page.locator('[data-field="register-first-name"]').fill("QA Alpha");
      await page.locator('[data-field="register-surname"]').fill(surname);
      await page.locator('[data-field="register-number"]').fill(index === 0 ? "1" : "9");
      await page.locator('[data-field="register-team"]').selectOption(opened!);
      await page.getByRole("button", { name: "Register player", exact: true }).click();
      await expect(page.locator("[data-registration-notice]")).toContainText(`QA Alpha ${surname} registered`);
    }
    const form = page.locator("form").filter({ has: page.getByRole("heading", { name: "Coach for the team" }) });
    for (const coach of ["Coach Rowan Test", "Coach Casey Test"]) {
      await form.getByLabel("Coach", { exact: true }).fill(coach);
      await form.getByLabel("Team and league").selectOption(opened!);
      await form.getByRole("button", { name: "Assign coach" }).click();
      await expect(form.getByLabel("Team and league")).toContainText(coach);
    }
    await page.goto(`${basePath}/`);
    await page.getByRole("button", { name: "Open head coach", exact: true }).click();
    await page.goto(`${basePath}/coach/roster/`);
    await expect(page.getByText(/Coach: Coach Casey Test/)).toBeVisible();
    await page.getByRole("link", { name: new RegExp(tier === "lite" ? "Open Lite" : "Open Pro") }).click();
    await expectSquad(page, tier);
    await page.reload();
    await expectSquad(page, tier);
    await testInfo.attach(`${tier}-squad-after-reload`, {
      body: await page.screenshot({ fullPage: true }), contentType: "image/png",
    });
  });
}

test("Pro still selects an unassigned local squad", async ({ page }) => {
  test.skip(basePath !== "/Football", "Pro's bundled assets require /Football.");
  await seed(page, true, false);
  await page.goto(`${basePath}/coach/roster/`);
  await page.getByRole("link", { name: /Open Pro/ }).click();
  await expectSquad(page, "pro");
});

test("Pro does not expose an owned cloud squad without membership", async ({ page }) => {
  test.skip(basePath !== "/Football", "Pro's bundled assets require /Football.");
  await seed(page);
  await page.goto(`${basePath}/`);
  await page.evaluate(() => localStorage.setItem("cs.lite.roster.v1", JSON.stringify({
    version: 1, installationId: "11111111-1111-4111-8111-111111111111",
    teamId: "cloud-22222222-2222-4222-8222-222222222222", teamName: "QA Private Cloud",
    cloudTeamId: "22222222-2222-4222-8222-222222222222",
    ownerId: "33333333-3333-4333-8333-333333333333", readOnly: true,
    revision: new Date().toISOString(),
    players: [{ id: "qa-private", name: "QA Private Player", number: 2, position: "GK" }],
  })));
  await page.goto(`${basePath}/pro/`);
  await expect(page.getByText("This account is not on a squad yet.", { exact: false })).toBeVisible();
  await expect(page.getByText("QA Private Player", { exact: true })).toHaveCount(0);
  await expect(page.getByText("QA Private Cloud", { exact: true })).toHaveCount(0);
});
