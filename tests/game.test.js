import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  levelCfg,
  dailyCfg,
  endlessCfg,
  FOODS,
  UPGRADES,
} from "../src/game/data.js";
import { createSave } from "../src/systems/SaveManager.js";
import { scoreOrder } from "../src/game/scoring.js";
import {
  needsFood,
  fillOrder,
  orderComplete,
} from "../src/game/OrderSystem.js";
import { createGameStore } from "../src/store/gameStore.js";

// Execute the original data formulas as an independent regression oracle.
const original = readFileSync(
  new URL("../mama-put-rush.html", import.meta.url),
  "utf8",
);
const utils = original
  .split("/* ================= UTILS ================= */")[1]
  .split("const REDUCED=")[0];
const data = original
  .split("/* ================= GAME DATA ================= */")[1]
  .split("/* ================= AUDIO MANAGER")[0];
function reference(unlocked, date) {
  const ctx = vm.createContext({
    Date: class extends Date {
      constructor(...args) {
        super(...(args.length ? args : [date]));
      }
    },
    Save: { d: { unlocked } },
  });
  vm.runInContext(
    utils + data + ";globalThis.api={levelCfg,dailyCfg,endlessCfg};",
    ctx,
  );
  return ctx.api;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
afterEach(() => vi.useRealTimers());

describe("level configuration parity", () => {
  const ref = reference(50, "2026-10-24T12:00:00");
  for (let n = 1; n <= 50; n++)
    it(`matches every original formula at level ${n}`, () => {
      expect(plain(levelCfg(n))).toEqual(plain(ref.levelCfg(n)));
    });
  it("preserves tutorials, chapter transitions and all bosses", () => {
    expect(levelCfg(1)).toMatchObject({ lanes: 1, goal: 5, tutorial: true });
    expect(levelCfg(2).tutorial).toBe(true);
    expect(levelCfg(3).tutorial).toBe(false);
    expect(levelCfg(11).lanes).toBe(2);
    expect(levelCfg(23).lanes).toBe(3);
    for (const n of [10, 20, 30, 40, 50]) expect(levelCfg(n).boss).toBe(true);
    expect(Object.keys(FOODS)).toHaveLength(11);
    expect(UPGRADES.map((u) => u.costs.length)).toEqual([5, 5, 5, 5]);
  });
  it("preserves the initial endless configuration", () => {
    expect(plain(endlessCfg())).toEqual(plain(ref.endlessCfg()));
    expect(endlessCfg().duration).toBe(Infinity);
  });
});

describe("date seeded daily challenge", () => {
  for (const date of [
    "2026-01-01T12:00:00",
    "2026-10-24T12:00:00",
    "2026-12-31T12:00:00",
  ]) {
    for (const unlocked of [1, 12, 37, 51])
      it(`matches original for ${date}, unlock ${unlocked}`, () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(date));
        const ref = reference(unlocked, date),
          cfg = dailyCfg(unlocked);
        // Functions are excluded; all resulting modifiers and numeric fields must match.
        expect(plain(cfg)).toEqual(plain(ref.dailyCfg()));
        expect(new Set(cfg.mods.map((m) => m.id)).size).toBe(2);
        expect(cfg.tutorial).toBe(false);
        expect(cfg.mode).toBe("daily");
      });
  }
  it("uses the supplied date seed deterministically", () => {
    expect(plain(dailyCfg(50, "2026-10-24"))).toEqual(
      plain(dailyCfg(50, "2026-10-24")),
    );
  });
});

describe("scoring and coins", () => {
  const score = (overrides = {}) =>
    scoreOrder({
      base: 100,
      combo: 0,
      patienceRatio: 0.5,
      vip: false,
      tips: 0,
      coinMult: 1,
      ...overrides,
    });
  it("rounds base and combo awards to nearest five", () => {
    expect(score({ base: 35, combo: 1 })).toEqual({ points: 40, coins: 40 });
    expect(score({ combo: 4 })).toEqual({ points: 140, coins: 140 });
  });
  it("caps combo multiplier at ten", () =>
    expect(score({ combo: 25 })).toEqual(score({ combo: 10 })));
  it("applies fast bonus only strictly above 60 percent patience", () => {
    expect(score({ patienceRatio: 0.6 }).points).toBe(100);
    expect(score({ patienceRatio: 0.6001 }).points).toBe(125);
  });
  it("stacks VIP, fast, combo, upgrade tips and daily multiplier", () => {
    expect(
      score({ combo: 10, patienceRatio: 0.9, vip: true, tips: 5, coinMult: 2 }),
    ).toEqual({ points: 500, coins: 1500 });
  });
});

describe("save compatibility", () => {
  function storage(initial) {
    let value = initial;
    return {
      getItem: () => value,
      setItem: (_key, next) => {
        value = next;
      },
    };
  }
  it("keeps the original key and complete defaults", () => {
    const save = createSave(storage(null));
    save.load();
    expect(save.key).toBe("mamaPutRush3D.v1");
    expect(save.d).toEqual(save.defaults());
    expect(save.d.coins).toBe(120);
  });
  it("loads old saves while merging missing upgrade defaults", () => {
    const save = createSave(
      storage(
        JSON.stringify({
          coins: 999,
          unlocked: 31,
          up: { fast: 3 },
          stars: { 1: 3 },
          outfit: "royal",
        }),
      ),
    );
    save.load();
    expect(save.d).toMatchObject({
      coins: 999,
      unlocked: 31,
      up: { fast: 3, patience: 0, time: 0, tips: 0 },
      stars: { 1: 3 },
      outfit: "royal",
    });
    expect(save.d.music).toBe(true);
  });
  it("recovers from corrupt JSON and inaccessible storage", () => {
    const save = createSave(storage("{bad"));
    save.load();
    expect(save.d).toEqual(save.defaults());
    const blocked = createSave({
      getItem() {
        throw Error("denied");
      },
      setItem() {
        throw Error("quota");
      },
    });
    expect(() => {
      blocked.load();
      blocked.save();
    }).not.toThrow();
  });
  it("round trips progress with the original shape", () => {
    const mem = storage(null),
      save = createSave(mem);
    save.load();
    save.d.coins = 450;
    save.d.up.time = 4;
    save.save();
    const next = createSave(mem);
    next.load();
    expect(next.d).toEqual(save.d);
  });
});

describe("order matching", () => {
  it("accepts only an outstanding item for a waiting customer", () => {
    const order = [
      { f: "jollof", done: false },
      { f: "drink", done: false },
    ];
    expect(needsFood("enter", order, "jollof")).toBe(false);
    expect(needsFood("wait", order, "suya")).toBe(false);
    expect(needsFood("wait", order, "jollof")).toBe(true);
    expect(fillOrder(order, "jollof")).toEqual({ index: 0, slot: 0 });
    expect(needsFood("wait", order, "jollof")).toBe(false);
    expect(orderComplete(order)).toBe(false);
    expect(fillOrder(order, "drink")).toEqual({ index: 1, slot: 1 });
    expect(orderComplete(order)).toBe(true);
  });
  it("rejects wrong food without changing the tray or order", () => {
    const order = [{ f: "egusi", done: false }],
      before = plain(order);
    expect(fillOrder(order, "suya")).toEqual({ index: -1, slot: -1 });
    expect(order).toEqual(before);
  });
  it("fills duplicate items once each and tracks completion slots", () => {
    const order = [
      { f: "drink", done: false },
      { f: "drink", done: false },
    ];
    expect(fillOrder(order, "drink")).toEqual({ index: 0, slot: 0 });
    expect(fillOrder(order, "drink")).toEqual({ index: 1, slot: 1 });
    expect(fillOrder(order, "drink").index).toBe(-1);
  });
});

it("publishes stable store snapshots only on UI changes and unsubscribes", () => {
  const store = createGameStore(),
    listener = vi.fn(),
    first = store.getSnapshot(),
    off = store.subscribe(listener);
  expect(store.getSnapshot()).toBe(first);
  store.update({ screen: "scrMap" });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot()).not.toBe(first);
  off();
  store.update({ screen: "scrMenu" });
  expect(listener).toHaveBeenCalledTimes(1);
});
