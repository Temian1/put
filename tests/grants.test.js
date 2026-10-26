import { describe, it, expect } from "vitest";
import { createSave } from "../src/systems/SaveManager.js";
import { applyGrant, applyGrants, grantLabel } from "../src/game/grants.js";
import { effects, level } from "../src/game/equipment.js";
import { mergeSaves } from "../src/systems/CloudSave.js";

const fresh = (patch = {}) => {
  const s = createSave({ getItem: () => null, setItem() {} });
  s.load();
  return Object.assign(s.d, patch);
};

describe("items bought with Lagos Life", () => {
  it("adds boosters, outfits, decor, upgrades, equipment and naira", () => {
    const d = fresh({ coins: 1000, branches: ["ch0", "ch1"], place: "ch1" });
    const before = d.boosters.freeze;
    const { applied } = applyGrants(d, [
      { id: "pu_1", type: "booster", item: "freeze", quantity: 3 },
      { id: "pu_2", type: "outfit", item: "gold", quantity: 1 },
      { id: "pu_3", type: "decor", item: "lights", quantity: 1 },
      { id: "pu_4", type: "upgrade", item: "time", quantity: 1 },
      { id: "pu_5", type: "equipment", item: "fridge", quantity: 1 },
      { id: "pu_6", type: "cash", item: "", quantity: 50000 },
    ]);
    expect(applied).toHaveLength(6);
    expect(d.boosters.freeze).toBe(before + 3);
    expect(d.outfits).toContain("gold");
    expect(d.outfit).toBe("gold");
    expect(d.decor).toContain("lights");
    expect(d.up.time).toBe(1);
    // Equipment goes to the restaurant you are at.
    expect(effects(d, "ch1").fridge).toBe(true);
    expect(effects(d, "ch0").fridge).toBe(false);
    expect(d.coins).toBe(51000);
  });
  it("applies each purchase once, even when it arrives again", () => {
    const d = fresh();
    const g = { id: "pu_9", type: "booster", item: "auto", quantity: 2 };
    const start = d.boosters.auto;
    expect(applyGrant(d, g)).toBe(true);
    expect(applyGrant(d, g)).toBe(false);
    const again = applyGrants(d, [g]);
    expect(again).toEqual({ handled: ["pu_9"], applied: [] });
    expect(d.boosters.auto).toBe(start + 2);
    // Another device's save that already has it does not add it twice.
    const other = { ...d, grantsApplied: [] };
    const merged = mergeSaves(other, d);
    expect(merged.grantsApplied).toContain("pu_9");
  });
  it("never goes past an item's top level", () => {
    const d = fresh({ place: "ch0" });
    applyGrant(d, { id: "a", type: "upgrade", item: "fast", quantity: 99 });
    expect(d.up.fast).toBe(5);
    applyGrant(d, { id: "b", type: "equipment", item: "fridge", quantity: 5 });
    expect(level(d, "fridge")).toBe(3);
  });
  it("ignores unknown items but remembers them, and labels grants", () => {
    const d = fresh();
    expect(applyGrant(d, { id: "x", type: "booster", item: "nope" })).toBe(
      false,
    );
    expect(d.grantsApplied).toContain("x");
    expect(grantLabel({ type: "booster", item: "freeze", quantity: 3 })).toBe(
      "3 × Freeze Time",
    );
    expect(grantLabel({ type: "coins", quantity: 100 })).toBe("100 coins");
  });
});
