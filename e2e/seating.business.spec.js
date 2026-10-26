import { test, expect } from "@playwright/test";
import { boot, claimedToday, startLevel, waitPlaying } from "./helpers.js";

async function startDining(page, level) {
  await startLevel(page, level);
  // Skip only the intro countdown so software-rendered browser tests do not
  // spend their timeout waiting for a couple of seconds of animation.
  await page.evaluate(() => { const G=window.__mp.Game; G.introT=0; G.update(.05); });
  await waitPlaying(page);
}

test("purchased chairs stay available for repeated dining and cleaning", async ({
  page,
}) => {
  await boot(page, {
    schema: 3,
    lastClaim: claimedToday(),
    equipBy: { ch1: { tables: 1 } },
    branches: ["ch0", "ch1"],
    unlocked: 12,
  });
  await startDining(page, 12);
  const result = await page.evaluate(() => {
    const G = window.__mp.Game;
    G.spawnT = 999;
    if (!G.customers.length) G.spawn();
    const c = G.customers[0];
    c.state = "wait";
    c.path = [];
    c.p = c.max;
    c.haggle = null;
    G.serve(c);
    for (let i = 0; i < 400 && c.state !== "eat"; i++) c.update(0.05);
    const eating = c.state;
    const seated = !!c.seat?.taken;
    if (c.state === "eat") G.finishMeal(c);
    return {
      tables: G.tables.length,
      eating,
      seated,
      free: G.tables.flatMap((t) => t.seats).filter((s) => !s.taken && !s.plate)
        .length,
      dirty: G.tables.reduce((n, t) => n + t.plates.length, 0),
    };
  });
  expect(result.tables).toBe(2);
  expect(result.eating).toBe("eat");
  expect(result.seated).toBe(true);
  expect(result.dirty).toBe(1);
  expect(result.free).toBe(3);
});

test("served customers wait for an occupied chair and sit when it frees", async ({
  page,
}) => {
  await boot(page, { schema: 3, lastClaim: claimedToday() });
  await startDining(page, 5);
  const r = await page.evaluate(() => {
    const G = window.__mp.Game;
    if (!G.customers.length) G.spawn();
    const c = G.customers[0];
    c.state = "wait";
    c.path = [];
    c.haggle = null;
    G.tables.flatMap((t) => t.seats).forEach((s) => (s.taken = {}));
    G.serve(c);
    c.update(1.1);
    const waiting = c.state;
    G.tables[0].seats[0].taken = null;
    c.update(0.05);
    for (let i = 0; i < 400 && c.state !== "eat"; i++) c.update(0.05);
    return { waiting, after: c.state };
  });
  expect(r).toEqual({ waiting: "seatWait", after: "eat" });
});

test("partially clearing a table immediately releases its cleared chair", async ({
  page,
}) => {
  await boot(page, {
    schema: 3,
    lastClaim: claimedToday(),
    unlocked: 12,
    branches: ["ch0", "ch1"],
  });
  await startDining(page, 12);
  const r = await page.evaluate(() => {
    const G = window.__mp.Game,
      t = G.tables[0];
    for (const s of t.seats) {
      s.table = t;
      s.taken = {};
      G.finishMeal({ seat: s, leave() {} });
    }
    G.sink.plates = G.sink.capacity - 1;
    G.clearDiningTable(0);
    return {
      dirty: t.plates.length,
      free: t.seats.filter((s) => !s.taken && !s.plate).length,
    };
  });
  expect(r).toEqual({ dirty: 1, free: 1 });
});
