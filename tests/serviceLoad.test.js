import { describe, it, expect } from "vitest";
import { serviceLoad } from "../src/game/serviceLoad.js";
import { levelCfg, EVENTS } from "../src/game/data.js";
import {
  makeOnlineOrder,
  makeEventOrder,
  packsFor,
  portions,
} from "../src/game/deliveries.js";
import { createSink } from "../src/game/kitchen.js";

describe("workload across every campaign level", () => {
  it("increases customers by five and sink capacity by one at every level", () => {
    for (let n = 1; n <= 100; n++) {
      const cfg = levelCfg(n),
        load = serviceLoad(cfg);
      expect(cfg.goal).toBe(15 + 5 * (n - 1));
      expect(createSink(4 + load.extraSinkCapacity).capacity).toBe(n + 3);
      if (n > 1) {
        const previous = serviceLoad(levelCfg(n - 1));
        expect(load.onlineLimit).toBeGreaterThanOrEqual(previous.onlineLimit);
        expect(load.onlinePortions).toBeGreaterThanOrEqual(
          previous.onlinePortions,
        );
        expect(load.onlineIntervalScale).toBeLessThanOrEqual(
          previous.onlineIntervalScale,
        );
      }
    }
  });
  it("keeps sink upgrades on top of the growing base and supports endless", () => {
    const load = serviceLoad(levelCfg(62));
    expect(4 + load.extraSinkCapacity + 3).toBe(68);
    expect(serviceLoad({ goal: Infinity, n: 0 })).toMatchObject({
      extraSinkCapacity: 0,
      onlineLimit: 2,
    });
    expect(serviceLoad({ goal: 4, n: 1 }).extraSinkCapacity).toBe(0);
  });
  it("raises delivery portions, pack costs and deadlines for larger orders", () => {
    const menu = ["jollof", "chicken", "water"],
      rand = () => 0.8;
    const first = makeOnlineOrder(
      menu,
      rand,
      serviceLoad(levelCfg(15)).onlinePortions,
    );
    const later = makeOnlineOrder(
      menu,
      rand,
      serviceLoad(levelCfg(62)).onlinePortions,
    );
    expect(first.items.every((i) => i.need === 1)).toBe(true);
    expect(later.items.every((i) => i.need === 3)).toBe(true);
    expect(packsFor(first)).toBe(1);
    expect(packsFor(later)).toBe(3);
    expect(later.max).toBeGreaterThan(first.max);
    expect(serviceLoad(levelCfg(62)).onlineLimit).toBe(4);
  });
  it("scales catering quantities with matching cooler costs and preparation time", () => {
    const menu = levelCfg(35).foods;
    const base = makeEventOrder("wedding", menu, () => 0.2);
    const larger = makeEventOrder("wedding", menu, () => 0.2, 3);
    expect(portions(base)).toBe(EVENTS.wedding.size);
    expect(portions(larger)).toBe(EVENTS.wedding.size * 3);
    expect(packsFor(larger)).toBe(Math.ceil(portions(larger) / 4));
    expect(larger.max).toBeGreaterThan(base.max);
  });
});
