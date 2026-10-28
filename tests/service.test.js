import { describe, it, expect } from "vitest";
import {
  WAVE_SIZE,
  waveCount,
  waveOf,
  waveDone,
  serverOrder,
  cookAhead,
  specialsFor,
  plateQuality,
  specialPrice,
  markerAt,
  SPECIAL_DISHES,
} from "../src/game/service.js";

describe("service waves", () => {
  it("splits a big target into waves of about 25", () => {
    expect(waveCount(15)).toBe(1);
    expect(waveCount(100)).toBe(4);
    expect(waveCount(Infinity)).toBe(1);
    expect(waveOf(0, 100)).toMatchObject({
      index: 0,
      count: 4,
      start: 0,
      end: 25,
    });
    expect(waveOf(60, 100)).toMatchObject({ index: 2, start: 50, end: 75 });
    expect(Math.ceil(110 / waveCount(110))).toBeLessThanOrEqual(WAVE_SIZE);
  });
  it("notices the end of each wave but not the last", () => {
    expect(waveDone(24, 25, 100)).toBe(true);
    expect(waveDone(25, 26, 100)).toBe(false);
    expect(waveDone(99, 100, 100)).toBe(false);
    expect(waveDone(10, 11, 15)).toBe(false);
  });
});

describe("crew priorities", () => {
  it("changes what servers and cooks do first", () => {
    expect(serverOrder("counter")).toEqual(["counter", "pack"]);
    expect(serverOrder("delivery")).toEqual(["pack", "counter"]);
    expect(cookAhead("restock")).toBe(true);
    expect(cookAhead("counter")).toBe(false);
  });
});

describe("owner specials", () => {
  it("only offers specials the menu can make", () => {
    expect(specialsFor(["jollof", "beef"]).map((s) => s.food)).toEqual([
      "jollof",
      "beef",
    ]);
    expect(specialsFor(["water"])).toEqual([]);
  });
  it("pays more for better plating", () => {
    const dish = SPECIAL_DISHES[0];
    const perfect = specialPrice(900, dish, plateQuality(0.5));
    const messy = specialPrice(900, dish, plateQuality(0.95));
    expect(plateQuality(0.5).grade).toBe("Perfect");
    expect(plateQuality(0.62).grade).toBe("Great");
    expect(perfect).toBeGreaterThan(messy);
    expect(perfect).toBe(Math.round((900 * dish.mult) / 50) * 50);
  });
  it("sweeps the marker back and forth", () => {
    expect(markerAt(0)).toBeCloseTo(0);
    expect(markerAt(1)).toBeCloseTo(1);
    expect(markerAt(0.5)).toBeCloseTo(0.5);
  });
});
