import { test, expect } from "@playwright/test";
import { boot, claimedToday, startLevel } from "./helpers.js";

test("every restaurant level applies the customer target and growing wash counter", async ({
  page,
}) => {
  const errors = await boot(page, {
    schema: 3,
    lastClaim: claimedToday(),
    quality: "low",
    unlocked: 100,
    branches: Array.from({ length: 10 }, (_, i) => "ch" + i),
  });
  for (const level of [1, 2, 11, 12, 30, 62, 100]) {
    await startLevel(page, level);
    const result = await page.evaluate(() => {
      const G = window.__mp.Game;
      G.introT = 0;
      G.update(0.05);
      G.spawnT = 999;
      G.updateTools();
      return {
        goal: G.cfg.goal,
        capacity: G.sink.capacity,
        text: document.querySelector("#washTxt").textContent,
      };
    });
    expect(result.goal).toBe(15 + 5 * (level - 1));
    expect(result.capacity).toBe(level + 3);
    if (level >= 11) expect(result.text).toBe(`0/${level + 3}`);
    await expect(page.locator("#hudProgTxt")).toContainText(
      `/ ${15 + 5 * (level - 1)} served`,
    );
  }
  const washing = await page.evaluate(() => {
    const G = window.__mp.Game;
    G.sink.plates = 2;
    G.wash(true);
    G.updateTools();
    return {
      text: document.querySelector("#washTxt").textContent,
      label: document.querySelector("#btnWash").getAttribute("aria-label"),
    };
  });
  expect(washing.text).toBe("2/103");
  expect(washing.label).toContain("Washing plates: 2 of 103");
  expect(errors).toEqual([]);
});

test("late shifts offer larger online orders and respect the growing active-order limit", async ({
  page,
}) => {
  await boot(page, {
    schema: 3,
    lastClaim: claimedToday(),
    quality: "low",
    unlocked: 100,
    branches: Array.from({ length: 10 }, (_, i) => "ch" + i),
  });
  await startLevel(page, 62);
  const result = await page.evaluate(() => {
    const G = window.__mp.Game;
    G.introT = 0;
    G.update(0.05);
    G.spawnT = 999;
    G.eventT = Infinity;
    G.orders = [];
    for (let i = 0; i < 6; i++) {
      G.orderT = 0;
      G.updateOrders(0.01);
    }
    return {
      orders: G.orders.length,
      quantities: G.orders.flatMap((o) => o.items.map((it) => it.need)),
      delay: G.orderT,
    };
  });
  expect(result.orders).toBe(4);
  expect(result.quantities.length).toBeGreaterThan(0);
  expect(result.quantities.every((n) => n === 3)).toBe(true);
  expect(result.delay).toBeGreaterThan(0);
  await expect(page.locator(".ocard")).toHaveCount(4);
});
