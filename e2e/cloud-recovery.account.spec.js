import { test, expect } from "@playwright/test";
import { boot, claimedToday } from "./helpers.js";

test("a newer low-cash browser adopts repaired cash and refreshes map stars", async ({
  page,
}) => {
  let version = 10;
  let cloud = {
    schema: 3,
    coins: 24872000,
    saveEpoch: 1,
    unlocked: 68,
    stars: { 1: 3, 67: 3 },
    updatedAt: 1,
    guideSeen: true,
    lastClaim: claimedToday(),
    quality: "low",
  };
  await page.addInitScript(() =>
    localStorage.setItem(
      "mamaPutRush3D.online",
      JSON.stringify({
        id: 21,
        name: "Olamide",
        token: "fake-test-only",
        source: "both",
      }),
    ),
  );
  await page.route("https://api.mock/mamaput/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/mamaput", "");
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    let status = 200;
    let body = {};
    if (path === "/config")
      body = { accounts: { guests: false, lagoslife: true } };
    if (path === "/me")
      body = {
        id: 21,
        name: "Olamide",
        source: "both",
        email: "ola@example.test",
        account: { email: "ola@example.test" },
        lagoslife: { name: "Olamide" },
      };
    if (path === "/wallet") body = { coins: 0 };
    if (path === "/save" && request.method() === "GET")
      body = { version, save: cloud };
    if (path === "/save" && request.method() === "PUT") {
      const incoming = request.postDataJSON();
      if (
        incoming.version !== version ||
        incoming.save.saveEpoch !== cloud.saveEpoch
      ) {
        status = 409;
        body = { version, save: cloud };
      } else {
        cloud = incoming.save;
        body = { version: ++version };
      }
    }
    await route.fulfill({ status, headers, json: body });
  });
  const errors = await boot(page, {
    schema: 3,
    coins: 272000,
    unlocked: 2,
    stars: { 2: 3 },
    updatedAt: 9999999999999,
    lastClaim: claimedToday(),
    quality: "low",
  });
  await expect
    .poll(() => page.evaluate(() => window.__mp.Save.d.coins))
    .toBe(24872000);
  expect(await page.evaluate(() => window.__mp.Save.d.saveEpoch)).toBe(1);
  await page.locator("#btnPlay").dispatchEvent("click");
  await expect(page.locator(".node").nth(0).locator(".star.on")).toHaveCount(3);
  await expect(page.locator(".node").nth(2).locator(".star.on")).toHaveCount(0);
  // A progress-only sync must repaint the open map even when cash/level match.
  cloud = { ...cloud, stars: { ...cloud.stars, 3: 3 } };
  version++;
  await page.evaluate(() => window.__mp.syncNow());
  await expect(page.locator(".node").nth(2).locator(".star.on")).toHaveCount(3);
  expect(cloud.coins).toBe(24872000);
  expect(errors).toEqual([]);
});
