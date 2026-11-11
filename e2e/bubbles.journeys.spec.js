import { test, expect } from "@playwright/test";
import { boot, claimedToday, startLevel, waitPlaying } from "./helpers.js";

// Customers standing side by side must not hide each other's orders.
test("order bubbles never cover each other", async ({ page }) => {
  await boot(page, { schema: 3, unlocked: 30, lastClaim: claimedToday() });
  await startLevel(page, 25);
  await waitPlaying(page);
  await page.waitForFunction(
    () => document.querySelectorAll(".bubble").length >= 3,
    null,
    { timeout: 40_000 },
  );
  let most = 0;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(400);
    const { count, overlaps } = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll(".bubble .in")]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0);
      let overlaps = 0;
      for (let a = 0; a < boxes.length; a++)
        for (let b = a + 1; b < boxes.length; b++) {
          const p = boxes[a],
            q = boxes[b];
          const w = Math.min(p.right, q.right) - Math.max(p.left, q.left);
          const h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
          if (w > 6 && h > 6) overlaps++;
        }
      return { count: boxes.length, overlaps };
    });
    most = Math.max(most, count);
    expect(overlaps, `${count} bubbles on screen`).toBe(0);
  }
  expect(most).toBeGreaterThanOrEqual(3);
});
