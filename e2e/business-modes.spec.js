import { test, expect } from "@playwright/test";
import { boot, claimedToday, waitPlaying } from "./helpers.js";

const fresh = (patch = {}) => ({
  schema: 3,
  lastClaim: claimedToday(),
  ...patch,
});

test("endless: closing the game mid-run continues it on the next open", async ({
  page,
}) => {
  await boot(
    page,
    fresh({
      unlocked: 51,
      endlessRun: {
        active: true,
        score: 54000,
        coinsEarned: 54000,
        served: 14,
        lost: 1,
        lives: 2,
        combo: 0,
        bestCombo: 6,
        at: Date.now(),
      },
    }),
  );
  await page.waitForFunction(
    () => window.__mp.Game.cfg?.mode === "endless",
    null,
    {
      timeout: 15_000,
    },
  );
  await waitPlaying(page);
  const r = await page.evaluate(() => {
    const G = window.__mp.Game;
    return { score: G.score, served: G.served, lives: G.lives };
  });
  expect(r).toMatchObject({ score: 54000, served: 14, lives: 2 });
  // The run keeps saving while you play.
  await page.waitForTimeout(3500);
  const saved = await page.evaluate(() => window.__mp.Save.d.endlessRun);
  expect(saved).toMatchObject({ active: true, served: 14 });
});

test("watching an old restaurant: it serves customers by itself", async ({
  page,
}) => {
  await boot(
    page,
    fresh({
      unlocked: 15,
      branches: ["ch0", "ch1"],
      crew: {
        ch1: [{ uid: "c1", job: "mgr3", name: "Manager Bose", off: false }],
      },
      crewSeq: 1,
      pantry: {
        rice: 9,
        beans: 9,
        swallow: 9,
        veg: 9,
        meat: 9,
        chicken: 9,
        plantain: 9,
        drinks: 9,
      },
    }),
  );
  await page.locator("#btnGrow").click({ force: true });
  await page
    .locator("#growList .card", { hasText: "Junction Food Spot" })
    .locator(".btn", { hasText: "Watch" })
    .click();
  await waitPlaying(page);
  expect(await page.evaluate(() => window.__mp.Game.cfg.mode)).toBe("watch");
  await expect(page.locator("#foodBar")).toBeHidden();
  // Taps do nothing: it is hands-off.
  await page.evaluate(() => window.__mp.Game.tapFood("jollof"));
  await expect
    .poll(() => page.evaluate(() => window.__mp.Game.served), {
      timeout: 45_000,
    })
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__mp.Game.lives)).toBe(3);
});
