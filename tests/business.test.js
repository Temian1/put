import { describe, it, expect } from "vitest";
import {
  STAFF,
  STOCK,
  EVENTS,
  EVENT_LEVELS,
  PLACES,
  TIERS,
  NAMES,
  CUSTOMER_TYPES,
  UNLOCKS,
  levelCfg,
  endlessCfg,
} from "../src/game/data.js";
import { UNPAID_LIMIT } from "../src/game/staff.js";
import {
  hire,
  sack,
  toggleDuty,
  onShift,
  payCrew,
  canHire,
  runBranches,
  collect,
  managerAt,
  migrateCrew,
  CREW_LIMIT,
  TILL_SHIFTS,
} from "../src/game/crew.js";
import {
  REP,
  clampRep,
  spawnFactor,
  repTipFactor,
  tierOf,
  canOpen,
  openBranch,
  branchIncome,
  levelOpen,
  nextToOpen,
} from "../src/game/growth.js";
import {
  makeOnlineOrder,
  makeEventOrder,
  packNeeds,
  packFill,
  packComplete,
  packsFor,
  portions,
  orderValue,
  tickOrders,
  createRiders,
  dispatch,
  tickRiders,
  ON_CALL_FEE,
  DELIVERY_FEE,
} from "../src/game/deliveries.js";
import {
  createCooker,
  tapCooker,
  tickCooker,
  takePortion,
  cookerProgress,
} from "../src/game/kitchen.js";
import { createSave } from "../src/systems/SaveManager.js";
import { mergeSaves } from "../src/systems/CloudSave.js";
import { seeded } from "../src/game/utils.js";

const fresh = (patch = {}) => {
  const s = createSave({ getItem: () => null, setItem() {} });
  s.load();
  return Object.assign(s.d, patch);
};

describe("each restaurant's own crew", () => {
  const chidi = STAFF.find((s) => s.id === "chidi"),
    bisi = STAFF.find((s) => s.id === "bisi");
  const two = () => fresh({ branches: ["ch0", "ch1"] });
  it("hires staff for one restaurant only", () => {
    const d = two();
    hire(d, "ch0", "chidi");
    expect(onShift(d, "ch0").map((s) => s.name)).toEqual(["Chidi"]);
    expect(onShift(d, "ch1")).toEqual([]);
    expect(canHire(d, "ch2", "chidi").ok).toBe(false);
  });
  it("hires several people for the same job, each with a new name", () => {
    const d = two();
    for (let i = 0; i < CREW_LIMIT.server; i++) hire(d, "ch0", "chidi");
    const names = onShift(d, "ch0").map((s) => s.name);
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(3);
    expect(names.every((n) => n === "Chidi" || NAMES.includes(n))).toBe(true);
    expect(hire(d, "ch0", "tunde")).toBe(null);
  });
  it("pays in hiring order and gives the unpaid a strike", () => {
    const d = two();
    hire(d, "ch0", "bisi");
    hire(d, "ch0", "chidi");
    const r = payCrew(d, "ch0", bisi.wage + 10, UNPAID_LIMIT);
    expect(r).toMatchObject({
      bill: bisi.wage + chidi.wage,
      paid: bisi.wage,
      unpaid: ["Chidi"],
    });
  });
  it("off-duty staff earn nothing; staff quit after three unpaid shifts", () => {
    const d = two();
    const b = hire(d, "ch0", "bisi");
    hire(d, "ch0", "chidi");
    toggleDuty(d, "ch0", b.uid);
    expect(payCrew(d, "ch0", 5000, UNPAID_LIMIT).bill).toBe(chidi.wage);
    payCrew(d, "ch0", 0, UNPAID_LIMIT);
    payCrew(d, "ch0", 10000, UNPAID_LIMIT);
    for (let i = 1; i < UNPAID_LIMIT; i++) payCrew(d, "ch0", 0, UNPAID_LIMIT);
    expect(onShift(d, "ch0").map((s) => s.name)).toEqual(["Chidi"]);
    expect(payCrew(d, "ch0", 0, UNPAID_LIMIT).quit).toEqual(["Chidi"]);
    expect(onShift(d, "ch0")).toEqual([]);
  });
  it("sacking removes the worker", () => {
    const d = two();
    const m = hire(d, "ch0", "chidi");
    expect(sack(d, "ch0", m.uid)).toBe(true);
    expect(onShift(d, "ch0")).toEqual([]);
  });
  it("an old restaurant earns into its safe only with a manager", () => {
    const d = two();
    expect(runBranches(d, "ch0", 1, UNPAID_LIMIT)).toEqual([]);
    hire(d, "ch1", "mgr1");
    expect(managerAt(d, "ch1").title).toBe("Junior manager");
    expect(canHire(d, "ch1", "mgr3").ok).toBe(false);
    const [r] = runBranches(d, "ch0", 1, UNPAID_LIMIT);
    const income = PLACES[1].income;
    expect(r.net).toBe(
      Math.round(income * 0.55) - Math.round(Math.round(income * 0.55) * 0.15),
    );
    // The restaurant you are playing at earns from the shift itself.
    expect(runBranches(d, "ch1", 1, UNPAID_LIMIT)).toEqual([]);
    const before = d.coins;
    expect(collect(d, "ch1")).toBe(r.net);
    expect(d.coins).toBe(before + r.net);
    expect(collect(d, "ch1")).toBe(0);
  });
  it("better managers and more staff earn more; the safe fills up", () => {
    const run = (mgr, staff) => {
      const d = two();
      hire(d, "ch1", mgr);
      for (let i = 0; i < staff; i++) hire(d, "ch1", "chidi");
      return runBranches(d, "ch0", 1, UNPAID_LIMIT)[0].net;
    };
    expect(run("mgr3", 0)).toBeGreaterThan(run("mgr1", 0));
    expect(run("mgr2", 2)).toBeGreaterThan(run("mgr2", 0));
    const d = two();
    hire(d, "ch1", "mgr3");
    for (let i = 0; i < TILL_SHIFTS + 5; i++)
      runBranches(d, "ch0", 1, UNPAID_LIMIT);
    expect(d.till.ch1).toBe(PLACES[1].income * TILL_SHIFTS);
  });
  it("moves staff from older saves to the restaurant you were running", () => {
    const out = migrateCrew({
      place: "ch1",
      staff: ["chidi", "bisi"],
      staffOff: ["bisi"],
      unpaid: { chidi: 2 },
    });
    expect(out.crew.ch1).toMatchObject([
      { job: "chidi", name: "Chidi", off: false, unpaid: 2 },
      { job: "bisi", off: true },
    ]);
    expect(out.staff).toEqual([]);
  });
  it("has dispatch riders and a market errand worker", () => {
    expect(
      STAFF.filter((s) => s.role === "rider").every((s) => s.trip > 0),
    ).toBe(true);
    expect(STAFF.some((s) => s.role === "errand")).toBe(true);
  });
});

describe("reputation and growth", () => {
  it("good service brings more customers and better tips", () => {
    expect(spawnFactor(100)).toBeLessThan(spawnFactor(50));
    expect(spawnFactor(0)).toBeGreaterThan(spawnFactor(50));
    expect(repTipFactor(100)).toBeGreaterThan(repTipFactor(0));
    expect(clampRep(130)).toBe(100);
    expect(clampRep(-5)).toBe(0);
    expect(REP.lost).toBeLessThan(0);
    expect(REP.serveFast).toBeGreaterThan(REP.serve);
  });
  it("business size needs both sales and reputation", () => {
    expect(tierOf(fresh())).toBe(0);
    expect(tierOf(fresh({ stats: { earn: 1300000 }, reputation: 58 }))).toBe(2);
    expect(tierOf(fresh({ stats: { earn: 1300000 }, reputation: 40 }))).toBe(0);
    expect(TIERS).toHaveLength(5);
  });
  it("each new restaurant needs the chapter beaten and the opening money", () => {
    const yaba = PLACES.find((p) => p.id === "ch1");
    expect(yaba).toMatchObject({ name: "Junction Food Spot", firstLevel: 11 });
    // Not reached yet: even a rich owner must beat level 10 first.
    expect(canOpen(fresh({ coins: 1e7 }), yaba)).toMatchObject({ ok: false });
    // Reached but broke: level 11 stays shut.
    const broke = fresh({ coins: 1000, unlocked: 11 });
    expect(canOpen(broke, yaba)).toEqual({
      ok: false,
      why: "Not enough money",
    });
    expect(levelOpen(broke, 11)).toBe(false);
    expect(levelOpen(broke, 10)).toBe(true);
    expect(nextToOpen(broke)).toBe(yaba);
    const d = fresh({ coins: 200000, unlocked: 11 });
    expect(openBranch(d, yaba)).toBe(true);
    expect(d.coins).toBe(200000 - yaba.cost);
    expect(levelOpen(d, 11)).toBe(true);
    expect(branchIncome(d)).toBe(yaba.income);
    expect(openBranch(d, yaba)).toBe(false);
    expect(PLACES).toHaveLength(10);
    for (let i = 1; i < PLACES.length; i++)
      expect(PLACES[i].cost).toBeGreaterThan(PLACES[i - 1].cost);
  });
  it("older saves keep restaurants already reached and paid for", () => {
    const s = createSave({
      getItem: () =>
        JSON.stringify({
          schema: 2,
          unlocked: 23,
          branches: ["ojuelegba", "lekki"],
          place: "lekki",
        }),
      setItem() {},
    });
    s.load();
    expect(s.d.branches.sort()).toEqual(["ch0", "ch1", "ch2", "ch4"]);
    expect(s.d.place).toBe("ch4");
    expect(s.d.schema).toBe(3);
  });
  it("saves keep reputation and merge branches", () => {
    const d = fresh();
    expect(d).toMatchObject({
      reputation: 50,
      branches: ["ch0"],
      unpaid: {},
    });
    const m = mergeSaves(
      { ...d, branches: ["ch0", "ch1"], updatedAt: 1 },
      { ...d, branches: ["ch0", "ch2"], updatedAt: 2 },
    );
    expect(m.branches.sort()).toEqual(["ch0", "ch1", "ch2"]);
  });
});

describe("online and event orders", () => {
  it("online orders are believable plates with a deadline and delivery fee", () => {
    const rand = seeded(9);
    for (let i = 0; i < 50; i++) {
      const o = makeOnlineOrder(levelCfg(21).foods, rand);
      expect(o.kind).toBe("online");
      expect(o.items.length).toBeGreaterThan(0);
      expect(NAMES).toContain(o.who);
      expect(o.t).toBe(o.max);
    }
  });
  it("packing fills items, then the order is complete", () => {
    const o = makeOnlineOrder(["jollof", "beef", "water"], seeded(2));
    const f = o.items[0].f;
    expect(packNeeds(o, f)).toBe(true);
    expect(packNeeds(o, "egusi")).toBe(false);
    o.items.forEach((it) => packFill(o, it.f));
    expect(packComplete(o)).toBe(true);
    expect(packFill(o, f)).toBe(false);
    expect(packsFor(o)).toBe(1);
    const food = o.items.reduce(
      (s, it) => s + (it.f === "jollof" ? 900 : it.f === "beef" ? 600 : 100),
      0,
    );
    expect(orderValue(o)).toBe(Math.round((food + DELIVERY_FEE) / 50) * 50);
  });
  it("events split their size across foods the level sells and pay a premium", () => {
    const foods = levelCfg(42).foods;
    const o = makeEventOrder("burial", foods, seeded(4));
    expect(portions(o)).toBe(EVENTS.burial.size);
    o.items.forEach((it) => expect(foods).toContain(it.f));
    expect(packsFor(o)).toBe(Math.ceil(EVENTS.burial.size / 4));
    o.items.forEach((it) => (it.got = it.need));
    const base = o.items.reduce(
      (s, it) =>
        s +
        it.need *
          {
            poundedyam: 800,
            egusi: 700,
            efo: 800,
            peppersoup: 2500,
            chicken: 2500,
            fish: 1200,
            malt: 800,
          }[it.f],
      0,
    );
    expect(orderValue(o)).toBe(Math.round((base * 1.4) / 50) * 50);
  });
  it("events fall back to the level's menu when their usual food is missing", () => {
    const o = makeEventOrder(
      "chieftaincy",
      ["jollof", "beef", "plantain", "water"],
      seeded(1),
    );
    expect(o.items.length).toBeGreaterThan(1);
  });
  it("orders expire when the deadline passes", () => {
    const o = makeOnlineOrder(["jollof"], seeded(3));
    expect(tickOrders([o], o.max - 1)).toEqual([]);
    expect(tickOrders([o], 2)).toEqual([o]);
  });
  it("hired riders deliver free; when all are out an outside rider is called", () => {
    const riders = createRiders(STAFF.filter((s) => s.id === "emeka"));
    const a = dispatch(riders);
    expect(a).toMatchObject({ fee: 0, trip: 9 });
    expect(dispatch(riders)).toMatchObject({ rider: null, fee: ON_CALL_FEE });
    tickRiders(riders, 9);
    expect(dispatch(riders).fee).toBe(0);
  });
});

describe("food finishes", () => {
  it("pots open full, run out and must be cooked again; they never burn", () => {
    const s = createCooker(STOCK.pot, true);
    expect(s).toMatchObject({ stage: "ready", stock: 8 });
    expect(cookerProgress(s)).toBe(1);
    tickCooker(s, 1000);
    expect(s.stage).toBe("ready");
    for (let i = 0; i < 8; i++) takePortion(s);
    expect(s.stage).toBe("raw");
    expect(tapCooker(s)).toBe("start");
    tickCooker(s, STOCK.pot.time);
    expect(s).toMatchObject({ stage: "ready", stock: 8 });
    takePortion(s);
    expect(cookerProgress(s)).toBeCloseTo(7 / 8);
  });
});

describe("level plan", () => {
  it("unlocks stock, online orders and events in order", () => {
    expect(levelCfg(UNLOCKS.stock - 1).stock).toBe(false);
    expect(levelCfg(UNLOCKS.stock)).toMatchObject({
      stock: true,
      teach: "stock",
    });
    expect(levelCfg(UNLOCKS.online - 1).online).toBe(false);
    expect(levelCfg(UNLOCKS.online)).toMatchObject({
      online: true,
      teach: "online",
    });
    expect(levelCfg(UNLOCKS.events)).toMatchObject({
      event: "birthday",
      teach: "events",
    });
    expect(endlessCfg()).toMatchObject({
      stock: true,
      online: true,
      event: "random",
    });
  });
  it("puts each celebration on a non-boss level with time to cater it", () => {
    for (const [n, ev] of Object.entries(EVENT_LEVELS)) {
      const c = levelCfg(+n);
      expect(EVENTS[ev]).toBeDefined();
      expect(c.boss).toBe(false);
      expect(c.event).toBe(ev);
      expect(c.challenge).toContain(EVENTS[ev].name);
    }
    const kinds = Object.values(EVENTS).map((e) => e.name);
    for (const name of [
      "Birthday party",
      "Naming ceremony",
      "Child dedication",
      "Burial reception",
    ])
      expect(kinds).toContain(name);
  });
  it("Odogwu orders one small thing and tips big", () => {
    const o = CUSTOMER_TYPES.odogwu;
    expect(o.maxItems).toBe(1);
    expect(o.bigTip[0]).toBeGreaterThanOrEqual(2000);
  });
});
