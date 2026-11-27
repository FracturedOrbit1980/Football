import { expect, test, type Locator, type Page } from "@playwright/test";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || 4187}`;

async function seed(page: Page, role: "DEVELOPER" | "SUPER_ADMIN" | "HEAD_COACH") {
  await page.context().route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.addInitScript((role) => {
    if (localStorage.getItem("qa-safeguards")) return;
    const clubs = ["North", "South"].map((name) => ({
      id: name.toLowerCase(), name: `QA ${name} FC`, kind: "custom", theme: "red", logo: "",
    }));
    localStorage.setItem("bnfc-clubs", JSON.stringify({ clubs, activeId: "north" }));
    localStorage.setItem("bnfc-role", role);
    localStorage.setItem("bnfc-role-club", "north");
    for (const club of clubs) {
      const players = ["Ada", "Lee"].map((name, index) => ({
        id: name, name: `QA ${name}`, firstName: "QA", surname: name, regNumber: `REG-000${index + 1}`,
        squadNumber: index + 1, position: "Goalkeeper", teamId: null, idNumber: "", mobile: "",
        homework: "", guardianName: "", guardianEmail: "", accessPin: "", feeDueDate: "2026-01-02",
        seasonFee: 1000, sponsoredAmount: 0, payments: [{ id: "receipt", date: "2026-01-01", amount: 100 }],
        correspondence: [], paymentPlan: { id: "agreement", agreedOn: "2026-01-02",
          instalments: [{ id: "one", dueDate: "2026-11-01", amount: 900 }] },
        promise: { amount: 100, date: "2026-11-30", notedOn: "2026-11-01" },
      }));
      localStorage.setItem(`bnfc-club-${club.id}`, JSON.stringify({ version: 0, state: { clubKind: "custom", players } }));
    }
    localStorage.setItem("qa-safeguards", "1");
  }, role);
}

async function players(page: Page, club = "north") {
  return page.evaluate((club) => JSON.parse(localStorage.getItem(`bnfc-club-${club}`)!).state.players, club);
}

async function confirmAction(page: Page, control: Locator, accept: boolean) {
  const [message] = await Promise.all([
    page.waitForEvent("dialog").then(async (dialog) => {
      const message = dialog.message();
      if (accept) await dialog.accept(); else await dialog.dismiss();
      expect(dialog.type()).toBe("confirm");
      return message;
    }),
    control.click(),
  ]);
  return message;
}

test("restoring the library warns about club records and clears only the confirmed club", async ({ page }) => {
  await seed(page, "DEVELOPER");
  await page.goto(`${basePath}/admin/`);
  const reset = page.getByRole("button", { name: /restore official library/i });
  const warning = await confirmAction(page, reset, false);
  expect(warning).toContain("QA North FC");
  expect(warning).toContain("players, teams, coaches, fee records");
  expect(await players(page)).toHaveLength(2);
  await page.locator('[data-open-club="south"]').click();
  await expect(page.locator('[data-open-club="north"]')).toBeVisible();
  expect(await confirmAction(page, reset, true)).toContain("QA South FC");
  await expect.poll(() => players(page, "south")).toHaveLength(0);
  expect(await players(page)).toHaveLength(2);
});

test("removing a member agreement or promise keeps receipts and targets the confirmed member", async ({ page }) => {
  await seed(page, "SUPER_ADMIN");
  await page.goto(`${basePath}/admin/members/`);
  await page.locator('[data-field="open-Ada"]').click();
  for (const [control, field] of [["agreement", "paymentPlan"], ["promise", "promise"]] as const) {
    const before = await players(page);
    expect(await confirmAction(page, page.locator(`[data-field="remove-${control}-Ada"]`), false)).toContain("QA Ada");
    expect(await players(page)).toEqual(before);
    await page.locator('[data-field="open-Lee"]').click();
    expect(await confirmAction(page, page.locator(`[data-field="remove-${control}-Lee"]`), true)).toContain("QA Lee");
    const after = await players(page);
    expect(after[0]).toEqual(before[0]);
    expect(after[1][field]).toBeNull();
    expect(after[1].payments).toEqual(before[1].payments);
    await page.locator('[data-field="open-Ada"]').click();
  }
});

test("clearing a drill frame leaves other frames intact and can be undone", async ({ page }) => {
  await seed(page, "HEAD_COACH");
  await page.goto(`${basePath}/coach/editor/`);
  const pitch = page.getByLabel("Drill editor pitch");
  const pieces = pitch.locator("[data-piece-id]");
  await page.locator('[data-tool="Cone"]').click();
  const count = await pieces.count();
  expect(count).toBeGreaterThan(0);
  await page.locator('[data-tool="Record frame"]').click();
  const clear = page.locator("[data-clear-slide]");
  expect(await confirmAction(page, clear, false)).toContain("frame 2");
  await expect(pieces).toHaveCount(count);
  await page.getByRole("slider", { name: "Scrub frames" }).focus();
  await page.keyboard.press("Home");
  await expect(pitch).toHaveAttribute("data-frame", "0");
  expect(await confirmAction(page, clear, true)).toContain("frame 1");
  await expect(pieces).toHaveCount(0);
  await page.getByRole("slider", { name: "Scrub frames" }).focus();
  await page.keyboard.press("End");
  await expect(pieces).toHaveCount(count);
  await page.locator('[data-tool="Undo"]').click();
  await page.getByRole("slider", { name: "Scrub frames" }).focus();
  await page.keyboard.press("Home");
  await expect(pieces).toHaveCount(count);
});
