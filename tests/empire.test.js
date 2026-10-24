import { describe, it, expect } from "vitest";
import {
  EQUIPMENT,
  effects,
  upkeep,
  buyEquipment,
  level,
} from "../src/game/equipment.js";
import {
  INGREDIENTS,
  FOOD_GROUP,
  basePrice,
  price,
  buy,
  ingredientsForBatch,
  advanceMarket,
  isOut,
} from "../src/game/market.js";
import {
  taxes,
  hygieneScore,
  inspect,
  makeOffer,
  haggle,
  absenceDecay,
  settleDebt,
  VAT_RATE,
} from "../src/game/business.js";
import {
  FOODS,
  CHAPTERS,
  MAX_LEVEL,
  levelCfg,
  EVENT_LEVELS,
} from "../src/game/data.js";
import { createSave } from "../src/systems/SaveManager.js";

const fresh = (patch = {}) => {
  const s = createSave({ getItem: () => null, setItem() {} });
  s.load();
  return Object.assign(s.d, patch);
};

describe("buka equipment", () => {
  it("starts with one table and grows with purchases", () => {
    const d = fresh({ coins: 1e7 });
    expect(effects(d)).toMatchObject({
      tables: 1,
      seats: 2,
      sinkCap: 4,
      bikes: 0,
      bus: false,
    });
    const tables = EQUIPMENT.find((e) => e.id === "tables");
    expect(buyEquipment(d, tables)).toBe(true);
    expect(buyEquipment(d, tables)).toBe(true);
    expect(effects(d).seats).toBe(6);
    expect(d.coins).toBe(1e7 - tables.costs[0] - tables.costs[1]);
    for (const it of EQUIPMENT) while (buyEquipment(d, it));
    EQUIPMENT.forEach((it) => expect(level(d, it.id)).toBe(it.costs.length));
    const e = effects(d);
    expect(e).toMatchObject({ fridge: true, bus: true, bikes: 3, sinkCap: 7 });
    expect(e.cookSpeed).toBeCloseTo(1.5);
    expect(upkeep(d)).toBeGreaterThan(5000);
  });
  it("refuses purchases you cannot afford", () => {
    const d = fresh({ coins: 1000 });
    expect(buyEquipment(d, EQUIPMENT[0])).toBe(false);
    expect(d.coins).toBe(1000);
  });
  it("vehicles are expensive so growth takes time", () => {
    const bike = EQUIPMENT.find((e) => e.id === "bike"),
      bus = EQUIPMENT.find((e) => e.id === "bus");
    expect(bike.costs[0]).toBeGreaterThanOrEqual(400000);
    expect(bus.costs[0]).toBeGreaterThanOrEqual(2000000);
  });
});

describe("market and inflation", () => {
  it("every food has an ingredient group with a sensible price", () => {
    for (const f of Object.keys(FOODS))
      expect(INGREDIENTS[FOOD_GROUP[f]], f).toBeDefined();
    for (const g of Object.keys(INGREDIENTS)) {
      expect(basePrice(g)).toBeGreaterThan(200);
      expect(basePrice(g)).toBeLessThan(10000);
    }
  });
  it("buying stocks the store up to its capacity", () => {
    const d = fresh({ coins: 1e6 });
    expect(buy(d, "rice", 15, 10)).toMatchObject({ ok: true, n: 10 });
    expect(d.pantry.rice).toBe(10);
    expect(buy(d, "rice", 1, 10)).toMatchObject({ ok: false });
  });
  it("cooking uses store stock first, else buys on the spot at a premium", () => {
    const d = fresh({ coins: 1e6, pantry: { rice: 1 } });
    expect(ingredientsForBatch(d, "jollof")).toBe(0);
    expect(d.pantry.rice).toBe(0);
    expect(ingredientsForBatch(d, "jollof")).toBeGreaterThan(
      price(d, "rice") * 1.3,
    );
  });
  it("prices inflate over shifts and perishables spoil without a freezer", () => {
    const d = fresh({ pantry: { meat: 8, rice: 8 } });
    const p0 = price(d, "rice");
    for (let i = 0; i < 40; i++) advanceMarket(d, false);
    expect(d.market.index).toBeGreaterThan(1.1);
    expect(price(d, "rice")).toBeGreaterThan(p0);
    expect(d.pantry.rice).toBe(8);
    expect(d.pantry.meat).toBeLessThan(8);
    const cold = fresh({ pantry: { meat: 8 } });
    advanceMarket(cold, true);
    expect(cold.pantry.meat).toBe(8);
  });
  it("sold-out items cannot be bought", () => {
    const d = fresh({
      coins: 1e6,
      market: { shift: 1, index: 1, out: ["chicken"], news: "" },
    });
    expect(isOut(d, "chicken")).toBe(true);
    expect(buy(d, "chicken", 1, 10).ok).toBe(false);
  });
});

describe("taxes, hygiene, haggling and decline", () => {
  it("small bukas pay a levy; registered businesses also charge 7.5% VAT", () => {
    expect(taxes(0, 100000)).toEqual({ levy: 300, vat: 0 });
    expect(taxes(2, 100000).vat).toBe(100000 * VAT_RATE);
  });
  it("hygiene falls with dirty plates and rises with equipment and a cleaner", () => {
    const base = {
      equipment: 0,
      cleaner: false,
      dirty: 0,
      sinkFull: false,
      starving: 0,
    };
    expect(hygieneScore({ ...base, dirty: 4, sinkFull: true })).toBeLessThan(
      hygieneScore(base),
    );
    expect(
      hygieneScore({ ...base, equipment: 25, cleaner: true }),
    ).toBeGreaterThanOrEqual(75);
  });
  it("inspectors pass, warn, fine or nearly shut you down", () => {
    expect(inspect(80, 0).result).toBe("pass");
    expect(inspect(60, 0).result).toBe("warning");
    expect(inspect(40, 2)).toMatchObject({ result: "fine", fine: 15000 });
    expect(inspect(10, 0).result).toBe("sealed");
  });
  it("customers argue the price down; refusing can lose them", () => {
    const offer = makeOffer(2000, () => 0.5);
    expect(offer).toBeLessThan(2000);
    expect(haggle("accept", 2000, offer).price).toBe(offer);
    expect(haggle("meet", 2000, 1400, () => 0.1).price).toBe(1700);
    expect(haggle("refuse", 2000, 1400, () => 0.9)).toMatchObject({
      leaves: true,
      price: 0,
    });
    expect(haggle("refuse", 2000, 1400, () => 0.1)).toMatchObject({
      leaves: false,
      price: 2000,
    });
  });
  it("a buka left closed loses reputation", () => {
    expect(absenceDecay("2026-10-20", "2026-10-21").rep).toBe(0);
    expect(absenceDecay("2026-10-10", "2026-10-20").days).toBe(10);
    expect(absenceDecay("2026-01-01", "2026-10-20").rep).toBe(-15);
    expect(absenceDecay("", "2026-10-20").rep).toBe(0);
  });
  it("unpaid bills become debt that later shifts pay first", () => {
    const d = { debt: 0 };
    expect(settleDebt(d, -5000)).toBe(0);
    expect(d.debt).toBe(5000);
    expect(settleDebt(d, 3000)).toBe(0);
    expect(d.debt).toBe(2000);
    expect(settleDebt(d, 10000)).toBe(8000);
    expect(d.debt).toBe(0);
  });
});

describe("100 levels", () => {
  it("has ten chapters with their own scenes and growing crowds", () => {
    expect(CHAPTERS).toHaveLength(10);
    expect(MAX_LEVEL).toBe(100);
    expect(levelCfg(100).goal).toBeGreaterThan(levelCfg(50).goal);
    for (let n = 51; n <= 100; n++) {
      const c = levelCfg(n);
      expect(c.theme).toBeGreaterThanOrEqual(0);
      expect(c.theme).toBeLessThan(5);
      expect(c.sign).toHaveLength(2);
      expect(c).toMatchObject({
        haggle: true,
        inspect: true,
        stock: true,
        online: true,
      });
    }
    Object.keys(EVENT_LEVELS).forEach((n) =>
      expect(levelCfg(+n).boss).toBe(false),
    );
  });
});
