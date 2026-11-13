import { describe, it, expect } from "vitest";
import { createSave, migrate } from "../src/systems/SaveManager.js";
import { hire, runBranches } from "../src/game/crew.js";
import { buyEquipment, EQUIPMENT } from "../src/game/equipment.js";

describe("PHP empty maps must remain saveable after a purchase", () => {
  const defaults = () => createSave().defaults();
  const phpSave = () => ({
    ...defaults(),
    coins: 500000,
    crew: [],
    till: [],
    equipBy: [],
    pantry: [],
    unpaid: [],
    stars: [],
    best: [],
  });
  const roundTrip = (save) => JSON.parse(JSON.stringify(save));

  it("persists the first hired worker when the cloud crew was an empty array", () => {
    const save = migrate(phpSave(), defaults());
    hire(save, "ch0", "basira");
    const reloaded = roundTrip(save);
    expect(Array.isArray(save.crew)).toBe(false);
    expect(reloaded.crew.ch0[0].job).toBe("basira");
    expect(migrate(reloaded, defaults()).crew.ch0).toHaveLength(1);
  });

  it("defensively preserves workers even when hire is called before migration", () => {
    const save = phpSave();
    hire(save, "ch0", "tunde");
    expect(roundTrip(save).crew.ch0[0].job).toBe("tunde");
  });

  it("keeps equipment and managed safe earnings after a JSON round trip", () => {
    const save = phpSave();
    save.branches.push("ch1");
    hire(save, "ch1", "mgr3");
    const equipment = EQUIPMENT.find((it) => it.id === "tables");
    expect(buyEquipment(save, equipment, "ch1")).toBe(true);
    runBranches(save, null, 1, 3);
    const reloaded = roundTrip(save);
    expect(reloaded.equipBy.ch1.tables).toBe(1);
    expect(reloaded.till.ch1).toBeGreaterThan(0);
  });
});
