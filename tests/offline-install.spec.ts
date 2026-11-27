import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { expect, test, type Page } from "@playwright/test";

const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || "4187"}`;
const home = `${origin}${prefix}/`;
const lite = `${home}lite/`;
const pro = `${home}pro/`;
const siblingCache = "qa-unrelated-app";
const playerName = "QA Offline Keeper";

test.use({
  serviceWorkers: "allow",
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    // Also restrict requests made by workers, which can bypass page routing.
    args: ["--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"],
  },
});
test.describe.configure({ timeout: 60_000 });

async function seedLocalApps(page: Page) {
  await page.context().route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  // Seed another app's cache before opening a document that registers a worker.
  await page.goto(`${home}icons/icon-192.png`);
  await page.evaluate(async ({ siblingCache, playerName }) => {
    const installationId = "77777777-7777-4777-8777-777777777777";
    localStorage.setItem("cs.lite.installation.v1", installationId);
    localStorage.setItem("cs.lite.roster.v1", JSON.stringify({
      version: 1, installationId, teamId: "qa-offline", teamName: "QA Offline FC",
      revision: "2026-11-01T12:00:00.000Z",
      players: [{ id: "qa-keeper", name: playerName, number: 1, position: "GK", available: true }],
    }));
    const cache = await caches.open(siblingCache);
    await cache.put("/qa-sibling-marker", new Response("sibling data"));
  }, { siblingCache, playerName });
}

async function expectWorker(page: Page, scope: string) {
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    { timeout: 25_000 }).toBe(`${scope}sw.js`);
  const activeScope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
  expect(activeScope).toBe(scope);
}

async function appCaches(page: Page) {
  return page.evaluate(async (sibling) => {
    const marker = await caches.match("/qa-sibling-marker", { cacheName: sibling });
    return { marker: await marker?.text(), names: (await caches.keys()).filter((name) => name !== sibling) };
  }, siblingCache);
}

async function expectBothInstalls(page: Page, firstCaches: string[]) {
  const scopes = await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).filter((worker) => worker.active).map((worker) => worker.scope));
  expect(scopes.sort()).toEqual([home, lite].sort());
  const { marker, names } = await appCaches(page);
  expect(marker).toBe("sibling data");
  expect(names).toEqual(expect.arrayContaining(firstCaches));
  const newNames = names.filter((name) => !firstCaches.includes(name));
  expect(newNames.length).toBeGreaterThan(0);
  return newNames;
}

async function expectOfflinePage(page: Page, url: string, checkUI: () => Promise<void>) {
  const firstVisit = await page.goto(url);
  expect(firstVisit?.fromServiceWorker()).toBe(true);
  await checkUI();
  const reloaded = await page.reload();
  expect(reloaded?.fromServiceWorker()).toBe(true);
  await checkUI();
}

async function openLiteRoster(page: Page) {
  await page.locator("#tabBtn_roster").click();
  await expect(page.locator("#squadPodsList").getByText(playerName, { exact: true })).toBeVisible();
  await expect(page.locator("#section_live")).toBeHidden();
}

test("Football installs its offline routes and both embedded apps before their first visit", async ({ page, context }) => {
  await seedLocalApps(page);
  await page.goto(home);
  await expectWorker(page, home);
  const first = await appCaches(page);
  expect(first.marker).toBe("sibling data");
  expect(first.names.length).toBeGreaterThan(0);

  // Chromium resolves even an omitted manifest id to the effective start URL.
  const session = await context.newCDPSession(page);
  const { manifest, errors } = await session.send("Page.getAppManifest");
  expect(errors.filter((error) => error.critical)).toEqual([]);
  expect(manifest).toMatchObject({ id: home, startUrl: home, scope: home });
  const icons = manifest.icons?.map((icon) => icon.url) || [];
  expect(icons).toContain(`${home}icons/icon-192.png`);
  expect(icons).toContain(`${home}icons/icon-512.png`);
  await session.detach();

  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await expectOfflinePage(page, `${home}privacy/`, async () => {
    await expect(page.getByRole("heading", { name: "Privacy and POPIA notice" })).toBeVisible();
  });
  await expectOfflinePage(page, lite, () => openLiteRoster(page));
  await expectOfflinePage(page, pro, async () => {
    const switchView = page.getByRole("button", { name: "Switch to Lite view", exact: true });
    await expect(switchView).toBeVisible();
    await expect.poll(() => switchView.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  });

  await context.setOffline(false);
  await page.goto(lite);
  await expectWorker(page, lite);
  const liteCaches = await expectBothInstalls(page, first.names);
  const stored = await page.evaluate(async (names) => {
    const entries = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()));
    return entries.flat().length;
  }, liteCaches);
  await expect(page.locator("#offlineStatusLine")).toHaveText(`Offline ready • ${stored} files stored`);
  await context.setOffline(true);
  await page.locator("#proViewBtn").click();
  const frame = page.frameLocator("#proFrame");
  await expect(frame.getByText(playerName, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Back to Clubstride Lite" }).click();
  await openLiteRoster(page);
});

test("installing Football after Lite preserves Lite's offline app and the sibling cache", async ({ page, context }) => {
  await seedLocalApps(page);
  await page.goto(lite);
  await expectWorker(page, lite);
  const first = await appCaches(page);
  expect(first.marker).toBe("sibling data");
  expect(first.names.length).toBeGreaterThan(0);

  await page.goto(home);
  await expectWorker(page, home);
  await expectBothInstalls(page, first.names);

  await context.setOffline(true);
  await expectOfflinePage(page, lite, () => openLiteRoster(page));
  await expectWorker(page, lite);
});

async function updateWorker(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise<ServiceWorkerState>((resolve, reject) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing!;
        const check = () => {
          if (worker.state === "activated" || worker.state === "redundant") resolve(worker.state);
        };
        worker.addEventListener("statechange", check);
        check();
      }, { once: true });
      registration.update().catch(reject);
    });
  });
}

test("a failed Football update keeps the installed page and bundle together until the retry succeeds", async ({ page, context }) => {
  // Serve two tiny exports with the actual Football worker and a temporarily missing v2 bundle.
  const template = readFileSync("public/sw.js", "utf8");
  let version = "v1";
  let bundleAvailable = true;
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const path = request.url;
    if (path === `${prefix}/sw.js`) {
      const files = JSON.stringify(["", `${version}.js`]);
      response.writeHead(200, { "Content-Type": "text/javascript" }).end(
        template.replace('"__BUILD__"', JSON.stringify(version)).replace("(__PRECACHE__)", `(${files})`));
    } else if (path === `${prefix}/`) {
      response.writeHead(200, { "Content-Type": "text/html" })
        .end(`<!doctype html><output></output><script src="./${version}.js"></script>`);
    } else if (path === `${prefix}/${version}.js` && bundleAvailable) {
      response.writeHead(200, { "Content-Type": "text/javascript" })
        .end(`document.querySelector("output").textContent = "${version}";`);
    } else {
      response.writeHead(404).end();
    }
  });
  server.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing local fixture port");
    const fixture = `http://127.0.0.1:${address.port}${prefix}/`;
    await page.goto(fixture);
    await page.evaluate(() => navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then(() => true));
    await expectWorker(page, fixture);
    const app = page.locator("output");
    await expect(app).toHaveText("v1");

    version = "v2";
    bundleAvailable = false;
    expect(await updateWorker(page)).toBe("redundant");
    await page.reload();
    await expect(app).toHaveText("v1");
    await context.setOffline(true);
    await page.reload();
    await expect(app).toHaveText("v1");

    await context.setOffline(false);
    bundleAvailable = true;
    expect(await updateWorker(page)).toBe("activated");
    await context.setOffline(true);
    await page.reload();
    await expect(app).toHaveText("v2");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
