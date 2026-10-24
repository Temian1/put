import { test, expect } from "@playwright/test";
import { boot, claimedToday } from "./helpers.js";

// Regression for panels breaking off small and landscape phone screens.
const SIZES = [
  [320, 568],
  [360, 640],
  [390, 844],
  [667, 375],
  [844, 390],
];
const OVERLAYS = [
  ["#btnShop", "#ovShop", "#shopClose"],
  ["#btnStaff", "#ovShop", "#shopClose"],
  ["#btnMissions", "#ovMissions", "#missionsClose"],
  ["#btnDaily", "#ovDaily", "#dailyClose"],
  ["#btnSettings", "#ovSettings", "#sClose"],
];

async function expectFits(page, overlay) {
  const box = await page.evaluate((sel) => {
    const r = document.querySelector(sel + " .panel").getBoundingClientRect();
    const ov = document.querySelector(sel);
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      vw: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      scrolls: ov.scrollHeight <= ov.clientHeight + 1 || ov.scrollHeight > 0,
    };
  }, overlay);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.vw);
  // A panel taller than the screen must start on screen and scroll, not clip.
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.pageWidth).toBeLessThanOrEqual(box.vw);
}

for (const [width, height] of SIZES)
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("daily reward fits the screen", async ({ page }) => {
      await boot(page);
      await expect(page.locator("#ovReward")).toHaveClass(/show/);
      await page.waitForTimeout(500);
      await expectFits(page, "#ovReward");
      await expect(page.locator("#rewardClaim")).toBeInViewport();
    });

    test("menu overlays fit the screen", async ({ page }) => {
      await boot(page, { schema: 2, lastClaim: claimedToday(), coins: 5000 });
      for (const [open, overlay, close] of OVERLAYS) {
        await page.locator(open).click({ force: true });
        await expect(page.locator(overlay)).toHaveClass(/show/);
        await page.waitForTimeout(500);
        await expectFits(page, overlay);
        await page.locator(close).scrollIntoViewIfNeeded();
        await page.locator(close).click({ force: true });
        await expect(page.locator(overlay)).not.toHaveClass(/show/);
      }
    });

    test("game HUD stays inside the screen", async ({ page }) => {
      await boot(page, { schema: 2, lastClaim: claimedToday(), unlocked: 50 });
      await page.evaluate(() => {
        const { Game, levelCfg } = window.__mp;
        Game.start(levelCfg(45));
        Game.score = 250000;
        Game.coinsEarned = 199000;
        Game.updateHUD(true);
      });
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll("#hudTop *, #foodBar *")]
          .filter((e) => e.getClientRects().length)
          .some((e) => e.getBoundingClientRect().right > innerWidth + 1),
      );
      expect(overflow).toBe(false);
    });
  });
