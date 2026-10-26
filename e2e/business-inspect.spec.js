import { test, expect } from "@playwright/test";
import { boot, claimedToday, startLevel, waitPlaying } from "./helpers.js";

const fresh = (patch = {}) => ({
  schema: 3,
  lastClaim: claimedToday(),
  ...patch,
});

// Brings the inspector straight to the counter with a dirty kitchen.
async function dirtyInspection(page) {
  await boot(page, fresh({ unlocked: 25, branches: ["ch0", "ch1", "ch2"] }));
  await startLevel(page, 21);
  await waitPlaying(page);
  await page.evaluate(() => {
    const G = window.__mp.Game;
    G.updateHygiene = () => {
      G.hygiene = 40;
    };
    G.hygiene = 40;
    G.inspectT = 0;
  });
  await expect(page.locator("#ovInspect")).toHaveClass(/show/, {
    timeout: 30_000,
  });
}

test("inspector: a lowball offer gets slang back and the shift waits", async ({
  page,
}) => {
  await dirtyInspection(page);
  expect(await page.evaluate(() => window.__mp.Game.state)).toBe("talk");
  await expect(page.locator("#inspLine")).not.toBeEmpty();
  await expect(page.locator("#inspPay")).toContainText("Pay the fine");
  // Make him a greedy, not-honest inspector so the smallest offer is refused.
  await page.evaluate(() => {
    const t = window.__mp.Game.talk;
    t.mood.honest = false;
    t.mood.price = 0.65;
  });
  await page.locator("#inspOffer0").click();
  await expect(page.locator("#inspLine")).toHaveText(
    /rage bait|whine|this one|small boy|transport/i,
  );
  await expect(page.locator("#inspOffer0")).toBeDisabled();
  // A fair offer settles it: no fine, the shift carries on.
  await page.locator("#inspOffer2").click();
  await expect(page.locator("#ovInspect")).not.toHaveClass(/show/);
  const after = await page.evaluate(() => ({
    state: window.__mp.Game.state,
    fines: window.__mp.Game.fines,
    settled: window.__mp.Game.settlements,
  }));
  expect(after).toMatchObject({ state: "playing", fines: 0 });
  expect(after.settled).toBeGreaterThan(0);
});

test("inspector: paying the official fine", async ({ page }) => {
  await dirtyInspection(page);
  const fine = await page.evaluate(() => window.__mp.Game.talk.fine);
  await page.locator("#inspPay").click();
  await expect(page.locator("#ovInspect")).not.toHaveClass(/show/);
  expect(await page.evaluate(() => window.__mp.Game.fines)).toBe(fine);
});

test("hold a table on the menu to drag it somewhere else", async ({ page }) => {
  await boot(page, fresh({ unlocked: 3, equipBy: { ch0: { tables: 2 } } }));
  const start = await page.evaluate(() => {
    const { camera } = window.__mp;
    const t = window.__mp.diningTables[1];
    const v = t.g.getWorldPosition(new camera.position.constructor());
    v.y = 0.75;
    v.project(camera);
    return {
      x: ((v.x + 1) / 2) * innerWidth,
      y: ((1 - v.y) / 2) * innerHeight,
      from: [t.x, t.z],
    };
  });
  // The menu buttons may cover the table on a phone; drop them out of the way.
  await page.evaluate(() =>
    document
      .querySelectorAll("#scrMenu .menuBtns, #scrMenu .logo")
      .forEach((e) => (e.style.display = "none")),
  );
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(700);
  for (let i = 1; i <= 10; i++) await page.mouse.move(start.x + i * 4, start.y);
  await page.mouse.up();
  const after = await page.evaluate(() => ({
    saved: window.__mp.Save.d.layout?.[window.__mp.Save.d.place]?.tables?.[1],
  }));
  expect(after.saved).toBeTruthy();
  expect(after.saved).not.toEqual(start.from);
});
