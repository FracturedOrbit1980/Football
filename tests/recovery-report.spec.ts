import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || "4187"}`;
const clubId = "qa-recovery-club";
const teamId = "qa-recovery-prem";
const otherTeamId = "qa-recovery-div1";

async function seed(context: BrowserContext, role = "HEAD_COACH") {
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(({ clubId, teamId, otherTeamId, role }) => {
    // Every page shares the same fictional browser-local club; reloading must not reseed it.
    if (localStorage.getItem("qa-recovery-ready")) return;
    localStorage.setItem("qa-recovery-ready", "1");
    const club = { id: clubId, name: "QA Recovery FC", kind: "custom", theme: "red", logo: "" };
    const players = Array.from({ length: 8 }, (_, index) => ({
      id: `qa-r${index + 1}`, name: `QA Recovery ${index + 1}`,
      firstName: "QA Recovery", surname: String(index + 1),
      regNumber: `REG-000${index + 1}`, teamId, squadNumber: index + 1,
      position: index === 0 ? "Goalkeeper" : "Central midfielder",
      idNumber: "", mobile: "", homework: "", correspondence: [],
      seasonFee: index === 0 ? 1000 : 0, sponsoredAmount: index === 0 ? 200 : 0,
      payments: index === 0 ? [{ id: "qa-payment", amount: 300, date: "2026-11-01" }] : [],
      feeDueDate: "2026-11-01", guardianName: "QA Guardian", guardianEmail: "",
      paymentPlan: null, promise: null, accessPin: "",
    }));
    players.push({ ...players[1], id: "qa-beta", name: "QA Other Squad", firstName: "QA Other",
      surname: "Squad", regNumber: "REG-0009", teamId: otherTeamId, squadNumber: 9 });
    localStorage.setItem("bnfc-clubs", JSON.stringify({ clubs: [club], activeId: clubId }));
    localStorage.setItem(`bnfc-club-${clubId}`, JSON.stringify({ version: 0, state: {
      clubKind: "custom", ageGroups: [{ id: "ag-u12", name: "U12", displayOrder: 12, teams: [
        { id: teamId, name: "Prem", division: "Prem" },
        { id: otherTeamId, name: "Div 1", division: "Div 1" },
      ] }], players, coaches: [{ id: "qa-recovery-coach", name: "QA Recovery Coach", teamId }],
      coachTeamId: teamId,
    } }));
    const installationId = "55555555-5555-4555-8555-555555555555";
    localStorage.setItem("cs.lite.installation.v1", installationId);
    localStorage.setItem("cs.lite.roster.v1", JSON.stringify({ version: 1, installationId, teamId,
      teamName: "QA Recovery U12 Prem", revision: new Date().toISOString(),
      players: players.filter((p) => p.teamId === teamId).map((p) => ({
        id: p.id, name: p.name, number: p.squadNumber, position: p.position, available: true,
      })),
    }));
    localStorage.setItem("bnfc-role", role);
    localStorage.setItem("bnfc-role-club", clubId);
  }, { clubId, teamId, otherTeamId, role });
}

async function liteRoster(page: Page) {
  await page.locator("#tabBtn_roster").click();
  return page.locator("#squadPodsList");
}

test("Lite keeps time and substitutions offline, then recovers its completed archive", async ({ page, context }) => {
  await seed(context);
  await page.clock.install({ time: new Date("2026-11-25T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-25T12:00:01Z"));
  await page.goto(`${basePath}/lite/`);
  await expect((await liteRoster(page)).getByText("QA Recovery 8", { exact: true })).toBeVisible();
  await page.locator("#tabBtn_live").click();
  await page.locator("#clockToggleBtn").click();
  await expect(page.locator("#clockToggleBtn")).toHaveText("PAUSE");
  await page.clock.fastForward(60_000);
  await expect(page.locator("#matchClockDisplay")).toHaveText("01:00");
  await page.locator("#liveOnPitchGrid").getByRole("button").filter({ hasText: "QA Recovery 1" }).click();
  await page.locator("#liveBenchGrid").getByRole("button").filter({ hasText: "QA Recovery 8" }).click();
  await expect(page.locator("#liveOnPitchGrid").getByText("QA Recovery 8", { exact: true })).toBeVisible();

  // The loaded app works without a connection. Offline navigation is deliberately not asserted:
  // the suite blocks service workers, so it cannot prove a PWA cache installation.
  await context.setOffline(true);
  await page.clock.fastForward(60_000);
  await expect(page.locator("#matchClockDisplay")).toHaveText("02:00");
  await expect(page.locator("#liveTimer_qa-r8")).toHaveText("01:00");
  await page.getByTitle("End match and archive to history").click();
  await page.locator("#endMatchConfirmBtn").click();
  await expect(page.locator("#matchClockDisplay")).toHaveText("00:00");
  const beforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem("Clubstride Mobile_history")!));
  expect(beforeReload).toHaveLength(1);
  expect(beforeReload[0]).toMatchObject({ teamId, durationSeconds: 120, status: "completed",
    playerTimers: { "qa-r1": 60, "qa-r8": 60 } });
  expect(beforeReload[0].events).toEqual(expect.arrayContaining([expect.objectContaining({
    type: "Sub", playerOutId: "qa-r1", playerInId: "qa-r8", matchTimeSeconds: 60,
  })]));

  await context.setOffline(false);
  await page.reload();
  await page.locator("#tabBtn_live").click();
  await expect(page.locator("#clockToggleBtn")).toHaveText("START");
  await expect(page.locator("#matchClockDisplay")).toHaveText("00:00");
  await page.locator("#tabBtn_stats").click();
  await expect(page.locator("#section_stats")).toContainText("Duration: 02:00");
  const recovered = await page.evaluate(() => JSON.parse(localStorage.getItem("Clubstride Mobile_history")!));
  expect(recovered).toHaveLength(1);
  expect(recovered[0]).toMatchObject({ id: beforeReload[0].id, teamId, durationSeconds: 120,
    playerTimers: { "qa-r1": 60, "qa-r8": 60 } });
});

test("an open Lite tab receives a different squad launched from Football", async ({ page, context }) => {
  await seed(context);
  await page.goto(`${basePath}/lite/`);
  await expect((await liteRoster(page)).getByText("QA Recovery 1", { exact: true })).toBeVisible();
  const football = await context.newPage();
  await football.goto(`${basePath}/coach/`);
  await football.locator('[data-age-tile="U12"]').click();
  await football.locator('[data-field="division"]').selectOption("Div 1");
  await expect(football.locator("[data-open-team]")).toHaveAttribute("data-open-team", otherTeamId);
  await football.goto(`${basePath}/coach/roster/`);
  await football.getByRole("link", { name: /Open Lite/ }).click();
  const roster = await liteRoster(page);
  await expect(roster.getByText("QA Other Squad", { exact: true })).toBeVisible();
  await expect(roster.getByText("QA Recovery 1", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect((await liteRoster(page)).getByText("QA Other Squad", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cs.lite.roster.v1")!).teamId)).toBe(otherTeamId);
});

test("weekly feedback updates one report and survives roster reload", async ({ page, context }) => {
  await seed(context);
  await page.clock.setFixedTime(new Date("2026-11-25T12:00:00Z"));
  await page.goto(`${basePath}/coach/roster/`);
  await page.locator('[data-squad-player="QA Recovery 1"]').click();
  const day = page.locator("[data-training-date]").first();
  await day.getByRole("button", { name: "Present", exact: true }).click();
  const date = await day.getAttribute("data-training-date");
  await page.getByRole("button", { name: "Weekly report", exact: true }).click();
  for (const feedback of ["QA first feedback", "QA updated feedback"]) {
    await page.locator('[data-field="game-feedback"]').fill(feedback);
    await page.getByRole("button", { name: "Save weekly report", exact: true }).click();
    await expect(page.getByText("Weekly report saved.", { exact: true })).toBeVisible();
  }
  await page.reload();
  await page.locator('[data-squad-player="QA Recovery 1"]').click();
  await page.getByRole("button", { name: "Weekly report", exact: true }).click();
  await expect(page.locator('[data-field="game-feedback"]')).toHaveValue("QA updated feedback");
  await expect(page.locator(`[data-training-date="${date}"]`).getByRole("button", { name: "Present", exact: true })).toHaveAttribute("aria-pressed", "true");
  const reports = await page.evaluate((clubId) => JSON.parse(localStorage.getItem(`bnfc-club-${clubId}`)!).state.weeklyReports, clubId);
  expect(reports).toHaveLength(1);
  expect(reports[0]).toMatchObject({ playerId: "qa-r1", teamId, gameFeedback: "QA updated feedback" });
  expect(reports[0].attendance).toEqual(expect.arrayContaining([expect.objectContaining({ date, status: "Present" })]));
});

test("member balance and a generated statement retain the saved ledger after reload", async ({ page, context }) => {
  await seed(context, "SUPER_ADMIN");
  // Inspect the generated local document without invoking the operating-system print flow.
  await context.addInitScript(() => { window.print = () => {}; });
  await page.goto(`${basePath}/admin/members/`);
  const member = page.locator('[data-member="REG-0001"]');
  await expect(member.locator("[data-member-chips]")).toContainText(/Outstanding\s*R\s*500/);
  await page.reload();
  await expect(member.locator("[data-member-chips]")).toContainText(/Outstanding\s*R\s*500/);
  const opened = page.waitForEvent("popup");
  await member.getByRole("button", { name: "Statement", exact: true }).click();
  const statement = await opened;
  await expect(statement.locator("body")).toContainText("QA Recovery 1");
  await expect(statement.locator("body")).toContainText("QA Recovery FC");
  await expect(statement.locator("tr.total")).toContainText(/R\s*500/);
  await expect(statement.locator("body")).toContainText("REG-0001");
  await statement.close();
});
