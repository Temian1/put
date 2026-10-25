import { test, expect } from "@playwright/test";
import { boot, claimedToday } from "./helpers.js";

// Regression: modals taller than a small phone must scroll with a finger drag.
test.use({ viewport: { width: 360, height: 640 } });

test("tall modals scroll with a finger drag", async ({ page }) => {
  await boot(page, {
    schema: 3,
    lastClaim: claimedToday(),
    coins: 900000,
    unlocked: 30,
    branches: ["ch0", "ch1", "ch2"],
  });
  const cdp = await page.context().newCDPSession(page);
  const drag = async () => {
    const touch = (type, y) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: y === undefined ? [] : [{ x: 180, y }],
      });
    await touch("touchStart", 500);
    for (const y of [420, 340, 260, 200]) {
      await touch("touchMove", y);
      await page.waitForTimeout(30);
    }
    await touch("touchEnd");
    await page.waitForTimeout(600);
  };
  for (const [open, overlay, close] of [
    ["#btnGrow", "#ovGrow", "#growClose"],
    ["#btnSettings", "#ovSettings", "#sClose"],
    ["#btnMarket", "#ovMarket", "#marketClose"],
  ]) {
    await page.locator(open).click({ force: true });
    await expect(page.locator(overlay)).toHaveClass(/show/);
    await page.waitForTimeout(500);
    await drag();
    const scrolled = await page
      .locator(overlay)
      .evaluate((e) =>
        Math.max(
          e.scrollTop,
          ...[...e.querySelectorAll(".scroll")].map((x) => x.scrollTop),
        ),
      );
    expect(scrolled, overlay).toBeGreaterThan(40);
    await page.locator(close).scrollIntoViewIfNeeded();
    await page.locator(close).click({ force: true });
    await expect(page.locator(overlay)).not.toHaveClass(/show/);
  }
});
