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

test("online order: notification, pack items, send with a rider", async ({
  page,
}) => {
  await boot(page, fresh());
  await startLevel(page, 15);
  await waitPlaying(page);
  // Bring the first online order forward and stop walk-ins from taking food.
  await page.evaluate(() => {
    const G = window.__mp.Game;
    G.spawnT = 999;
    G.orderT = 0;
    // Every pan and pot ready, so each tap packs a portion.
    for (const id in G.cookers)
      Object.assign(G.cookers[id], { stage: "ready", stock: 9, t: 0 });
  });
  await expect(page.locator("#notify")).toHaveClass(/show/);
  await expect(page.locator("#notify")).toContainText("Online order");
  const firstCard = page.locator(".ocard").first();
  await expect(firstCard).toBeVisible();
  const orderId = await firstCard.getAttribute("data-order");
  const card = page.locator(`.ocard[data-order="${orderId}"]`);
  await card.dispatchEvent("pointerdown");
  await expect(card).toHaveClass(/sel/);
  // Pack outstanding portions through real buttons, waiting for a batch if a
  // pan needs cooking again. Later incoming orders must not retarget this test.
  for (let attempt = 0; attempt < 80; attempt++) {
    const next = await page.evaluate(
      (id) =>
        window.__mp.Game.orders
          .find((order) => order.id === id)
          ?.items.find((it) => it.got < it.need)?.f,
      orderId,
    );
    if (!next) break;
    const button = page.locator(`.food[data-id="${next}"]`);
    if ((await button.getAttribute("data-stage")) !== "cooking")
      await button.dispatchEvent("pointerdown");
    await page.waitForTimeout(280);
  }
  await expect(card).toHaveClass(/done/);
  const before = await page.evaluate(() => window.__mp.Game.served);
  await card.locator(".osend").dispatchEvent("pointerdown");
  await expect(card).toHaveCount(0, { timeout: 5000 });
  const g = await page.evaluate(() => {
    const G = window.__mp.Game;
    return {
      served: G.served,
      packs: G.packCost,
      fees: G.riderFees,
      bikes: G.bikes.length,
    };
  });
  expect(g.served).toBe(before + 1);
  expect(g.packs).toBe(150);
  expect(g.fees).toBe(1000); // no rider hired, so an outside rider was called
});

test("food finishes: customers complain until the pot is cooked again", async ({
  page,
}) => {
  await boot(page, fresh());
  await startLevel(page, 6);
  await waitPlaying(page);
  await page.evaluate(() => {
    const G = window.__mp.Game;
    for (const id in G.cookers) {
      const ck = G.cookers[id];
      if (ck.spec.hold === Infinity) {
        ck.stock = 0;
        ck.stage = "raw";
      }
    }
  });
  const jollof = page.locator('.food[data-id="jollof"]');
  await expect(jollof).toHaveAttribute("data-stage", "raw");
  await expect(jollof.locator(".lbl")).toHaveText("Finished!");
  await jollof.dispatchEvent("pointerdown");
  await expect(jollof).toHaveAttribute("data-stage", "cooking");
  await expect(jollof).toHaveAttribute("data-stage", "ready", {
    timeout: 8000,
  });
  expect(await page.evaluate(() => window.__mp.Game.foodCost)).toBeGreaterThan(
    0,
  );
});

test("shift ledger: salaries paid, unpaid strike when broke, quit at three", async ({
  page,
}) => {
  await boot(page, fresh({ coins: 0, staff: ["chidi"], unpaid: { chidi: 2 } }));
  await startLevel(page, 1);
  await waitPlaying(page);
  await page.evaluate(() => window.__mp.Game.finish(false, "time"));
  await expect(page.locator("#ovFail")).toHaveClass(/show/, {
    timeout: 10_000,
  });
  const ledger = page.locator("#failLedger");
  await expect(ledger).toContainText("Reputation");
  const d = await saved(page);
  // Nothing sold and nothing saved, so Chidi was not paid a third time and quit.
  expect(d.staff).toEqual([]);
  await expect(ledger).toContainText("Chidi quit");
});

test("sack staff from the shop", async ({ page }) => {
  await boot(page, fresh({ staff: ["chidi"] }));
  await page.locator("#btnStaff").click({ force: true });
  const card = page.locator(".card", { hasText: "Apprentice server" });
  await card.locator(".btn", { hasText: "Sack" }).click();
  await card.locator(".btn", { hasText: "Sure? Sack" }).click();
  await expect(card.locator(".btn")).toHaveText(/₦20,000/);
  expect((await saved(page)).staff).toEqual([]);
});

test("grow: open a branch in another place and visit it", async ({ page }) => {
  await boot(
    page,
    fresh({ coins: 80000, stats: { earn: 200000 }, reputation: 52 }),
  );
  await expect(page.locator("#menuRep")).toHaveText("52");
  await page.locator("#btnGrow").click({ force: true });
  await expect(page.locator("#ovGrow")).toHaveClass(/show/);
  await expect(page.locator("#growList")).toContainText("Busy Buka");
  const yaba = page.locator("#growList .card", { hasText: "Yaba Junction" });
  await yaba.locator(".btn").click();
  await expect(yaba.locator(".btn")).toHaveText(/Visit/);
  await yaba.locator(".btn").click();
  await expect(page.locator("#ovGrow")).not.toHaveClass(/show/);
  const d = await saved(page);
  expect(d).toMatchObject({ place: "yaba", coins: 20000 });
  expect(d.branches).toContain("yaba");
});

test("zoom in and out from the rail", async ({ page }) => {
  await boot(page, fresh());
  await startLevel(page, 3);
  await waitPlaying(page);
  const dist = () =>
    page.evaluate(() => {
      const c = window.__mp.camera.position;
      return Math.hypot(c.x, c.y, c.z);
    });
  const d0 = await dist();
  await page.locator("#zoomIn").click({ force: true });
  await page.locator("#zoomIn").click({ force: true });
  await page.waitForTimeout(1200);
  expect(await dist()).toBeLessThan(d0 * 0.85);
  await page.locator("#zoomOut").click({ force: true });
  await page.locator("#zoomOut").click({ force: true });
  await page.locator("#zoomOut").click({ force: true });
  await page.waitForTimeout(1200);
  expect(await dist()).toBeGreaterThan(d0);
});
