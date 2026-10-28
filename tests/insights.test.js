import { describe, it, expect } from "vitest";
import {
  shiftInsights,
  recordDay,
  bookSummary,
  plateCosts,
  BOOK_DAYS,
} from "../src/game/insights.js";

const base = {
  sales: 50000,
  foodCost: 0,
  storeUsed: 12000,
  emergencyExtra: 0,
  wages: 6000,
  rent: 3000,
  upkeep: 500,
  taxes: 1000,
  served: 20,
  lost: 0,
  spoiled: 0,
  complaints: 0,
  net: 27500,
  debt: 0,
  owed: 0,
  payday: 7,
};

describe("Mama Nkechi's debrief", () => {
  it("praises a healthy shift", () => {
    const list = shiftInsights(base);
    expect(list.every((i) => i.tone === "good")).toBe(true);
    expect(list[0].title).toMatch(/Profit/);
  });
  it("names the biggest problems first, with a tip each", () => {
    const list = shiftInsights({
      ...base,
      foodCost: 20000,
      storeUsed: 6000,
      emergencyExtra: 5700,
      lost: 5,
      net: -4000,
    });
    expect(list).toHaveLength(3);
    expect(list.every((i) => i.tone === "bad" && i.tip.length > 20)).toBe(true);
    expect(list.map((i) => i.title).join(" ")).toMatch(
      /lost|left hungry|Food cost/,
    );
  });
  it("warns about debt, wages and an upcoming payday", () => {
    const list = shiftInsights(
      { ...base, debt: 9000, wages: 30000, owed: 40000, payday: 1 },
      (n) => "₦" + n,
      5,
    );
    const titles = list.map((i) => i.title).join(" | ");
    expect(titles).toMatch(/debt/);
    expect(titles).toMatch(/Payday in 1 day/);
    expect(titles).toMatch(/Wages were/);
  });
});

describe("business books", () => {
  it("keeps the last 60 days and averages the last 7", () => {
    const d = {};
    for (let i = 1; i <= BOOK_DAYS + 5; i++)
      recordDay(d, {
        day: i,
        sales: 10000,
        food: 3000,
        wages: 2000,
        net: i % 2 ? 1000 : -500,
        lost: 1,
      });
    expect(d.history).toHaveLength(BOOK_DAYS);
    expect(d.history[0].day).toBe(6);
    const s = bookSummary(d.history, 7);
    expect(s).toMatchObject({
      days: 7,
      sales: 10000,
      foodPct: 0.3,
      staffPct: 0.2,
      lost: 1,
    });
    expect(s.best.net).toBe(1000);
    expect(bookSummary([])).toBe(null);
  });
  it("works out the cost and margin of each plate", () => {
    const [jollof] = plateCosts(
      ["jollof"],
      () => 900,
      () => 2400,
      () => 8,
    );
    expect(jollof).toMatchObject({ price: 900, cost: 300, margin: 600 });
    expect(jollof.pct).toBeCloseTo(1 / 3);
  });
});
