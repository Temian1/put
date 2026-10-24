import { test, expect } from "@playwright/test";
import { boot, claimedToday } from "./helpers.js";

// Screenshot regression for the HTML panels. The WebGL scene and customer
// bubbles behind them are hidden because GPU output differs between machines.
test.use({ viewport: { width: 360, height: 740 } });
const opts = { maxDiffPixelRatio: 0.02, animations: "disabled" };
const hideScene = (page) =>
  page.addStyleTag({
    content: "#gl,#world,#confetti{visibility:hidden!important}",
  });

test("daily reward panel", async ({ page }) => {
  await boot(page);
  await expect(page.locator("#ovReward")).toHaveClass(/show/);
  await hideScene(page);
  await page.waitForTimeout(700);
  await expect(page).toHaveScreenshot("reward.png", opts);
});

test("staff shop panel", async ({ page }) => {
  await boot(page, { schema: 2, lastClaim: claimedToday(), coins: 50000 });
  await page.locator("#btnStaff").click({ force: true });
  await hideScene(page);
  await page.waitForTimeout(700);
  await expect(page).toHaveScreenshot("staff.png", opts);
});
