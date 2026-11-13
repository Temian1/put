import { describe, it, expect } from "vitest";
import { rebasePendingSave } from "../src/systems/PendingSave.js";

describe("purchases made during an in-flight cloud save", () => {
  const base = () => ({
    coins: 200000,
    saveEpoch: 0,
    updatedAt: 1,
    crew: {},
    crewSeq: 0,
    till: {},
    stats: { hire: 0 },
  });

  it("preserves the paid worker and cash deduction while incorporating remote earnings", () => {
    const before = base();
    const current = {
      ...before,
      coins: 155000,
      updatedAt: 3,
      crew: { ch0: [{ uid: "c1", job: "basira" }] },
      crewSeq: 1,
      stats: { hire: 1 },
    };
    const acknowledged = { ...before, coins: 210000, till: { ch1: 5000 } };
    const result = rebasePendingSave(before, current, acknowledged);
    expect(result.coins).toBe(165000);
    expect(result.crew.ch0[0].job).toBe("basira");
    expect(result.stats.hire).toBe(1);
    expect(result.till.ch1).toBe(5000);
    // Acknowledging it again must not charge another hiring fee.
    expect(rebasePendingSave(result, result, result)).toEqual(result);
  });

  it("keeps edits at different restaurants and does not mutate any input", () => {
    const before = { ...base(), crew: { ch0: [], ch1: [] } };
    const current = structuredClone(before);
    current.crew.ch0.push({ uid: "c1", job: "bisi" });
    const acknowledged = structuredClone(before);
    acknowledged.crew.ch1.push({ uid: "c2", job: "tunde" });
    const result = rebasePendingSave(before, current, acknowledged);
    expect(result.crew.ch0).toHaveLength(1);
    expect(result.crew.ch1).toHaveLength(1);
    expect(before.crew.ch0).toHaveLength(0);
    expect(acknowledged.crew.ch0).toHaveLength(0);
  });

  it("lets an explicit server recovery or reset win over pending old edits", () => {
    const before = base();
    const repaired = { ...before, coins: 900000, saveEpoch: 1 };
    expect(
      rebasePendingSave(before, { ...before, coins: 1 }, repaired),
    ).toEqual(repaired);
  });
});
