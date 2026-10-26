import { test, expect } from "@playwright/test";
import {
  boot,
  claimedToday,
  startLevel,
  waitPlaying,
  SAVE_KEY,
} from "./helpers.js";

const fresh = (patch = {}) => ({
  schema: 2,
  lastClaim: claimedToday(),
  ...patch,
});
const saved = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_KEY);

test("workers: idle staff notice new work promptly and cooldown runs during travel", async ({
  page,
}) => {
  await boot(page, fresh({ staff: ["chidi"] }));
  await startLevel(page, 1);
  await waitPlaying(page);
  const result = await page.evaluate(() => {
    const h = window.__mp.Game.helpers[0];
    let checks = 0;
    h.t = 0;
    h.act = () => {
      checks++;
      return false;
    };
    for (let i = 0; i < 20; i++) h.update(0.05);
    const idleChecks = checks;
    checks = 0;
    h.t = h.spec.interval;
    h.go([h.home.clone().add({ x: 3, y: 0, z: 0 })], () => {}, 0.6);
    for (let i = 0; i < 110; i++) h.update(0.05);
    return {
      idleChecks,
      afterTravelChecks: checks,
      distanceHome: h.root.position.distanceTo(h.home),
    };
  });
  expect(result.idleChecks).toBeGreaterThanOrEqual(3);
  expect(result.afterTravelChecks).toBeGreaterThanOrEqual(1);
  expect(result.distanceHome).toBeLessThan(0.05);
});

test("workers: two servers reserve different takeaway tasks", async ({
  page,
}) => {
  await boot(page, fresh({ staff: ["chidi", "tunde"], place: "ch1" }));
  await page.evaluate(() =>
    window.__mp.Game.start({
      ...window.__mp.levelCfg(15),
      foods: ["jollof", "beef"],
      stock: true,
    }),
  );
  await waitPlaying(page);
  const result = await page.evaluate(() => {
    const G = window.__mp.Game;
    G.customers = [];
    G.orders = [
      {
        id: "staff-pack",
        items: [
          { f: "jollof", got: 0, need: 1 },
          { f: "beef", got: 0, need: 1 },
        ],
      },
    ];
    for (const ck of Object.values(G.cookers))
      Object.assign(ck, { stage: "ready", stock: 9 });
    for (const h of G.helpers) h.act();
    const packed = [];
    G.fillPack = (order, food) => {
      packed.push(food);
      order.items.find((i) => i.f === food).got++;
    };
    for (const h of G.helpers) h.job.run();
    return { packed, claims: G.claimed.size };
  });
  expect(result.packed.sort()).toEqual(["beef", "jollof"]);
  expect(result.claims).toBe(0);
});

test("workers: cooks prioritize waiting customers over speculative batches", async ({
  page,
}) => {
  await boot(page, fresh({ staff: ["basira"], place: "ch1" }));
  await page.evaluate(() =>
    window.__mp.Game.start({
      ...window.__mp.levelCfg(15),
      foods: ["jollof", "chicken"],
      stock: true,
      cooking: true,
    }),
  );
  await waitPlaying(page);
  const started = await page.evaluate(() => {
    const G = window.__mp.Game;
    const chicken = {
      spec: { time: 3.6, batch: 3, hold: Infinity },
      stage: "raw",
      stock: 0,
    };
    const jollof = G.cookers.jollof;
    Object.assign(chicken, { stage: "raw", stock: 0 });
    Object.assign(jollof, { stage: "raw", stock: 0 });
    G.cookers = { chicken, jollof };
    G.customers = [
      {
        state: "wait",
        p: 4,
        max: 20,
        order: [{ f: "jollof", layer: 0, done: false }],
      },
    ];
    G.orders = [];
    const calls = [];
    G.tapCookerFor = (id) => calls.push(id);
    const cook = G.helpers[0];
    cook.act();
    cook.job.run();
    return calls;
  });
  expect(started).toEqual(["jollof"]);
});

test("workers: cook and servers finish plates and replenish food without player taps", async ({
  page,
}) => {
  const errors = await boot(
    page,
    fresh({ staff: ["chidi", "tunde", "basira"] }),
  );
  await page.evaluate(() => {
    const { Game: G, levelCfg } = window.__mp;
    G.start({
      ...levelCfg(4),
      foods: ["jollof", "chicken"],
      imin: 2,
      imax: 2,
      goal: 4,
      patience: 80,
      duration: 180,
      gap: [1, 2],
      stock: true,
      cooking: true,
      assembly: true,
      dishes: false,
      tutorial: false,
    });
    G.cookers.jollof.stock = 1;
  });
  await waitPlaying(page);
  // Software WebGL can render only a few frames per second in CI. Advance
  // normal engine ticks between frames; serving and cooking remain real.
  const timer = await page.evaluate(() =>
    setInterval(() => {
      const G = window.__mp.Game;
      if (G.state === "playing") for (let i = 0; i < 5; i++) G.update(0.05);
    }, 50),
  );
  try {
    await page.waitForFunction(() => window.__mp.Game.served >= 4, null, {
      timeout: 45000,
    });
  } finally {
    await page.evaluate((id) => clearInterval(id), timer);
  }
  const result = await page.evaluate(() => ({
    served: window.__mp.Game.served,
    jollofBatches: window.__mp.Game.cookers.jollof.batches,
    chickenBatches: window.__mp.Game.cookers.chicken.batches,
    mistakes: window.__mp.Game.mistakes,
  }));
  expect(result.served).toBeGreaterThanOrEqual(4);
  expect(result.jollofBatches).toBeGreaterThanOrEqual(1);
  expect(result.chickenBatches).toBeGreaterThanOrEqual(2);
  expect(result.mistakes).toBe(0);
  expect(errors).toEqual([]);
});

test("online order: notification, pack items, send with a rider", async ({
  page,
}) => {
  await boot(page, fresh());
  await startLevel(page, 15);
  await waitPlaying(page);
  // Bring the first online order forward and stop walk-ins from taking food.
  await page.evaluate(() => {
    const G = window.__mp.Game;
    G.spawnT = 999;
    G.orderT = 0;
    // Every pan and pot ready, so each tap packs a portion.
    for (const id in G.cookers)
      Object.assign(G.cookers[id], { stage: "ready", stock: 9, t: 0 });
  });
  await expect(page.locator("#notify")).toHaveClass(/show/);
  await expect(page.locator("#notify")).toContainText("Online order");
  const firstCard = page.locator(".ocard").first();
  await expect(firstCard).toBeVisible();
  const orderId = await firstCard.getAttribute("data-order");
  const card = page.locator(`.ocard[data-order="${orderId}"]`);
  await card.dispatchEvent("pointerdown");
  await expect(card).toHaveClass(/sel/);
  // Pack outstanding portions through real buttons, waiting for a batch if a
  // pan needs cooking again. Later incoming orders must not retarget this test.
  for (let attempt = 0; attempt < 80; attempt++) {
    const next = await page.evaluate(
      (id) =>
        window.__mp.Game.orders
          .find((order) => order.id === id)
          ?.items.find((it) => it.got < it.need)?.f,
      orderId,
    );
    if (!next) break;
    const button = page.locator(`.food[data-id="${next}"]`);
    if ((await button.getAttribute("data-stage")) !== "cooking")
      await button.dispatchEvent("pointerdown");
    await page.waitForTimeout(280);
  }
  await expect(card).toHaveClass(/done/);
  const before = await page.evaluate(() => window.__mp.Game.served);
  await card.locator(".osend").dispatchEvent("pointerdown");
  await expect(card).toHaveCount(0, { timeout: 5000 });
  const g = await page.evaluate(() => {
    const G = window.__mp.Game;
    return {
      served: G.served,
      packs: G.packCost,
      fees: G.riderFees,
      bikes: G.bikes.length,
    };
  });
  expect(g.served).toBe(before + 1);
  expect(g.packs).toBe(150);
  expect(g.fees).toBe(1000); // no rider hired, so an outside rider was called
});

test("food finishes: customers complain until the pot is cooked again", async ({
  page,
}) => {
  await boot(page, fresh());
  await startLevel(page, 6);
  await waitPlaying(page);
  await page.evaluate(() => {
    const G = window.__mp.Game;
    for (const id in G.cookers) {
      const ck = G.cookers[id];
      if (ck.spec.hold === Infinity) {
        ck.stock = 0;
        ck.stage = "raw";
      }
    }
  });
  const jollof = page.locator('.food[data-id="jollof"]');
  await expect(jollof).toHaveAttribute("data-stage", "raw");
  await expect(jollof.locator(".lbl")).toHaveText("Finished!");
  await jollof.dispatchEvent("pointerdown");
  await expect(jollof).toHaveAttribute("data-stage", "cooking");
  await expect(jollof).toHaveAttribute("data-stage", "ready", {
    timeout: 8000,
  });
  expect(await page.evaluate(() => window.__mp.Game.foodCost)).toBeGreaterThan(
    0,
  );
});

test("payday: salaries build up, the player pays them, unpaid workers quit", async ({
  page,
}) => {
  // Day 9 of the month, with Chidi already unpaid once.
  await boot(
    page,
    fresh({
      coins: 0,
      day: 9,
      crew: {
        ch0: [
          {
            uid: "c1",
            job: "chidi",
            name: "Chidi",
            off: false,
            owed: 5000,
            strikes: 1,
          },
          { uid: "c2", job: "bisi", name: "Aunty Bisi", off: false, owed: 0 },
        ],
      },
      crewSeq: 2,
    }),
  );
  await startLevel(page, 1);
  await waitPlaying(page);
  await page.evaluate(() => window.__mp.Game.finish(false, "time"));
  await expect(page.locator("#ovFail")).toHaveClass(/show/, {
    timeout: 10_000,
  });
  const ledger = page.locator("#failLedger");
  // Month end: still unpaid twice, so Chidi quits; Bisi earned a day's wage.
  await expect(ledger).toContainText("Chidi quit");
  await expect(ledger).toContainText("Aunty Bisi was not paid this month");
  const d = await saved(page);
  expect(d.crew.ch0.map((m) => m.name)).toEqual(["Aunty Bisi"]);
  // Pay Bisi from the Staff screen.
  await page.evaluate(() => {
    window.__mp.Save.d.coins = 100000;
    window.__mp.Save.save();
  });
  await page.reload();
  await expect(page.locator("#boot")).toHaveClass(/gone/, { timeout: 30_000 });
  await expect(page.locator("#staffBadge")).toBeVisible();
  await page.locator("#btnStaff").click({ force: true });
  await page.locator(".payday .btn", { hasText: "Pay all" }).click();
  const after = await saved(page);
  expect(after.crew.ch0[0]).toMatchObject({ owed: 0, strikes: 0 });
  expect(after.coins).toBeLessThan(100000);
});

test("sack staff from the shop", async ({ page }) => {
  await boot(page, fresh({ staff: ["chidi"] }));
  await page.locator("#btnStaff").click({ force: true });
  const card = page.locator(".card", { hasText: "Apprentice server" });
  await card.locator(".btn", { hasText: "Sack" }).click();
  await card.locator(".btn", { hasText: "Sure? Sack" }).click();
  await expect(card.locator(".btn")).toHaveText(/₦20,000/);
  expect((await saved(page)).staff).toEqual([]);
});

test("grow: open the next restaurant, then visit the old one", async ({
  page,
}) => {
  await boot(
    page,
    fresh({
      schema: 3,
      coins: 200000,
      unlocked: 11,
      stats: { earn: 300000 },
      reputation: 52,
    }),
  );
  await expect(page.locator("#menuRep")).toHaveText("52");
  await page.locator("#btnGrow").click({ force: true });
  await expect(page.locator("#ovGrow")).toHaveClass(/show/);
  await expect(page.locator("#growList")).toContainText("Busy Buka");
  const junction = page.locator("#growList .card", {
    hasText: "Junction Food Spot",
  });
  await junction.locator(".btn").click();
  // Opening moves you to the new restaurant.
  await expect(junction.locator(".btn", { hasText: "Here" })).toBeVisible();
  let d = await saved(page);
  expect(d).toMatchObject({ coins: 150000, place: "ch1" });
  expect(d.branches).toContain("ch1");
  // Go back and visit the first buka.
  const first = page.locator("#growList .card", { hasText: "Roadside Buka" });
  await first.locator(".btn", { hasText: "Visit" }).click();
  await expect(page.locator("#ovGrow")).not.toHaveClass(/show/);
  d = await saved(page);
  expect(d.place).toBe("ch0");
});

test("level 11 stays locked until the owner pays to open the restaurant", async ({
  page,
}) => {
  await boot(page, fresh({ schema: 3, coins: 30000, unlocked: 11 }));
  await page.locator("#btnPlay").click({ force: true });
  await expect(page.locator(".chapOpen .btn").first()).toContainText("₦50,000");
  await page.locator(".chapOpen .btn").first().click();
  await expect(page.locator("#ovOpen")).toHaveClass(/show/);
  await expect(page.locator("#openSub")).toContainText("₦20,000 more");
  await page.locator("#openGo").click({ force: true });
  expect(await page.evaluate(() => window.__mp.Save.d.branches)).toEqual([
    "ch0",
  ]);
  await page.evaluate(() => (window.__mp.Save.d.coins = 60000));
  await page.locator("#openGo").click({ force: true });
  await page.waitForFunction(() => window.__mp.Game.cfg?.n === 11, null, {
    timeout: 10_000,
  });
  const d = await saved(page);
  expect(d.branches).toContain("ch1");
  expect(d.coins).toBe(10000);
});

test("zoom in and out from the rail", async ({ page }) => {
  await boot(page, fresh());
  await startLevel(page, 3);
  await waitPlaying(page);
  const dist = () =>
    page.evaluate(() => {
      const c = window.__mp.camera.position;
      return Math.hypot(c.x, c.y, c.z);
    });
  const d0 = await dist();
  await page.locator("#zoomIn").click({ force: true });
  await page.locator("#zoomIn").click({ force: true });
  await page.waitForTimeout(1200);
  expect(await dist()).toBeLessThan(d0 * 0.85);
  await page.locator("#zoomOut").click({ force: true });
  await page.locator("#zoomOut").click({ force: true });
  await page.locator("#zoomOut").click({ force: true });
  await page.waitForTimeout(1200);
  expect(await dist()).toBeGreaterThan(d0);
});
