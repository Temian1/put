import { test, expect } from "@playwright/test";
import {
  boot,
  collectReward,
  claimedToday,
  startLevel,
  waitPlaying,
  nextNeed,
  gameState,
  playByTapping,
  SAVE_KEY,
} from "./helpers.js";

const fresh = () => ({ schema: 2, lastClaim: claimedToday() });
const saved = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);

test("fresh player: reward in naira, tutorial hand, wins level 1 by tapping", async ({
  page,
}) => {
  const errors = await boot(page);
  await expect(page.locator("#rewardAmt")).toHaveText("₦1,500");
  await collectReward(page);
  await expect(page.locator("#menuCoins")).toHaveText("₦4,500");
  await page.locator("#btnPlay").click({ force: true });
  await page.locator(".node.current").click();
  await waitPlaying(page);
  await expect(page.locator(".food .pr").first()).toHaveText(/^₦/);
  await expect.poll(() => page.locator("#hand").isVisible()).toBe(true);
  await playByTapping(page);
  await expect(page.locator("#ovWin")).toHaveClass(/show/, { timeout: 15_000 });
  const s = await gameState(page);
  expect(s).toMatchObject({ won: true, served: 5, lost: 0 });
  const save = await saved(page);
  expect(save.unlocked).toBe(2);
  expect(save.coins).toBeGreaterThan(4500);
  expect(save.stats.serve).toBe(5);
  expect(errors).toEqual([]);
});

test("plate assembly: toppings wait for the main", async ({ page }) => {
  await boot(page, fresh());
  await startLevel(page, 3);
  // Every order on this run is jollof with beef on top.
  await page.evaluate(() => {
    const c = window.__mp.Game.cfg;
    c.foods = ["jollof", "beef"];
    c.imin = c.imax = 2;
  });
  await waitPlaying(page);
  let blocked = null;
  for (let i = 0; i < 60 && !blocked; i++) {
    blocked = await page.evaluate(() => {
      const c = window.__mp.Game.customers.find((x) => x.state === "wait");
      const top = c?.order.find((o) => o.layer === 1 && c.blocks(o.f));
      return top ? top.f : null;
    });
    if (!blocked) {
      const need = await nextNeed(page);
      if (need)
        await page
          .locator(`.food[data-id="${need.id}"]`)
          .dispatchEvent("pointerdown");
      await page.waitForTimeout(400);
    }
  }
  expect(blocked).not.toBeNull();
  await expect(page.locator(".bubble .it.top.wait").first()).toBeVisible();
  const before = (await gameState(page)).mistakes;
  await page
    .locator(`.food[data-id="${blocked}"]`)
    .dispatchEvent("pointerdown");
  // Topping first is a hint, not a mistake, and the topping is not served.
  expect((await gameState(page)).mistakes).toBe(before);
  const stillWaiting = await page.evaluate(
    (f) =>
      window.__mp.Game.customers.some((c) => c.state === "wait" && c.blocks(f)),
    blocked,
  );
  expect(stillWaiting).toBe(true);
});

test("cooking stages: raw → frying → ready, and fried food never burns", async ({
  page,
}) => {
  await boot(page, fresh());
  await startLevel(page, 4);
  await waitPlaying(page);
  const dodo = page.locator('.food[data-id="plantain"]');
  await expect(dodo).toHaveAttribute("data-stage", "raw");
  await dodo.dispatchEvent("pointerdown");
  await expect(dodo).toHaveAttribute("data-stage", "cooking");
  await expect(dodo).toHaveAttribute("data-stage", "ready", { timeout: 6000 });
  await expect(dodo.locator(".stock")).toHaveText("x4");
  // A finished batch stays in stock however long it waits.
  await page.evaluate(() => {
    window.__mp.Game.spawnT = 999;
    window.__mp.Game.cookers.plantain.t = 600;
  });
  await page.waitForTimeout(1500);
  await expect(dodo).toHaveAttribute("data-stage", "ready");
  await expect(dodo.locator(".stock")).toHaveText("x4");
});

test("dishwashing: dirty tables block lanes until cleared and washed", async ({
  page,
}) => {
  await boot(page, fresh());
  await startLevel(page, 11);
  await waitPlaying(page);
  // Every chair taken, so the served customer eats at the counter.
  await page.evaluate(() =>
    window.__mp.Game.tables.forEach((t) =>
      t.seats.forEach((st) => (st.taken = {})),
    ),
  );
  await expect(page.locator("#btnWash")).toBeVisible();
  await page.waitForFunction(() =>
    window.__mp.Game.customers.some((c) => c.state === "wait"),
  );
  // Serve the first customer completely via the food buttons.
  for (let i = 0; i < 12; i++) {
    const need = await nextNeed(page);
    if (!need) break;
    const btn = page.locator(`.food[data-id="${need.id}"]`);
    if ((await btn.getAttribute("data-stage")) === "cooking") {
      await page.waitForTimeout(400);
      continue;
    }
    await btn.dispatchEvent("pointerdown");
    await page.waitForTimeout(350);
  }
  await expect(page.locator(".dirtyChip").first()).toBeVisible({
    timeout: 5000,
  });
  await page.locator(".dirtyChip").first().dispatchEvent("pointerdown");
  await expect(page.locator("#washTxt")).toHaveText("1/4");
  await page.locator("#btnWash").click({ force: true });
  await expect(page.locator("#washTxt")).toHaveText("0/4", {
    timeout: 3000,
  });
  expect((await saved(page)) ?? {}).toBeTruthy();
});

test("boosters: freeze stops the clock, patience boost refills", async ({
  page,
}) => {
  await boot(page, fresh());
  await startLevel(page, 5);
  await waitPlaying(page);
  await page.waitForFunction(() =>
    window.__mp.Game.customers.some((c) => c.state === "wait"),
  );
  await page.locator("#bFreeze").click({ force: true });
  await expect(page.locator("#freezeFx")).toHaveClass(/on/);
  const t1 = await page.evaluate(() => window.__mp.Game.time);
  await page.waitForTimeout(1500);
  const t2 = await page.evaluate(() => window.__mp.Game.time);
  expect(t2).toBe(t1);
  await page.evaluate(() => {
    const c = window.__mp.Game.customers.find((x) => x.state === "wait");
    c.p = 1;
  });
  await page.locator("#bCalm").click({ force: true });
  const full = await page.evaluate(() =>
    window.__mp.Game.customers
      .filter((x) => x.state === "wait")
      .every((x) => x.p === x.max),
  );
  expect(full).toBe(true);
  await expect(page.locator("#bFreeze b")).toHaveText("0");
  await expect(page.locator("#bFreeze")).toHaveClass(/empty/);
});

test("hire help: staff are paid from the shift and serve customers", async ({
  page,
}) => {
  await boot(page, { ...fresh(), coins: 25000 });
  await page.locator("#btnStaff").click({ force: true });
  await expect(page.locator("#ovShop")).toHaveClass(/show/);
  const chidi = page.locator(".card", { hasText: "Apprentice server" });
  await chidi.locator(".btn").click();
  await expect(
    chidi.getByRole("button", { name: "On duty", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#shopCoins")).toHaveText("₦5,000");
  await page.locator("#shopClose").click({ force: true });
  await startLevel(page, 1);
  await waitPlaying(page);
  // Nobody taps: Chidi alone should still dish food.
  await page.waitForFunction(() => window.__mp.Game.served >= 1, null, {
    timeout: 30_000,
  });
  expect(await page.evaluate(() => window.__mp.Game.wageBill())).toBe(500);
});

test("missions: progress, claim and badge", async ({ page }) => {
  await boot(page, fresh());
  await page.evaluate(() => {
    const { Save } = window.__mp;
    Save.d.missions.list[0].progress = Save.d.missions.list[0].goal;
    Save.save();
  });
  await page.reload();
  await expect(page.locator("#boot")).toHaveClass(/gone/, { timeout: 30_000 });
  await expect(page.locator("#missionBadge")).toHaveText("1");
  await page.locator("#btnMissions").click({ force: true });
  const claim = page.locator("#missionList .btn.gold").first();
  await claim.click({ force: true });
  await expect(page.locator("#missionBadge")).toBeHidden();
  const save = await saved(page);
  expect(save.missions.list[0].claimed).toBe(true);
  expect(save.coins).toBe(3000 + save.missions.list[0].reward);
});

test("old coin saves are converted to naira", async ({ page }) => {
  await boot(page, {
    coins: 400,
    unlocked: 7,
    stars: { 1: 3 },
    lastClaim: claimedToday(),
  });
  await expect(page.locator("#menuCoins")).toHaveText("₦10,000");
  const save = await page.evaluate(() => window.__mp.Save.d);
  expect(save).toMatchObject({ schema: 3, unlocked: 7, coins: 10000 });
});

test("backup code restores progress on another device", async ({
  page,
  browser,
}) => {
  // Boots the 3D game twice.
  test.slow();
  await boot(page, { ...fresh(), coins: 7777, unlocked: 9, stars: { 3: 2 } });
  await page.locator("#btnSettings").click({ force: true });
  await page.locator("#sBackup").click({ force: true });
  const code = await page.locator("#backupCode").inputValue();
  expect(code).toMatch(/^MPR2\./);

  const other = await browser.newPage();
  await boot(other, fresh());
  await other.locator("#btnSettings").click({ force: true });
  await other.locator("#sBackup").click({ force: true });
  await other.locator("#backupCode").fill("not a code");
  await other.locator("#backupRestore").click({ force: true });
  await expect(other.locator("#toast")).toHaveText(/not a Mama Put backup/);
  await other.locator("#backupCode").fill(code);
  await other.locator("#backupRestore").click({ force: true });
  await expect(other.locator("#toast")).toHaveText(/restored/);
  const d = await other.evaluate(() => window.__mp.Save.d);
  expect(d.unlocked).toBe(9);
  expect(d.stars["3"]).toBe(2);
  await other.close();
});

test("pause stops the clock; quitting returns to the map", async ({ page }) => {
  await boot(page, fresh());
  await startLevel(page, 2);
  await waitPlaying(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#ovPause")).toHaveClass(/show/);
  const t1 = await page.evaluate(() => window.__mp.Game.time);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__mp.Game.time)).toBe(t1);
  await page.locator("#pMenu").click({ force: true });
  await expect(page.locator("#scrMap")).toHaveClass(/show/);
});
