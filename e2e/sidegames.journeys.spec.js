import { test, expect } from "@playwright/test";
import { boot, claimedToday, SAVE_KEY } from "./helpers.js";

const saved = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);

test("Market Match: swap to match, win a level, rewards reach the restaurant", async ({
  page,
}) => {
  const errors = await boot(page, {
    schema: 3,
    lastClaim: claimedToday(),
    coins: 10000,
  });
  await page.locator("#btnMatch").click({ force: true });
  await expect(page.locator("#scrMatch")).toHaveClass(/show/);
  await expect(page.locator("#ovMatchStart")).toHaveClass(/show/);
  await page.locator("#m3Play").click({ force: true });
  await expect(page.locator("#m3Board .m3t")).toHaveCount(56);
  const moves = Number(await page.locator("#m3Moves").textContent());

  // A real move: swap two tiles that make a match.
  await page.evaluate(() => {
    const { Match } = window.__mp;
    const [a, b] = Match.hint();
    return Match.swap(a, b);
  });
  await expect(page.locator("#m3Moves")).toHaveText(String(moves - 1));
  await expect(page.locator("#m3Score")).not.toHaveText("0");
  await expect(page.locator("#m3Board .m3t")).toHaveCount(56);

  // Fill the goals, then one more move wins the level.
  await page.evaluate(() => {
    const { Match } = window.__mp;
    const d = Match.debug();
    d.spec.goals.forEach((g, i) => (d.progress[i] = g.n));
    const [a, b] = Match.hint();
    return Match.swap(a, b);
  });
  await expect(page.locator("#ovMatchEnd")).toHaveClass(/show/);
  await expect(page.locator("#m3EndTitle")).toHaveText(/complete|Perfect/);
  await expect(page.locator("#m3EndRewards .rewardRow").first()).toBeVisible();
  const d = await saved(page);
  expect(d.side.match.level).toBe(2);
  expect(d.coins).toBeGreaterThan(10000);
  expect(Object.values(d.pantry).some((n) => n > 0)).toBe(true);

  await page.locator("#m3EndMenu").click({ force: true });
  await expect(page.locator("#scrMenu")).toHaveClass(/show/);
  expect(errors).toEqual([]);
});

test("Okada Rush: locked before level 10, then deliver food and get paid", async ({
  page,
}) => {
  const errors = await boot(page, {
    schema: 3,
    lastClaim: claimedToday(),
    coins: 5000,
    unlocked: 5,
  });
  await page.locator("#btnRun").click({ force: true });
  await expect(page.locator("#toast")).toContainText("Level 10");
  await expect(page.locator("#scrRun")).not.toHaveClass(/show/);

  await page.evaluate(() => {
    window.__mp.Save.d.unlocked = 15;
  });
  await page.locator("#btnRun").click({ force: true });
  await expect(page.locator("#ovRunStart")).toHaveClass(/show/);
  await expect(page.locator("#runTier")).toContainText("Roadside rounds");
  await page.locator("#runGo").click({ force: true });
  await expect(page.locator("#scrRun")).toHaveClass(/show/);
  await page.waitForTimeout(3300); // countdown

  // Clear the road and put a customer just ahead in the rider's lane.
  await page.evaluate(() => {
    const r = window.__mp.Rush.debug();
    r.items = [{ id: 99999, type: "drop", lane: r.lane, z: r.dist + 8 }];
    r.genZ = r.dist + 60;
  });
  await expect(page.locator("#runDelivered")).toHaveText(/^1 \//, {
    timeout: 5000,
  });
  // Steering works from the keyboard.
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(() => page.evaluate(() => window.__mp.Rush.debug().lane))
    .toBe(-1);

  await page.evaluate(() => (window.__mp.Rush.debug().timeLeft = 0.05));
  await expect(page.locator("#ovRunEnd")).toHaveClass(/show/);
  await expect(page.locator("#runEndRows")).toContainText("Fuel");
  const d = await saved(page);
  expect(d.coins).toBeGreaterThan(5000);
  expect(d.side.log[0].game).toBe("run");

  await page.locator("#runEndMenu").click({ force: true });
  await expect(page.locator("#scrMenu")).toHaveClass(/show/);
  expect(errors).toEqual([]);
});
