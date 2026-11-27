import { expect, test, type Page } from "@playwright/test";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || "4187"}`;
const clubA = "qa-club-a", clubB = "qa-club-b";
const teamA = "qa-team-a", teamB = "qa-team-b", teamC = "qa-team-c";

test("a phone user can open a role, reach fees, and expand club registration", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await seed(page);
  await page.goto(`${basePath}/`);
  const developer = page.getByRole("button", { name: "Open developer", exact: true });
  await expect(developer).toBeVisible();
  const roleBottom = (await developer.boundingBox())!;
  const clubList = (await page.locator("[data-club-list]").boundingBox())!;
  expect(roleBottom.y + roleBottom.height).toBeLessThanOrEqual(clubList.y);
  await developer.click();
  const fees = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Fees (Accounting)" });
  await expect(fees).toBeInViewport();
  await fees.click();
  await expect(page).toHaveURL(`${origin}${basePath}/admin/accounting/`);
  await expect(fees).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto(`${basePath}/`);
  const registration = page.locator("details").filter({ has: page.getByText("Register a club", { exact: true }) });
  const submit = registration.getByRole("button", { name: "Register club" });
  await expect(submit).toBeHidden();
  await registration.locator("summary").click();
  await expect(submit).toBeVisible();
});

async function seed(page: Page, selectedTeam = teamA) {
  await page.context().route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.addInitScript(({ clubA, clubB, teamA, teamB, teamC, selectedTeam }) => {
    if (localStorage.getItem("qa-integrity-ready")) return;
    localStorage.setItem("qa-integrity-ready", "1");
    const profile = (id: string, name: string) => ({ id, name, kind: "custom", theme: "red", logo: "" });
    localStorage.setItem("bnfc-clubs", JSON.stringify({ clubs: [profile(clubA, "Aurora Test FC"), profile(clubB, "Borealis Test FC")], activeId: clubA }));
    const player = (id: string, name: string, number: number, teamId: string, reg: number) => ({
      id, name, firstName: name.slice(0, name.lastIndexOf(" ")), surname: name.slice(name.lastIndexOf(" ") + 1), regNumber: `REG-${String(reg).padStart(4, "0")}`,
      squadNumber: number, position: number === 1 ? "Goalkeeper" : "Central midfielder", teamId,
      idNumber: "", mobile: "", homework: "", seasonFee: 0, sponsoredAmount: 0, payments: [], correspondence: [],
    });
    const alpha = Array.from({ length: 12 }, (_, i) => player(`qa-a${i + 1}`, i === 0 ? "QA Alpha Keeper" : i === 11 ? "QA Alpha Reserve" : `QA Alpha ${i + 1}`, i + 1, teamA, i + 1));
    const beta = [player("qa-b1", "QA Beta One", 21, teamB, 21), player("qa-b2", "QA Beta Two", 22, teamB, 22)];
    const data = (teams: { id: string; name: string; division: string }[], players: typeof alpha, selected: string) => ({
      version: 0, state: { clubKind: "custom", ageGroups: [{ id: "ag-u12", name: "U12", displayOrder: 12, teams }],
        players, coaches: [], coachTeamId: selected },
    });
    localStorage.setItem(`bnfc-club-${clubA}`, JSON.stringify(data([{ id: teamA, name: "Prem", division: "Prem" }, { id: teamB, name: "Div 1", division: "Div 1" }], [...alpha, ...beta], selectedTeam)));
    localStorage.setItem(`bnfc-club-${clubB}`, JSON.stringify(data([{ id: teamC, name: "Prem", division: "Prem" }], [player("qa-c1", "QA Other Club", 1, teamC, 1)], teamC)));
    localStorage.setItem("bnfc-role", "HEAD_COACH");
    localStorage.setItem("bnfc-role-club", clubA);
  }, { clubA, clubB, teamA, teamB, teamC, selectedTeam });
}

async function storedClub(page: Page, id = clubA) {
  return page.evaluate((id) => JSON.parse(localStorage.getItem(`bnfc-club-${id}`)!).state, id);
}

async function openClub(page: Page, id: string) {
  await page.goto(`${basePath}/`);
  await page.getByRole("button", { name: "Sign out", exact: true }).first().click();
  await page.locator(`[data-load-club="${id}"]`).click();
  await page.getByRole("button", { name: "Open head coach", exact: true }).click();
  await page.goto(`${basePath}/coach/match/`);
}

async function prepareClock(page: Page) {
  await page.clock.install({ time: new Date("2026-11-25T10:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-25T10:00:01Z"));
}

for (const pauseBeforeSwitch of [false, true]) {
  test(`match identity survives ${pauseBeforeSwitch ? "paused" : "running"} team switch and reload`, async ({ page }) => {
    await seed(page);
    await page.goto(`${basePath}/coach/match/`);
    const match = page.locator("[data-match-id]");
    await expect(match).toHaveAttribute("data-match-team", teamA);
    const idA = await match.getAttribute("data-match-id");
    await prepareClock(page);
    await page.getByLabel("Opponent", { exact: true }).fill("QA Alpha Opponent");
    await page.locator('button[data-formation="4-3-3"]').click();
    await page.getByRole("button", { name: "Prem goal", exact: true }).click();
    await page.getByRole("button", { name: "QA Alpha Opponent goal", exact: true }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.clock.runFor(60_000);
    await expect(page.locator("[data-match-clock]")).toHaveText("01:00");
    await page.locator('[data-match-player="qa-a1"]').click();
    await page.locator('[data-match-player="qa-a12"]').click();
    await page.clock.runFor(60_000);
    if (pauseBeforeSwitch) await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.locator('[data-field="division"]').selectOption("Div 1");
    await expect(match).toHaveAttribute("data-match-team", teamB);
    await expect(page.locator("[data-match-clock]")).toHaveText("00:00");
    await expect(page.locator('[data-match-player="qa-a1"]')).toHaveCount(0);
    await page.getByLabel("Opponent", { exact: true }).fill("QA Beta Opponent");
    await page.getByRole("button", { name: "Save minutes", exact: true }).click();
    await expect.poll(async () => (await storedClub(page)).matches.length).toBe(1);
    const beta = (await storedClub(page)).matches[0];
    expect(beta.teamId).toBe(teamB);
    expect(beta.minutes.map((p: { playerId: string }) => p.playerId).sort()).toEqual(["qa-b1", "qa-b2"]);
    await page.locator('[data-field="division"]').selectOption("Prem");
    await expect(match).toHaveAttribute("data-match-id", idA!);
    await expect(page.locator("[data-match-clock]")).toHaveText("02:00");
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
    await expect(page.getByLabel("Opponent", { exact: true })).toHaveValue("QA Alpha Opponent");
    await expect(page.locator('button[data-formation="4-3-3"]')).toHaveClass(/btn-shade/);
    await expect(page.locator('[aria-label="Score"] [data-score]')).toHaveText(["1", "1"]);
    await page.clock.resume();
    await page.reload();
    await expect(match).toHaveAttribute("data-match-id", idA!);
    await expect(page.locator("[data-match-clock]")).toHaveText("02:00");
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
    await expect(page.getByLabel("Opponent", { exact: true })).toHaveValue("QA Alpha Opponent");
    await expect(page.locator('button[data-formation="4-3-3"]')).toHaveClass(/btn-shade/);
    await expect(page.locator('[aria-label="Score"] [data-score]')).toHaveText(["1", "1"]);
    await page.getByRole("button", { name: "Save minutes", exact: true }).click();
    await page.getByRole("button", { name: "Save minutes", exact: true }).click();
    await expect.poll(async () => (await storedClub(page)).matches.length).toBe(2);
    const state = await storedClub(page);
    const alpha = state.matches.find((m: { id: string }) => m.id === idA);
    expect(alpha.teamId).toBe(teamA);
    expect(alpha).toMatchObject({ formation: "4-3-3", durationSeconds: 120, ourScore: 1, theirScore: 1, teamLabel: "Prem" });
    expect(alpha.events.map((event: { kind: string }) => event.kind)).toEqual(["GOAL_FOR", "GOAL_AGAINST", "SUB"]);
    expect(alpha.events.find((event: { kind: string }) => event.kind === "SUB")).toMatchObject({ atMs: 60_000, offId: "qa-a1", onId: "qa-a12" });
    expect(alpha.players.map((player: { playerId: string }) => player.playerId)).toEqual(Array.from({ length: 12 }, (_, i) => `qa-a${i + 1}`));
    expect(alpha.players[0].startedOnPitch).toBe(true);
    expect(alpha.players[11].startedOnPitch).toBe(false);
    expect(alpha.minutes.find((p: { playerId: string }) => p.playerId === "qa-a1").minutesPlayed).toBeCloseTo(1);
    expect(alpha.minutes.find((p: { playerId: string }) => p.playerId === "qa-a12").minutesPlayed).toBeCloseTo(1);
    expect(new Set(state.attendance.map((a: { id: string }) => a.id)).size).toBe(state.attendance.length);
    expect(state.attendance).toHaveLength(14);
    await page.clock.pauseAt(new Date("2026-11-25T10:10:00Z"));
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.clock.runFor(60_000);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Save minutes", exact: true }).click();
    expect((await storedClub(page)).matches).toHaveLength(2);
    expect((await storedClub(page)).attendance).toHaveLength(14);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("button", { name: "Keep match" }).click();
    await expect(match).toHaveAttribute("data-match-id", idA!);
    await expect(page.locator("[data-match-clock]")).toHaveText("03:00");
    await expect(page.locator('[aria-label="Score"] [data-score]')).toHaveText(["1", "1"]);
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("button", { name: "Start new match" }).click();
    await expect(match).not.toHaveAttribute("data-match-id", idA!);
    await expect(page.locator("[data-match-clock]")).toHaveText("00:00");
    await expect(page.locator('button[data-formation="4-3-3"]')).toHaveClass(/btn-shade/);
  });
}

test.describe("phone coaching workflows", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a pending reset is forgotten when the coach changes team or leaves the match", async ({ page }) => {
    await seed(page);
    await page.goto(`${basePath}/coach/match/`);
    const match = page.locator("[data-match-id]");
    const reset = page.getByRole("button", { name: "Reset", exact: true });
    const confirm = page.getByRole("button", { name: "Start new match" });
    await expect(match).toHaveAttribute("data-match-team", teamA);
    const originalId = await match.getAttribute("data-match-id");
    await page.getByLabel("Opponent", { exact: true }).fill("QA Mobile Opponent");
    await reset.tap();
    await expect(confirm).toBeVisible();
    await page.locator('[data-field="division"]').selectOption("Div 1");
    await expect(match).toHaveAttribute("data-match-team", teamB);
    await expect(confirm).toHaveCount(0);
    await page.locator('[data-field="division"]').selectOption("Prem");
    await expect(match).toHaveAttribute("data-match-id", originalId!);
    await expect(confirm).toHaveCount(0);
    await reset.tap();
    await page.goto(`${basePath}/coach/`);
    await page.getByRole("link", { name: /Live match/ }).last().tap();
    await expect(match).toHaveAttribute("data-match-id", originalId!);
    await expect(confirm).toHaveCount(0);
    await expect(page.getByLabel("Opponent", { exact: true })).toHaveValue("QA Mobile Opponent");
  });

  test("find, order and reopen a session on a phone", async ({ page }) => {
    await seed(page);
    await page.goto(`${basePath}/coach/`);
    const search = page.getByRole("searchbox", { name: "Find a drill" });
    const matches = page.getByRole("group", { name: "Matching drills" });
    const results = matches.locator("button[aria-pressed]");
    const chosen = page.getByRole("list", { name: "Drills in session" });
    const save = page.getByRole("button", { name: "Save plan" });
    await expect(matches).toHaveCount(0);
    await expect(save).toBeDisabled();
    await search.fill("no-such-qa-drill");
    await expect(matches.getByText("No matching drills.")).toBeVisible();
    await search.fill("a");
    await expect(results).toHaveCount(12);
    await matches.getByRole("button", { name: "Show more drills" }).tap();
    await expect(results).toHaveCount(24);
    const target = await results.first().boundingBox();
    expect(target!.height).toBeGreaterThanOrEqual(44);
    expect(target!.x).toBeGreaterThanOrEqual(0);
    expect(target!.x + target!.width).toBeLessThanOrEqual(390);
    const first = await results.nth(0).innerText();
    const second = await results.nth(1).innerText();
    await matches.getByRole("button", { name: first, exact: true }).tap();
    await search.fill(second.toUpperCase());
    await matches.getByRole("button", { name: second, exact: true }).tap();
    await expect(page.getByRole("heading", { name: second, exact: true })).toBeVisible();
    await chosen.getByRole("button", { name: `Remove ${second}`, exact: true }).tap();
    await expect(page.getByRole("heading", { name: first, exact: true })).toBeVisible();
    await matches.getByRole("button", { name: second, exact: true }).tap();
    await search.fill("");
    await expect(chosen.getByRole("listitem")).toHaveCount(2);
    await page.getByLabel("Session name").fill("QA matchday warm-up");
    await save.tap();
    await expect(page.getByText("Plan saved.")).toBeVisible();
    const originalPlan = (await storedClub(page)).sessions[0];
    expect(originalPlan.teamId).toBe(teamA);
    await page.reload();
    await page.getByRole("button", { name: /QA matchday warm-up/ }).tap();
    await expect(chosen.locator("button[aria-pressed]")).toHaveText([first, second]);
    await expect(page.getByRole("heading", { name: first, exact: true })).toBeVisible();
    await chosen.getByRole("button", { name: `Remove ${first}`, exact: true }).tap();
    expect((await storedClub(page)).sessions[0]).toEqual(originalPlan);
  });
});

test("match sessions remain separate across club sign-out/load/return", async ({ page }) => {
  await seed(page);
  await page.goto(`${basePath}/coach/match/`);
  const match = page.locator("[data-match-id]");
  await expect(match).toHaveAttribute("data-match-team", teamA);
  const idA = await match.getAttribute("data-match-id");
  await prepareClock(page);
  await page.getByLabel("Opponent", { exact: true }).fill("QA Club A Opponent");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(30_000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.resume();
  await openClub(page, clubB);
  await expect(match).toHaveAttribute("data-match-team", teamC);
  await expect(page.locator("[data-match-clock]")).toHaveText("00:00");
  await expect(page.locator('[data-match-player="qa-a1"]')).toHaveCount(0);
  await openClub(page, clubA);
  await expect(match).toHaveAttribute("data-match-id", idA!);
  await expect(page.locator("[data-match-clock]")).toHaveText("00:30");
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByLabel("Opponent", { exact: true })).toHaveValue("QA Club A Opponent");
});

test("admin transfer refreshes an open Lite squad without selecting the previous team", async ({ page, context }) => {
  await seed(page);
  await page.goto(`${basePath}/coach/roster/`);
  await page.getByRole("link", { name: /Open Lite/ }).click();
  await page.locator("#tabBtn_roster").click();
  const roster = page.locator("#squadPodsList");
  await expect(roster.getByText("QA Alpha Keeper", { exact: true })).toBeVisible();
  const switching = await context.newPage();
  await switching.goto(`${basePath}/coach/`);
  await switching.locator('[data-field="division"]').selectOption("Div 1");
  await switching.goto(`${basePath}/coach/roster/`);
  await switching.getByRole("link", { name: /Open Lite/ }).click();
  await expect(roster.getByText("QA Beta One", { exact: true })).toBeVisible();
  const admin = await context.newPage();
  await admin.goto(`${basePath}/`);
  await admin.getByRole("button", { name: "Open club admin", exact: true }).click();
  await admin.goto(`${basePath}/admin/people/`);
  await admin.locator('[data-player-result="REG-0001"]').click();
  await admin.locator('[data-field="edit-player-details"]').click();
  await admin.locator('[data-field="record-team"]').selectOption(teamB);
  await admin.getByRole("button", { name: "Save details", exact: true }).click();
  await expect.poll(() => admin.evaluate(() => JSON.parse(localStorage.getItem("cs.lite.roster.v1")!).players.length)).toBe(3);
  expect(await admin.evaluate(() => JSON.parse(localStorage.getItem("cs.lite.roster.v1")!).teamId)).toBe(teamB);
  await expect(roster.getByText("QA Alpha Keeper", { exact: true })).toBeVisible();
  await expect(roster.getByText("QA Beta One", { exact: true })).toBeVisible();
  // Football also refreshed inactive Alpha. Loading it inside the already-open Lite
  // must not resurrect the player that just moved to Beta.
  await page.getByTitle("Manage & Switch Teams").click();
  await page.locator("#savedTeamsList > div").filter({ hasText: "U12 · Prem" }).getByRole("button", { name: "Load", exact: true }).click();
  await page.locator("#modalTeams .sheet-close").click();
  await page.locator("#tabBtn_roster").click();
  await expect(roster.getByText("QA Alpha Keeper", { exact: true })).toHaveCount(0);
  await expect(roster.getByText("QA Alpha 2", { exact: true })).toBeVisible();
  // Explicit selection inside Lite must bind future background refreshes to Alpha.
  await admin.locator('[data-player-result="REG-0002"]').click();
  await admin.locator('[data-field="edit-player-details"]').click();
  await admin.locator('[data-field="record-first-name"]').fill("QA Alpha");
  await admin.locator('[data-field="record-surname"]').fill("Updated Two");
  await admin.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(roster.getByText("QA Alpha Updated Two", { exact: true })).toBeVisible();
  await expect(roster.getByText("QA Alpha 2", { exact: true })).toHaveCount(0);
  await page.reload();
  await page.locator("#tabBtn_roster").click();
  await expect(roster.getByText("QA Alpha Keeper", { exact: true })).toHaveCount(0);
  await admin.goto(`${basePath}/`);
  await admin.getByRole("button", { name: "Open head coach", exact: true }).click();
  await admin.goto(`${basePath}/coach/`);
  await admin.locator('[data-field="division"]').selectOption("Prem");
  await admin.goto(`${basePath}/coach/roster/`);
  await admin.getByRole("link", { name: /Open Lite/ }).click();
  await admin.locator("#tabBtn_roster").click();
  await expect(admin.locator("#squadPodsList").getByText("QA Alpha Keeper", { exact: true })).toHaveCount(0);
  await expect(admin.locator("#squadPodsList").getByText("QA Alpha Updated Two", { exact: true })).toBeVisible();
});
