import { test, expect } from "@playwright/test";
import { boot, claimedToday, startLevel, waitPlaying } from "./helpers.js";

const fresh = (patch = {}) => ({
  schema: 3,
  lastClaim: claimedToday(),
  ...patch,
});

test("service waves: a planning break between waves, saved progress", async ({
  page,
}) => {
  await boot(
    page,
    fresh({
      unlocked: 6,
      crew: { ch0: [{ uid: "c1", job: "chidi", name: "Chidi", off: false }] },
      crewSeq: 1,
    }),
  );
  await startLevel(page, 6);
  await waitPlaying(page);
  // Level 6 serves 40 customers in two waves of 20.
  await page.evaluate(() => {
    const G = window.__mp.Game;
    G.served = G.wavePrev = 19;
    G.served = 20;
    G.afterServe();
  });
  await expect(page.locator("#ovWave")).toHaveClass(/show/);
  await expect(page.locator("#waveTitle")).toHaveText("Wave 1 of 2 done!");
  expect(await page.evaluate(() => window.__mp.Game.state)).toBe("break");
  expect(await page.evaluate(() => window.__mp.Save.d.levelRun?.served)).toBe(
    20,
  );
  // Pick the crew's priority, then open the doors again.
  await page.locator("#pri-delivery").click();
  expect(await page.evaluate(() => window.__mp.Save.d.priority)).toBe(
    "delivery",
  );
  await page.locator("#waveGo").click();
  await expect(page.locator("#ovWave")).not.toHaveClass(/show/);
  expect(await page.evaluate(() => window.__mp.Game.state)).toBe("playing");
});

test("owner's special: plate it yourself for a premium", async ({ page }) => {
  await boot(page, fresh({ unlocked: 8 }));
  await startLevel(page, 8);
  await waitPlaying(page);
  await page.evaluate(() => {
    const G = window.__mp.Game;
    for (const ck of Object.values(G.cookers))
      Object.assign(ck, { stage: "ready", stock: 9 });
    G.specialT = 0;
  });
  await expect(page.locator("#btnSpecial")).toBeVisible({ timeout: 10_000 });
  const before = await page.evaluate(() => window.__mp.Game.coinsEarned);
  await page.locator("#btnSpecial").click({ force: true });
  await expect(page.locator("#ovSpecial")).toHaveClass(/show/);
  expect(await page.evaluate(() => window.__mp.Game.state)).toBe("special");
  await page.waitForTimeout(400);
  await page.locator("#specialPlate").click();
  await expect(page.locator("#ovSpecial")).not.toHaveClass(/show/);
  const after = await page.evaluate(() => ({
    coins: window.__mp.Game.coinsEarned,
    specials: window.__mp.Game.specials,
  }));
  expect(after.specials).toBe(1);
  expect(after.coins).toBeGreaterThan(before);
});
