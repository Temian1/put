import { describe, it, expect } from "vitest";
import {
  createBoard,
  findGroups,
  findMove,
  trySwap,
  smash,
  shuffle,
  addSpecials,
  levelSpec,
  applyGoals,
  goalsMet,
  starsFor,
  greaseLeft,
  seeded,
} from "../src/game/match3.js";
import {
  createRun,
  step,
  act,
  tierFor,
  deliveryPay,
  runStars,
  runSettlement,
  TIERS,
} from "../src/game/runner.js";
import {
  sideSave,
  claimMatch,
  claimRun,
  matchReward,
  buyItem,
  canPay,
  unlockedRecipes,
  RECIPES,
  DAILY_PAID,
} from "../src/game/sidegames.js";
import { specialsFor } from "../src/game/service.js";

// A board set from rows of kind numbers, for exact match tests.
function boardOf(rows, kinds = 6) {
  const s = createBoard({
    w: rows[0].length,
    h: rows.length,
    kinds,
    rng: seeded(3),
  });
  let id = 1000;
  s.grid = rows.map((r) => r.map((k) => ({ id: id++, k, sp: null })));
  return s;
}
const ids = (s) => s.grid.flat().map((c) => c.id);

describe("Market Match board", () => {
  it("starts with no matches and at least one move", () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = createBoard({ kinds: 6, rng: seeded(seed) });
      expect(findGroups(s)).toEqual([]);
      expect(findMove(s)).toBeTruthy();
      expect(s.grid.flat().every(Boolean)).toBe(true);
    }
  });

  it("finds lines and names the special each shape makes", () => {
    const four = boardOf([
      [0, 0, 0, 0, 1],
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 1],
    ]);
    expect(findGroups(four)[0].special).toBe("row");
    const five = boardOf([
      [0, 0, 0, 0, 0],
      [1, 2, 3, 4, 5],
    ]);
    expect(findGroups(five)[0].special).toBe("ladle");
    const ell = boardOf([
      [0, 1, 2],
      [0, 3, 4],
      [0, 0, 0],
    ]);
    const [g] = findGroups(ell);
    expect(g.special).toBe("pot");
    expect(g.cells).toHaveLength(5);
  });

  it("rejects a swap that matches nothing and leaves the board as it was", () => {
    const s = boardOf([
      [0, 1, 2],
      [3, 4, 5],
      [1, 2, 3],
    ]);
    const before = ids(s);
    expect(trySwap(s, [0, 0], [1, 0]).ok).toBe(false);
    expect(trySwap(s, [0, 0], [2, 2]).ok).toBe(false);
    expect(ids(s)).toEqual(before);
  });

  it("a good swap clears, drops tiles, refills and makes a special", () => {
    const s = boardOf([
      [1, 2, 3, 4, 5],
      [0, 0, 5, 0, 1],
      [3, 4, 0, 1, 2],
    ]);
    const res = trySwap(s, [2, 1], [2, 2]);
    expect(res.ok).toBe(true);
    const first = res.steps[0];
    expect(first.made[0]).toMatchObject({ sp: "row" });
    // Three tiles go; the fourth stays as the new blast.
    expect(first.cleared.length).toBe(3);
    expect(first.spawned.length).toBe(3);
    expect(s.grid.flat().every(Boolean)).toBe(true);
    expect(findGroups(s)).toEqual([]);
  });

  it("a blast clears its row and two ladles clear the board", () => {
    const s = boardOf([
      [1, 2, 3, 4],
      [2, 3, 4, 5],
      [3, 4, 5, 1],
    ]);
    s.grid[1][0].sp = "row";
    const res = smash(s, 0, 1);
    expect(res.steps[0].cleared.map((c) => c.y)).toEqual([1, 1, 1, 1]);
    const t = boardOf([
      [1, 2, 3],
      [2, 3, 4],
    ]);
    t.grid[0][0].sp = "ladle";
    t.grid[0][1].sp = "ladle";
    const big = trySwap(t, [0, 0], [1, 0]);
    expect(big.ok).toBe(true);
    expect(big.steps[0].cleared.length).toBe(6);
  });

  it("stirring keeps every tile and leaves a move", () => {
    const s = createBoard({ kinds: 5, rng: seeded(9) });
    const before = ids(s).sort();
    shuffle(s);
    expect(ids(s).sort()).toEqual(before);
    expect(findGroups(s)).toEqual([]);
    expect(findMove(s)).toBeTruthy();
    expect(addSpecials(s, 2)).toHaveLength(2);
  });

  it("levels add grease and goals; goals count cleared tiles", () => {
    expect(levelSpec(1).goals).toHaveLength(1);
    const l5 = levelSpec(5);
    expect(l5.grease.length).toBeGreaterThan(0);
    expect(l5.goals.some((g) => g.type === "grease")).toBe(true);
    const s = createBoard({ grease: l5.grease, rng: seeded(1) });
    expect(greaseLeft(s)).toBe(l5.grease.length);
    const goals = [{ type: "collect", k: 0, n: 2 }];
    const p = applyGoals(
      goals,
      [0],
      [{ cleared: [{ k: 0 }, { k: 0 }, { k: 1 }], grease: [] }],
    );
    expect(goalsMet(goals, p)).toBe(true);
    expect(starsFor(10, 20)).toBe(3);
    expect(starsFor(0, 20)).toBe(1);
  });
});

describe("Okada Rush", () => {
  it("opens at level 10 and grows into endless at level 50", () => {
    expect(tierFor(9)).toBe(null);
    expect(tierFor(10).id).toBe(1);
    expect(tierFor(25).id).toBe(2);
    expect(tierFor(49).id).toBe(3);
    expect(tierFor(50).endless).toBe(true);
  });

  it("every row of road leaves a lane open", () => {
    const r = createRun(TIERS[3], seeded(4));
    const rows = {};
    r.items
      .filter((i) => i.type === "hazard")
      .forEach((i) => (rows[i.z] = (rows[i.z] || 0) + 1));
    expect(Math.max(...Object.values(rows))).toBeLessThan(3);
  });

  it("delivers a hot pack at a drop and pays more for hot food", () => {
    const r = createRun(TIERS[0], seeded(2));
    r.items = [{ id: 1, type: "drop", lane: 1, z: 5 }];
    r.genZ = 1e9;
    act(r, "right");
    for (let i = 0; i < 60 && !r.delivered; i++) step(r, 1 / 30);
    expect(r.delivered).toBe(1);
    expect(r.packs).toHaveLength(0);
    expect(deliveryPay(TIERS[0], 1, 1)).toBeGreaterThan(
      deliveryPay(TIERS[0], 0.2, 1),
    );
  });

  it("crashes spill food, a helmet saves you, jumping clears barriers", () => {
    const r = createRun(TIERS[0], seeded(2), { helmet: true });
    r.items = [
      { id: 1, type: "hazard", kind: "danfo", lane: 0, z: 3 },
      { id: 2, type: "hazard", kind: "danfo", lane: 0, z: 30 },
    ];
    r.genZ = 1e9;
    for (let i = 0; i < 300 && r.crashes === 0; i++) step(r, 1 / 30);
    expect(r.power.helmet).toBe(false);
    expect(r.crashes).toBe(1);
    expect(r.packs).toHaveLength(0);
    const j = createRun(TIERS[0], seeded(2));
    j.items = [{ id: 1, type: "hazard", kind: "barrier", lane: 0, z: 4 }];
    j.genZ = 1e9;
    let jumped = false;
    for (let i = 0; i < 60; i++) {
      if (!jumped && 4 - j.dist < 2.5) {
        act(j, "jump");
        jumped = true;
      }
      step(j, 1 / 30);
    }
    expect(j.crashes).toBe(0);
  });

  it("a timed round ends on the clock; stars need the target", () => {
    const r = createRun(TIERS[0], seeded(5));
    r.items = [];
    r.genZ = 1e9;
    for (let i = 0; i < 80 * 10; i++) step(r, 0.1);
    expect(r.over).toBe(true);
    expect(r.why).toBe("time");
    r.delivered = 5;
    expect(runStars(r)).toBe(1);
    r.delivered = 11;
    expect(runStars(r)).toBe(3);
    expect(runSettlement(r).fuel).toBeGreaterThan(0);
  });
});

describe("side game rewards", () => {
  const fresh = () => ({ coins: 0, pantry: {}, boosters: {} });

  it("first clears give recipes, ingredients and boosters; replays are capped", () => {
    const d = fresh();
    sideSave(d);
    const r3 = claimMatch(d, 3, 3, "2026-1-1");
    expect(r3.recipe).toBe("coconutrice");
    expect(unlockedRecipes(d).map((r) => r.id)).toEqual(["coconutrice"]);
    expect(Object.values(d.pantry).reduce((a, b) => a + b, 0)).toBeGreaterThan(
      0,
    );
    expect(d.side.match.level).toBe(4);
    const coins = d.coins;
    for (let i = 0; i < DAILY_PAID.match; i++) claimMatch(d, 3, 1, "2026-1-1");
    expect(d.coins).toBeGreaterThan(coins);
    expect(canPay(d, "match", "2026-1-1")).toBe(false);
    const capped = d.coins;
    claimMatch(d, 3, 1, "2026-1-1");
    expect(d.coins).toBe(capped);
    expect(canPay(d, "match", "2026-1-2")).toBe(true);
    expect(Object.keys(matchReward(2, true).boosters)).toHaveLength(1);
  });

  it("recipe specials only appear once unlocked", () => {
    const foods = ["jollof", "beef"];
    expect(specialsFor(foods).some((s) => s.id === "coconutrice")).toBe(false);
    expect(
      specialsFor(foods, ["coconutrice"]).some((s) => s.id === "coconutrice"),
    ).toBe(true);
    expect(RECIPES).toHaveLength(6);
  });

  it("runs pay the restaurant minus fuel and keep the endless best", () => {
    const d = fresh();
    const run = { tier: TIERS[3], delivered: 12 };
    const res = claimRun(d, run, { gross: 9000, fuel: 400, net: 8600 }, "x");
    expect(res.record).toBe(true);
    expect(d.coins).toBe(8600);
    expect(d.side.log[0].cost).toBe(400);
    d.coins = 30000;
    expect(buyItem(d, "gear", "box")).toBe(true);
    expect(buyItem(d, "gear", "box")).toBe(false);
    expect(buyItem(d, "tool", "spoon")).toBe(true);
    expect(d.side.match.tools.spoon).toBe(2);
  });
});

describe("side games across devices", () => {
  it("merging two saves keeps the best side game progress", async () => {
    const { mergeSaves } = await import("../src/systems/CloudSave.js");
    const phone = {
      updatedAt: 2,
      unlocked: 12,
      side: {
        match: { level: 4, stars: { 1: 3, 2: 1 }, tools: { spoon: 2 } },
        run: { best: 9, bestDelivered: 9, runs: 3 },
        recipes: ["coconutrice"],
      },
    };
    const laptop = {
      updatedAt: 1,
      unlocked: 12,
      side: {
        match: { level: 7, stars: { 2: 3 } },
        run: { best: 14, bestDelivered: 14, runs: 5 },
        recipes: ["gizdodo"],
      },
    };
    const m = mergeSaves(phone, laptop);
    expect(m.side.match.level).toBe(7);
    expect(m.side.match.stars).toEqual({ 1: 3, 2: 3 });
    expect(m.side.match.tools.spoon).toBe(2);
    expect(m.side.run.best).toBe(14);
    expect(m.side.recipes.sort()).toEqual(["coconutrice", "gizdodo"]);
  });

  it("the next drop is the nearest customer still waiting", async () => {
    const { nextDrop } = await import("../src/game/runner.js");
    const r = createRun(TIERS[0], seeded(1));
    r.items = [
      { id: 1, type: "drop", lane: 1, z: 40, name: "Far" },
      { id: 2, type: "drop", lane: -1, z: 20, name: "Near", done: true },
      { id: 3, type: "drop", lane: -1, z: 25, name: "Next" },
    ];
    expect(nextDrop(r).name).toBe("Next");
  });
});
