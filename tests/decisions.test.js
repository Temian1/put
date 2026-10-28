import { describe, it, expect } from "vitest";
import { createSave } from "../src/systems/SaveManager.js";
import {
  pricing,
  activeEffects,
  drawOpportunity,
  decide,
  resolveDecisions,
  payLoans,
  contractOffers,
  drawDisruption,
  cardById,
  averageAt,
} from "../src/game/decisions.js";

const fresh = (patch = {}) => {
  const s = createSave({ getItem: () => null, setItem() {} });
  s.load();
  return Object.assign(s.d, patch);
};
const ctx = (patch = {}) => ({
  place: "ch1",
  fmt: (n) => "₦" + Math.round(n),
  foods: ["jollof", "beef"],
  bulkCost: 16000,
  ricePrice: 2400,
  online: true,
  level: 12,
  ...patch,
});

describe("menu pricing", () => {
  it("premium earns more per plate but brings fewer customers", () => {
    const d = fresh({ prices: { ch0: "premium", ch9: "premium" } });
    expect(pricing(d, "ch0").mult).toBe(1.2);
    expect(pricing(d, "ch0").gap).toBeGreaterThan(1.2);
    // First-class diners care less about price than roadside customers.
    expect(pricing(d, "ch9").gap).toBeLessThan(pricing(d, "ch0").gap);
    expect(pricing(d, "ch3")).toEqual({ mult: 1, gap: 1 });
  });
});

describe("opportunity cards and the decision journal", () => {
  it("offers a card every few days and records the decision", () => {
    const d = fresh({ day: 4, coins: 100000 });
    const card = drawOpportunity(d, ctx(), () => 0);
    expect(card).toBeTruthy();
    expect(drawOpportunity(d, ctx())).toBe(null);
    const before = d.coins;
    const entry = decide(d, ctx(), "accept", { net: 5000, served: 10 });
    expect(entry.id).toBe(card.id);
    expect(d.coins).toBe(before - card.cost(ctx()));
    expect(d.offer).toBe(null);
  });
  it("judges a decision when its days are up", () => {
    const d = fresh({ day: 4, coins: 100000, offer: { id: "flyers" } });
    decide(d, ctx(), "accept", { net: 0, served: 10 });
    expect(activeEffects(d, "ch1").gap).toBeLessThan(1);
    expect(activeEffects(d, "ch0").gap).toBe(1);
    d.history = [5, 6, 7].map((day) => ({
      day,
      place: "ch1",
      served: 14,
      net: 3000,
    }));
    d.day = 6;
    expect(resolveDecisions(d, ctx())).toEqual([]);
    d.day = 7;
    const [judged] = resolveDecisions(d, ctx());
    expect(judged.data.after).toBe(14);
    expect(judged.outcome.good).toBe(true);
    expect(judged.outcome.text).toMatch(/flyers/);
  });
  it("a loan pays now and is repaid with interest, or becomes debt", () => {
    const d = fresh({ day: 10, coins: 0, offer: { id: "loan" } });
    decide(d, ctx(), "accept");
    expect(d.coins).toBe(150000);
    d.day = 20;
    d.coins = 100000;
    expect(payLoans(d)).toBe(172500);
    expect(d.coins).toBe(0);
    expect(d.debt).toBe(72500);
  });
  it("the bulk rice deal is judged against today's rice price", () => {
    const d = fresh({
      day: 4,
      coins: 50000,
      pantry: {},
      offer: { id: "bulkrice" },
    });
    decide(d, ctx(), "accept");
    expect(d.pantry.rice).toBe(8);
    d.day = 9;
    const [judged] = resolveDecisions(d, ctx({ ricePrice: 1500 }));
    expect(judged.outcome.good).toBe(false);
    expect(cardById("bulkrice")).toBeTruthy();
    expect(averageAt([], "ch1", "net")).toBe(0);
  });
});

describe("contracts and disruptions", () => {
  it("offers three catering contracts with different deals", () => {
    const offers = contractOffers(fresh({ day: 3 }), ["jollof"], () => 0.1);
    expect(offers).toHaveLength(3);
    expect(offers[2].portions).toBeGreaterThan(offers[0].portions);
    expect(offers[2].pay).toBeGreaterThan(offers[0].pay);
  });
  it("sometimes announces a disruption from level 6", () => {
    expect(drawDisruption(fresh(), ctx(), () => 0)).toBe(null);
    const d = fresh({ day: 5 });
    expect(drawDisruption(d, ctx({ level: 3 }), () => 0)).toBe(null);
    expect(drawDisruption(d, ctx(), () => 0.9)).toBe(null);
    const x = drawDisruption(d, ctx(), () => 0);
    expect(x.choices.length).toBe(2);
  });
});
