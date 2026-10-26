import { describe, it, expect } from "vitest";
import { canPlace, saveLayout, tablesAt } from "../src/game/layout.js";

describe("rearranging tables", () => {
  it("keeps tables inside the dining area", () => {
    expect(canPlace(-3.15, -1.62)).toBe(true);
    expect(canPlace(5, -1.62)).toBe(false);
    expect(canPlace(1, -3)).toBe(false);
  });
  it("keeps the counter queue clear", () => {
    expect(canPlace(0, -0.5)).toBe(false);
    expect(canPlace(2.05, -0.9)).toBe(false);
    expect(canPlace(3.15, -0.2)).toBe(true);
  });
  it("does not let tables overlap", () => {
    const others = [[-1.05, -1.62]];
    expect(canPlace(-0.2, -1.62, others)).toBe(false);
    expect(canPlace(1.05, -1.62, others)).toBe(true);
  });
  it("saves each restaurant's layout, snapped to a small grid", () => {
    const d = {};
    saveLayout(d, "ch1", [[1.234, -1.61]]);
    expect(tablesAt(d, "ch1")).toEqual([[1.25, -1.6]]);
    expect(tablesAt(d, "ch0")).toEqual([]);
  });
});
