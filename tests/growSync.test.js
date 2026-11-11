import { describe, expect, it } from "vitest";
import { createOnline } from "../src/systems/Online.js";

describe("Grow shared between normal and Lagos Life sign-in", () => {
  function setup() {
    const state = { save: null, version: 0 };
    const device = () => {
      const storage = new Map();
      return createOnline({
        base: "https://api.test",
        storage: {
          getItem: (key) => storage.get(key),
          setItem: (key, value) => storage.set(key, value),
        },
        fetchImpl: async (url, options) => {
          const body = options.body && JSON.parse(options.body);
          let data;
          if (url.includes("/auth/"))
            data = { id: 21, token: "test", source: "both" };
          else if (options.method === "GET")
            data = {
              save: structuredClone(state.save),
              version: state.version,
            };
          else {
            state.save = structuredClone(body.save);
            data = { version: ++state.version };
          }
          return { status: 200, ok: true, json: async () => data };
        },
      });
    };
    return { state, device };
  }

  const manager = { uid: "c1", job: "mgr3", name: "Bose" };
  const original = () => ({
    coins: 1000,
    updatedAt: 10,
    saveEpoch: 1,
    crew: { ch1: [manager] },
    till: { ch1: 9000 },
    awayFrom: 100,
    awayOpenMs: 0,
    crewSeq: 1,
    day: 2,
  });

  it("adopts shared managers and safes on Lagos Life's first sync despite a newer local clock", async () => {
    const { state, device } = setup();
    state.save = original();
    const ll = device();
    await ll.lagosLife("test-session");
    const merged = await ll.sync({
      ...original(),
      updatedAt: 999,
      crew: {},
      till: {},
    });
    expect(merged.crew.ch1).toEqual([manager]);
    expect(merged.till.ch1).toBe(9000);
    expect(merged.awayFrom).toBe(100);
  });

  it("keeps a collection and staff changes from being overwritten by an unchanged second browser", async () => {
    const { state, device } = setup();
    state.save = original();
    const normal = device(),
      ll = device();
    await normal.login("test@example.test", "test");
    await ll.lagosLife("test-session");
    const a = await normal.sync(original());
    const b = await ll.sync(original());
    await normal.sync({
      ...a,
      updatedAt: 20,
      coins: 10000,
      till: { ch1: 0 },
      crew: { ch1: [] },
    });
    const merged = await ll.sync({ ...b, updatedAt: 999 });
    expect(merged.till.ch1).toBe(0);
    expect(merged.coins).toBe(10000);
    expect(merged.crew.ch1).toEqual([]);
  });

  it("retains changes at different restaurants", async () => {
    const { state, device } = setup();
    state.save = { ...original(), crew: { ch1: [manager], ch2: [] } };
    const a = device(),
      b = device();
    await a.login("test@example.test", "test");
    await b.lagosLife("test-session");
    const left = await a.sync(original());
    const right = await b.sync(original());
    await a.sync({ ...left, updatedAt: 20, crew: { ch1: [], ch2: [] } });
    const merged = await b.sync({
      ...right,
      updatedAt: 30,
      crew: { ch1: [manager], ch2: [{ ...manager, uid: "c2" }] },
    });
    expect(merged.crew.ch1).toEqual([]);
    expect(merged.crew.ch2[0].uid).toBe("c2");
    await b.logout();
    expect(b.account).toBe(null);
  });
});
