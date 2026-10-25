import { test, expect } from "@playwright/test";
import {
  boot,
  claimedToday,
  startLevel,
  waitPlaying,
  SAVE_KEY,
} from "./helpers.js";

const fresh = (patch = {}) => ({
  schema: 2,
  lastClaim: claimedToday(),
  ...patch,
});
const saved = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);

test("buy buka equipment: tables appear in the scene", async ({ page }) => {
  await boot(page, fresh({ coins: 100000 }));
  await page.locator("#btnShop").click({ force: true });
  await page.locator("#tabBuka").click({ force: true });
  const card = page.locator("#shopList .card", { hasText: "Plastic table" });
  await card.locator(".btn").click();
  await expect(card).toContainText("1/5");
  // Equipment belongs to the restaurant it was bought for.
  expect((await saved(page)).equipBy.ch0.tables).toBe(1);
  await page.locator("#shopClose").click({ force: true });
  await startLevel(page, 5);
  await waitPlaying(page);
  expect(await page.evaluate(() => window.__mp.Game.tables.length)).toBe(2);
});

test("market: buy ingredients, then cooking uses the store", async ({
  page,
}) => {
  await boot(page, fresh({ coins: 100000 }));
  await page.locator("#btnMarket").click({ force: true });
  const rice = page.locator("#marketList .card", { hasText: "Rice & stew" });
  await rice.locator(".btn", { hasText: "+5" }).click();
  await expect(rice).toContainText("in store 5/10");
  const d = await saved(page);
  expect(d.pantry.rice).toBe(5);
  expect(d.coins).toBeLessThan(100000);
  await page.locator("#marketClose").click({ force: true });
  await startLevel(page, 6);
  await waitPlaying(page);
  await page.evaluate(() => {
    const ck = window.__mp.Game.cookers.jollof;
    ck.stock = 0;
    ck.stage = "raw";
  });
  await page.locator('.food[data-id="jollof"]').dispatchEvent("pointerdown");
  const g = await page.evaluate(() => ({
    rice: window.__mp.Save.d.pantry.rice,
    cost: window.__mp.Game.foodCost,
  }));
  expect(g).toEqual({ rice: 4, cost: 0 });
});

test("served customers sit at a free table to eat, then leave a plate", async ({
  page,
}) => {
  await boot(page, fresh());
  await startLevel(page, 12);
  await waitPlaying(page);
  const seated = await page.waitForFunction(
    () => {
      const G = window.__mp.Game;
      if (G.state !== "playing") return false;
      const w = G.customers.find((c) => c.state === "wait");
      if (w) {
        const ready = w.order.every((x) => x.layer !== 0 || x.drink || x.done);
        const it = w.order.find((o) => !o.done && (o.layer !== 1 || ready));
        if (it && G.cookers[it.f]?.stage !== "cooking") G.tapFood(it.f);
      }
      return G.customers.some((c) => c.state === "eat");
    },
    null,
    { timeout: 60_000, polling: 300 },
  );
  expect(await seated.jsonValue()).toBe(true);
  await page.waitForFunction(
    () => window.__mp.Game.tables.some((t) => t.plates.length),
    null,
    { timeout: 20_000 },
  );
  await expect(page.locator(".dirtyChip.small").first()).toBeVisible();
});

test("haggling: accept the customer's price from the bubble", async ({
  page,
}) => {
  await boot(page, fresh());
  await startLevel(page, 12);
  await page.evaluate(() => {
    const r = Math.random;
    Math.random = () => 0.05;
    setTimeout(() => (Math.random = r), 4500);
  });
  await page.waitForFunction(
    () =>
      window.__mp.Game.customers.some((c) => c.haggle && c.state === "wait"),
    null,
    { timeout: 20_000 },
  );
  await page.locator(".bubble .hb.ok").first().dispatchEvent("pointerdown");
  const c = await page.evaluate(() => {
    const x = window.__mp.Game.customers.find((k) => k.haggle?.done);
    return { mult: x.priceMult, offer: x.haggle.offer, full: x.haggle.full };
  });
  expect(c.mult).toBeCloseTo(c.offer / c.full);
});

test("health inspector visits and judges hygiene", async ({ page }) => {
  await boot(page, fresh());
  await startLevel(page, 22);
  await waitPlaying(page);
  await page.evaluate(() => (window.__mp.Game.inspectT = 0.5));
  await expect(page.locator("#notify")).toContainText("inspector", {
    timeout: 5000,
  });
  await page.waitForFunction(
    () =>
      window.__mp.Game.inspector?.state === "out" ||
      window.__mp.Game.inspector === null,
    null,
    { timeout: 30_000 },
  );
  await expect(page.locator("#hygiene")).toBeVisible();
});

test("hired workers stand in the back kitchen and walk to jobs", async ({
  page,
}) => {
  // Level 12 is at the second restaurant, so that is where they work.
  await boot(
    page,
    fresh({ staff: ["basira", "bisi", "chidi"], unlocked: 20, place: "ch1" }),
  );
  await startLevel(page, 12);
  await waitPlaying(page);
  const pos = await page.evaluate(() =>
    window.__mp.Game.helpers.map((h) => ({
      id: h.spec.id,
      z: h.root.position.z,
      visible: h.root.visible,
    })),
  );
  expect(pos).toHaveLength(3);
  pos.forEach((p) => {
    expect(p.visible).toBe(true);
    expect(p.z).toBeGreaterThan(2.5);
  });
  // Someone leaves home to do a job within a few seconds.
  await page.waitForFunction(
    () =>
      window.__mp.Game.helpers.some(
        (h) => h.root.position.distanceTo(h.home) > 0.5,
      ),
    null,
    { timeout: 20_000 },
  );
});
