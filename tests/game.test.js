import { describe, it, expect, vi, afterEach } from "vitest";
import {
  levelCfg,
  dailyCfg,
  endlessCfg,
  FOODS,
  CHAPTERS,
  UPGRADES,
  STAFF,
  BOOSTERS,
  UNLOCKS,
} from "../src/game/data.js";
import { createSave, migrate } from "../src/systems/SaveManager.js";
import { scoreOrder, tipFor, netAfterWages } from "../src/game/scoring.js";
import {
  needsFood,
  blockedFood,
  fillOrder,
  orderComplete,
  nextNeeded,
} from "../src/game/OrderSystem.js";
import { buildOrder, toItems, plateName } from "../src/game/recipes.js";
import { fmtNaira, fmtNairaShort, roundNaira } from "../src/game/currency.js";
import { createGameStore } from "../src/store/gameStore.js";
import { seeded } from "../src/game/utils.js";

const plain = (value) => JSON.parse(JSON.stringify(value));
afterEach(() => vi.useRealTimers());

describe("menu and prices", () => {
  it("sells real buka food at Lagos mainland prices", () => {
    for (const [id, f] of Object.entries(FOODS)) {
      expect(f.price, id).toBeGreaterThanOrEqual(100);
      expect(f.price, id).toBeLessThanOrEqual(3000);
      expect(f.price % 50, id).toBe(0);
      expect(["main", "soup", "protein", "side", "drink"]).toContain(f.kind);
    }
    expect(FOODS.water).toMatchObject({ name: "Pure Water", price: 100 });
    expect(FOODS.plantain.name).toBe("Dodo");
    for (const id of ["suya", "puffpuff", "smallchops", "partyjollof"])
      expect(FOODS[id]).toBeUndefined();
  });
  it("every chapter menu exists, has a drink, and swallows come with soup", () => {
    for (const ch of CHAPTERS) {
      ch.foods.forEach((f) => expect(FOODS[f], f).toBeDefined());
      expect(ch.foods.some((f) => FOODS[f].kind === "drink")).toBe(true);
      if (ch.foods.some((f) => FOODS[f].swallow))
        expect(ch.foods.some((f) => FOODS[f].kind === "soup")).toBe(true);
    }
  });
  it("a typical plate costs what a mainland buka charges", () => {
    const plate =
      FOODS.whiterice.price + FOODS.beef.price + FOODS.plantain.price;
    expect(plate).toBeGreaterThanOrEqual(1500);
    expect(plate).toBeLessThanOrEqual(2500);
  });
  it("shop items are priced in naira", () => {
    UPGRADES.forEach((u) => expect(u.costs[0]).toBeGreaterThanOrEqual(2000));
    STAFF.forEach((s) => {
      expect(s.cost).toBeGreaterThan(s.wage * 10);
      expect(["server", "cleaner", "cook", "rider", "errand"]).toContain(
        s.role,
      );
    });
    expect(BOOSTERS.map((b) => b.id)).toEqual(["freeze", "auto", "calm"]);
  });
});

describe("level configuration", () => {
  it("keeps tutorials, lanes and bosses", () => {
    expect(levelCfg(1)).toMatchObject({ lanes: 1, goal: 15, tutorial: true });
    expect(levelCfg(2).tutorial).toBe(true);
    expect(levelCfg(3).tutorial).toBe(false);
    expect(levelCfg(11).lanes).toBe(2);
    expect(levelCfg(23).lanes).toBe(3);
    for (const n of [10, 20, 30, 40, 50]) expect(levelCfg(n).boss).toBe(true);
  });
  it("grows customer targets from 15 past 100 without chapter resets", () => {
    expect(levelCfg(4).goal).toBe(30);
    expect(levelCfg(62).goal).toBe(320);
    expect(levelCfg(100).goal).toBe(510);
    for (let n = 2; n <= 100; n++) {
      const previous = levelCfg(n - 1),
        current = levelCfg(n);
      expect(current.goal - previous.goal).toBe(5);
      expect(current.duration).toBeGreaterThan(current.goal * 1.9);
    }
  });
  it("unlocks assembly, frying and dishes in order and teaches each once", () => {
    expect(levelCfg(UNLOCKS.assembly - 1).assembly).toBe(false);
    expect(levelCfg(UNLOCKS.assembly)).toMatchObject({
      assembly: true,
      teach: "assembly",
    });
    expect(levelCfg(UNLOCKS.cooking - 1).cooking).toBe(false);
    expect(levelCfg(UNLOCKS.cooking)).toMatchObject({
      cooking: true,
      teach: "cooking",
    });
    expect(levelCfg(UNLOCKS.dishes - 1).dishes).toBe(false);
    expect(levelCfg(UNLOCKS.dishes)).toMatchObject({
      dishes: true,
      teach: "dishes",
    });
    expect(levelCfg(21).teach).toBe("swallow");
  });
  it("gives extra clock time for frying and table clearing", () => {
    const n = UNLOCKS.dishes + 1,
      c = levelCfg(n);
    expect(c.duration).toBeGreaterThan(c.goal * 1.9);
  });
  it("rounds star targets to ₦100 and increases them", () => {
    for (let n = 1; n <= 50; n++) {
      const { stars } = levelCfg(n);
      stars.forEach((s) => expect(s % 100).toBe(0));
      expect(stars[0]).toBeLessThan(stars[1]);
      expect(stars[1]).toBeLessThan(stars[2]);
    }
  });
  it("endless mode uses every mechanic", () => {
    expect(endlessCfg()).toMatchObject({
      assembly: true,
      cooking: true,
      dishes: true,
    });
    expect(endlessCfg().duration).toBe(Infinity);
  });
});

describe("daily challenge", () => {
  it("is seeded by date and never a tutorial", () => {
    const a = dailyCfg(50, "2026-10-24"),
      b = dailyCfg(50, "2026-10-24");
    expect(plain(a)).toEqual(plain(b));
    expect(a).toMatchObject({ mode: "daily", tutorial: false, teach: "" });
    expect(new Set(a.mods.map((m) => m.id)).size).toBe(2);
    a.stars.forEach((s) => expect(s % 100).toBe(0));
  });
  it("only picks unlocked levels", () => {
    for (const key of ["2026-01-01", "2026-05-05", "2026-12-31"])
      expect(dailyCfg(1, key).n).toBe(1);
  });
});

describe("scoring in naira", () => {
  const score = (overrides = {}) =>
    scoreOrder({
      base: 1000,
      combo: 0,
      patienceRatio: 0.5,
      vip: false,
      tips: 0,
      coinMult: 1,
      ...overrides,
    });
  it("rounds the bill to the nearest ₦50", () => {
    expect(score({ base: 1430 })).toEqual({ points: 1450, coins: 1450 });
    expect(score({ combo: 1 }).points).toBe(1100);
  });
  it("caps the combo multiplier at ten", () =>
    expect(score({ combo: 25 })).toEqual(score({ combo: 10 })));
  it("applies the fast bonus only above 60 percent patience", () => {
    expect(score({ patienceRatio: 0.6 }).points).toBe(1000);
    expect(score({ patienceRatio: 0.6001 }).points).toBe(1250);
  });
  it("stacks VIP, fast, combo, tips upgrade and daily multiplier", () => {
    expect(
      score({ combo: 10, patienceRatio: 0.9, vip: true, tips: 5, coinMult: 2 }),
    ).toEqual({ points: 5000, coins: 15000 });
  });
  it("pays customer tips only when they were not kept waiting", () => {
    expect(tipFor({ base: 2000, patienceRatio: 0.2, tipFactor: 2 })).toBe(0);
    expect(tipFor({ base: 2000, patienceRatio: 0.5, tipFactor: 1 })).toBe(200);
    expect(tipFor({ base: 2000, patienceRatio: 0.9, tipFactor: 1.6 })).toBe(
      500,
    );
  });
  it("takes wages from the shift without going below zero", () => {
    expect(netAfterWages(10000, 2200)).toBe(7800);
    expect(netAfterWages(1000, 2200)).toBe(0);
  });
});

describe("currency formatting", () => {
  it("writes naira like a buka", () => {
    expect(fmtNaira(1500)).toBe("₦1,500");
    expect(fmtNaira(-700)).toBe("-₦700");
    expect(fmtNairaShort(950)).toBe("₦950");
    expect(fmtNairaShort(4800)).toBe("₦4.8k");
    expect(fmtNairaShort(125000)).toBe("₦125k");
    expect(fmtNairaShort(1250000)).toBe("₦1.25m");
    expect(roundNaira(1274)).toBe(1250);
  });
});

describe("plate assembly", () => {
  it("never orders a swallow without soup or a lone soup", () => {
    const foods = CHAPTERS[2].foods;
    const rand = seeded(7);
    for (let i = 0; i < 300; i++) {
      const k = 1 + (i % 3);
      const order = buildOrder(foods, k, { rand });
      expect(new Set(order).size).toBe(order.length);
      expect(order.length).toBeLessThanOrEqual(Math.max(k, 1));
      if (order.length === 1) {
        expect(FOODS[order[0]].kind).not.toBe("soup");
        expect(FOODS[order[0]].swallow).toBeFalsy();
      }
      if (order.some((f) => FOODS[f].swallow))
        expect(order.some((f) => FOODS[f].kind === "soup")).toBe(true);
      expect(
        order.filter((f) => FOODS[f].kind === "main").length,
      ).toBeLessThanOrEqual(1);
    }
  });
  it("prefers a customer's favourite foods", () => {
    const rand = seeded(3),
      likes = ["beans", "zobo"];
    let liked = 0;
    for (let i = 0; i < 200; i++)
      if (
        buildOrder(CHAPTERS[1].foods, 2, { rand, likes }).some((f) =>
          likes.includes(f),
        )
      )
        liked++;
    expect(liked).toBeGreaterThan(120);
  });
  it("names the plate without the drink", () =>
    expect(plateName(["eba", "egusi", "beef", "water"])).toBe(
      "Eba + Egusi + Beef",
    ));
});

describe("order matching", () => {
  it("accepts only an outstanding item for a waiting customer", () => {
    const order = toItems(["jollof", "zobo"], false);
    expect(needsFood("enter", order, "jollof")).toBe(false);
    expect(needsFood("wait", order, "beef")).toBe(false);
    expect(needsFood("wait", order, "jollof")).toBe(true);
    expect(fillOrder(order, "jollof")).toEqual({ index: 0, slot: 0 });
    expect(needsFood("wait", order, "jollof")).toBe(false);
    expect(orderComplete(order)).toBe(false);
    expect(fillOrder(order, "zobo")).toEqual({ index: 1, slot: 1 });
    expect(orderComplete(order)).toBe(true);
  });
  it("puts toppings on only after the main is dished; drinks any time", () => {
    const order = toItems(["whiterice", "beef", "plantain", "zobo"], true);
    expect(order.map((o) => o.layer)).toEqual([0, 1, 1, 0]);
    expect(needsFood("wait", order, "beef")).toBe(false);
    expect(blockedFood("wait", order, "beef")).toBe(true);
    expect(fillOrder(order, "beef").index).toBe(-1);
    expect(needsFood("wait", order, "zobo")).toBe(true);
    expect(nextNeeded(order).map((o) => o.f)).toEqual(["whiterice", "zobo"]);
    fillOrder(order, "whiterice");
    expect(needsFood("wait", order, "beef")).toBe(true);
    expect(blockedFood("wait", order, "beef")).toBe(false);
  });
  it("lets the soup follow its swallow", () => {
    const order = toItems(["amala", "ewedu", "beef"], true);
    expect(blockedFood("wait", order, "ewedu")).toBe(true);
    fillOrder(order, "amala");
    expect(needsFood("wait", order, "ewedu")).toBe(true);
  });
  it("rejects wrong food without changing the order", () => {
    const order = toItems(["egusi"], false),
      before = plain(order);
    expect(fillOrder(order, "beef")).toEqual({ index: -1, slot: -1 });
    expect(order).toEqual(before);
  });
});

describe("save", () => {
  function storage(initial) {
    let value = initial;
    return {
      getItem: () => value,
      setItem: (_key, next) => {
        value = next;
      },
    };
  }
  it("keeps the original key and starts with naira and one of each booster", () => {
    const save = createSave(storage(null));
    save.load();
    expect(save.key).toBe("mamaPutRush3D.v1");
    expect(save.d).toEqual(save.defaults());
    expect(save.d).toMatchObject({
      coins: 3000,
      schema: 3,
      boosters: { freeze: 1, auto: 1, calm: 1 },
      staff: [],
      haptics: true,
    });
  });
  it("converts version 1 coin saves to naira and keeps progress", () => {
    const save = createSave(
      storage(
        JSON.stringify({
          coins: 999,
          unlocked: 31,
          up: { fast: 3 },
          stars: { 1: 3 },
          best: { 1: 300 },
          endlessBest: 40,
          outfit: "royal",
        }),
      ),
    );
    save.load();
    expect(save.d).toMatchObject({
      schema: 3,
      coins: 24975,
      unlocked: 31,
      up: { fast: 3, patience: 0, time: 0, tips: 0 },
      stars: { 1: 3 },
      best: { 1: 7500 },
      endlessBest: 1000,
      outfit: "royal",
    });
    expect(save.d.stats.serve).toBe(0);
    expect(save.d.music).toBe(true);
  });
  it("never converts a naira save twice", () => {
    const d = migrate(
      { schema: 2, coins: 5000 },
      createSave(storage(null)).defaults(),
    );
    expect(d.coins).toBe(5000);
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
  it("round trips progress and stamps the save time", () => {
    const mem = storage(null),
      save = createSave(mem);
    save.load();
    save.d.coins = 45000;
    save.d.staff.push("chidi");
    save.save();
    expect(save.d.updatedAt).toBeGreaterThan(0);
    const next = createSave(mem);
    next.load();
    expect(next.d).toEqual(save.d);
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
