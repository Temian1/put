import { test, expect } from "@playwright/test";
import { boot, claimedToday, startLevel, waitPlaying } from "./helpers.js";

const fresh = (patch = {}) => ({
  schema: 3,
  lastClaim: claimedToday(),
  ...patch,
});

test("a server brings every ready dish of an order in one trip", async ({
  page,
}) => {
  await boot(page, fresh({ staff: ["chidi"], unlocked: 5 }));
  await startLevel(page, 5);
  await waitPlaying(page);
  await page.waitForFunction(
    () => window.__mp.Game.customers.length > 0,
    null,
    {
      timeout: 15_000,
    },
  );
  const r = await page.evaluate(() => {
    const G = window.__mp.Game;
    for (const ck of Object.values(G.cookers))
      Object.assign(ck, { stage: "ready", stock: 9 });
    const foods = G.cfg.foods.filter((f) => window.__mp.stations[f]);
    const c = G.customers[0];
    if (!c) return { skipped: true };
    c.state = "wait";
    c.order = foods.slice(0, 2).map((f) => ({ f, layer: null, done: false }));
    c.items = c.order.map(() => document.createElement("i"));
    const delivered = [];
    const real = G.deliver.bind(G);
    G.deliver = (cust, f, from) => {
      delivered.push(f);
      real(cust, f, from);
    };
    const h = G.helpers[0];
    h.t = 0;
    h.act();
    h.job.run();
    return { delivered, want: c.order.map((o) => o.f) };
  });
  expect(r.skipped).toBeUndefined();
  expect(r.delivered.sort()).toEqual(r.want.sort());
});

test("staff work only at the restaurant that hired them; managers bank money", async ({
  page,
}) => {
  await boot(
    page,
    fresh({
      coins: 900000,
      unlocked: 15,
      branches: ["ch0", "ch1"],
      crew: {
        ch0: [{ uid: "c1", job: "chidi", name: "Chidi", off: false }],
        ch1: [
          { uid: "c2", job: "mgr3", name: "Manager Bose", off: false },
          { uid: "c3", job: "tunde", name: "Tunde", off: false },
        ],
      },
      crewSeq: 3,
    }),
  );
  await startLevel(page, 3);
  await waitPlaying(page);
  const names = await page.evaluate(() =>
    window.__mp.Game.helpers.map((h) => h.spec.name),
  );
  expect(names).toEqual(["Chidi"]);
  // Finish the shift at home: the Yaba manager banks takings in the safe.
  await page.evaluate(() => {
    const G = window.__mp.Game;
    G.settle(10000, 0);
    window.__mp.Save.save();
  });
  const till = await page.evaluate(() => window.__mp.Save.d.till.ch1);
  expect(till).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator("#boot")).toHaveClass(/gone/, { timeout: 30_000 });
  await page.locator("#btnGrow").click({ force: true });
  await expect(page.locator("#growList")).toContainText("Manager Bose");
  const before = await page.evaluate(() => window.__mp.Save.d.coins);
  await page.locator(".collectAll").click();
  const after = await page.evaluate(() => window.__mp.Save.d.coins);
  expect(after - before).toBe(till);
});

test("hiring: several servers per restaurant, each with their own name", async ({
  page,
}) => {
  await boot(
    page,
    fresh({ coins: 900000, unlocked: 15, branches: ["ch0", "ch1"] }),
  );
  await page.locator("#btnStaff").click({ force: true });
  await expect(page.locator("#ovShop")).toHaveClass(/show/);
  const hireServer = page
    .locator("#shopList .card.staff", { hasText: "Apprentice server" })
    .locator("button");
  await hireServer.click();
  await hireServer.click();
  await expect(page.locator("#shopList .card.crew")).toHaveCount(2);
  const crew = await page.evaluate(() => window.__mp.Save.d.crew.ch0);
  expect(crew).toHaveLength(2);
  expect(crew[0].name).not.toBe(crew[1].name);
  // Managers are hired for other restaurants, not the first one.
  await expect(page.locator("#shopList")).not.toContainText("Expert manager");
  await page.locator(".placeChips .placeChip", { hasText: "Junction" }).click();
  await expect(page.locator("#shopList")).toContainText("Expert manager");
});

test("litter: customers' rubbish is swept by tapping or by the cleaner", async ({
  page,
}) => {
  await boot(page, fresh({ unlocked: 13, staff: ["bisi"], place: "ch1" }));
  await startLevel(page, 13);
  await waitPlaying(page);
  await expect(page.locator("#hygiene")).toBeVisible();
  await page.evaluate(() => {
    const G = window.__mp.Game;
    G.dropLitter(1, -1.2);
    G.dropLitter(-2, -0.8);
  });
  await expect(page.locator(".dirtyChip.litter")).toHaveCount(2);
  await page.locator(".dirtyChip.litter").first().dispatchEvent("pointerdown");
  await expect
    .poll(() => page.evaluate(() => window.__mp.Game.litter.length))
    .toBe(1);
  // The cleaner walks out and sweeps the rest.
  await expect
    .poll(() => page.evaluate(() => window.__mp.Game.litter.length), {
      timeout: 20_000,
    })
    .toBe(0);
});

test("dragging the floor moves the camera; the centre button resets it", async ({
  page,
}) => {
  await boot(page, fresh({ unlocked: 3 }));
  await startLevel(page, 2);
  await waitPlaying(page);
  const box = await page.locator("#gl").boundingBox();
  // Drag across the empty road at the top of the scene.
  const y = box.y + box.height * 0.3;
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(box.x + box.width * (0.8 - i * 0.06), y);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const panned = await page.evaluate(() => window.__mp.camera.position.x);
  expect(Math.abs(panned)).toBeGreaterThan(0.5);
  await expect(page.locator("#camCenter")).toBeVisible();
  await page.locator("#camCenter").click({ force: true });
  await page.waitForTimeout(1200);
  const back = await page.evaluate(() => window.__mp.camera.position.x);
  expect(Math.abs(back)).toBeLessThan(0.2);
});
