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
import {
  payroll,
  removeStaff,
  onDuty,
  UNPAID_LIMIT,
} from "../src/game/staff.js";
import {
  REP,
  clampRep,
  spawnFactor,
  repTipFactor,
  tierOf,
  canOpen,
  openBranch,
  branchIncome,
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

describe("salaries, quitting and sacking", () => {
  const chidi = STAFF.find((s) => s.id === "chidi"),
    bisi = STAFF.find((s) => s.id === "bisi");
  it("pays everyone on duty when there is enough cash", () => {
    const d = fresh({ staff: ["chidi", "bisi"] });
    const r = payroll(d, STAFF, 5000);
    expect(r).toMatchObject({
      bill: chidi.wage + bisi.wage,
      unpaid: [],
      quit: [],
    });
    expect(r.paid).toBe(r.bill);
  });
  it("skips staff who are off duty", () => {
    const d = fresh({ staff: ["chidi", "bisi"], staffOff: ["bisi"] });
    expect(onDuty(d, STAFF).map((s) => s.id)).toEqual(["chidi"]);
    expect(payroll(d, STAFF, 5000).bill).toBe(chidi.wage);
  });
  it("pays in hiring order and gives the unpaid a strike", () => {
    const d = fresh({ staff: ["bisi", "chidi"] });
    const r = payroll(d, STAFF, bisi.wage + 10);
    expect(r.unpaid).toEqual(["chidi"]);
    expect(d.unpaid).toEqual({ bisi: 0, chidi: 1 });
  });
  it("staff quit after three unpaid shifts in a row; pay resets the count", () => {
    const d = fresh({ staff: ["chidi"] });
    payroll(d, STAFF, 0);
    payroll(d, STAFF, 0);
    payroll(d, STAFF, 10000);
    expect(d.unpaid.chidi).toBe(0);
    for (let i = 1; i < UNPAID_LIMIT; i++) payroll(d, STAFF, 0);
    expect(d.staff).toEqual(["chidi"]);
    const r = payroll(d, STAFF, 0);
    expect(r.quit).toEqual(["chidi"]);
    expect(d.staff).toEqual([]);
  });
  it("sacking removes the worker and their record", () => {
    const d = fresh({
      staff: ["chidi", "bisi"],
      staffOff: ["chidi"],
      unpaid: { chidi: 2 },
    });
    removeStaff(d, "chidi");
    expect(d).toMatchObject({ staff: ["bisi"], staffOff: [], unpaid: {} });
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
    expect(tierOf(fresh({ stats: { earn: 700000 }, reputation: 58 }))).toBe(2);
    expect(tierOf(fresh({ stats: { earn: 700000 }, reputation: 40 }))).toBe(0);
    expect(TIERS).toHaveLength(5);
  });
  it("opens branches in other places once the business is big enough", () => {
    const yaba = PLACES.find((p) => p.id === "yaba");
    const small = fresh({ coins: 1e6 });
    expect(canOpen(small, yaba)).toMatchObject({ ok: false });
    const d = fresh({ coins: 100000, stats: { earn: 200000 }, reputation: 50 });
    expect(canOpen(d, yaba).ok).toBe(true);
    expect(openBranch(d, yaba)).toBe(true);
    expect(d.coins).toBe(100000 - yaba.cost);
    expect(branchIncome(d)).toBe(yaba.income);
    expect(openBranch(d, yaba)).toBe(false);
  });
  it("saves keep reputation and merge branches", () => {
    const d = fresh();
    expect(d).toMatchObject({
      reputation: 50,
      branches: ["ojuelegba"],
      unpaid: {},
    });
    const m = mergeSaves(
      { ...d, branches: ["ojuelegba", "yaba"], updatedAt: 1 },
      { ...d, branches: ["ojuelegba", "mushin"], updatedAt: 2 },
    );
    expect(m.branches.sort()).toEqual(["mushin", "ojuelegba", "yaba"]);
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
