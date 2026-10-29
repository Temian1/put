import { test, expect } from "@playwright/test";
import { boot, claimedToday } from "./helpers.js";

const managedSave = () => ({
  schema: 3,
  unlocked: 12,
  coins: 50000,
  reputation: 100,
  lastPlayed: "2026-01-01",
  lastClaim: claimedToday(),
  branches: ["ch0", "ch1"],
  crew: { ch1: [{ uid: "c1", job: "mgr2", name: "Manager Test" }] },
  till: {},
  awayFrom: Date.now() - 24 * 3600000,
  updatedAt: Date.now() - 24 * 3600000,
});

test("startup savings and absence decay preserve manager income on reload", async ({
  page,
}) => {
  await page.route("https://api.mock/**", (route) => route.abort());
  const errors = await boot(page, managedSave());
  const total = await page.evaluate(() => window.__mp.Save.d.till.ch1);
  expect(total).toBeGreaterThan(0);
  await page.locator("#btnGrow").click({ force: true });
  await expect(page.locator("#growList .collectAll")).toContainText("Collect");
  await page.reload();
  await page.waitForFunction(
    () => window.__mp && document.querySelector("#boot.gone"),
  );
  expect(await page.evaluate(() => window.__mp.Save.d.till.ch1)).toBe(total);
  expect(errors).toEqual([]);
});

test("restoring cloud progress settles income and refreshes an open Grow panel", async ({
  page,
}) => {
  let cloud = null;
  let version = 0;
  await page.route("https://api.mock/mamaput/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/mamaput", "");
    let body = {};
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      });
    if (path === "/players")
      body = { id: 900, name: "Test", token: "fake-test-only" };
    if (path === "/config") body = { accounts: { guests: true } };
    if (path === "/save" && req.method() === "GET")
      body = { version, save: cloud };
    if (path === "/save" && req.method() === "PUT") {
      cloud = req.postDataJSON().save;
      body = { version: ++version };
    }
    await route.fulfill({
      status: path === "/players" ? 201 : 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      json: body,
    });
  });
  const errors = await boot(page, { schema: 3, lastClaim: claimedToday() });
  await page.waitForFunction(() => !!window.__mp.Online.player);
  await page.evaluate(() => window.__mp.syncNow());
  await page.locator("#btnGrow").click({ force: true });
  cloud = {
    ...(await page.evaluate(() => window.__mp.Save.defaults())),
    ...managedSave(),
  };
  // Select the cloud save as the newer account state, as on a restore.
  await page.evaluate(() => {
    window.__mp.Save.d.updatedAt = 1;
  });
  await page.evaluate(() => window.__mp.syncNow());
  await expect(page.locator("#growList .collectAll")).toContainText("Collect");
  expect(cloud.till.ch1).toBeGreaterThan(0);
  const total = cloud.till.ch1;
  await page.evaluate(() => window.__mp.syncNow());
  expect(cloud.till.ch1).toBe(total);
  expect(errors).toEqual([]);
});
