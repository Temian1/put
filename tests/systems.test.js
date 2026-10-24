import { describe, it, expect, vi } from "vitest";
import {
  createCooker,
  tickCooker,
  tapCooker,
  hasPortion,
  takePortion,
  cookerProgress,
  createSink,
  addPlate,
  sinkFull,
  startWash,
  tickSink,
} from "../src/game/kitchen.js";
import {
  pickCustomerType,
  pickMood,
  customerTraits,
} from "../src/game/customers.js";
import {
  dailyMissions,
  ensureDaily,
  track,
  claim,
  claimable,
  ACHIEVEMENTS,
  achievementProgress,
} from "../src/game/missions.js";
import {
  mergeSaves,
  encodeBackup,
  decodeBackup,
  createCloudSync,
} from "../src/systems/CloudSave.js";
import { createHaptics } from "../src/systems/Haptics.js";
import { createSave } from "../src/systems/SaveManager.js";
import { levelCfg, CUSTOMER_TYPES } from "../src/game/data.js";
import { seeded } from "../src/game/utils.js";

const fresh = () => {
  const s = createSave({ getItem: () => null, setItem() {} });
  s.load();
  return s.d;
};

describe("cooking stages", () => {
  const spec = { time: 2, hold: 5, batch: 3, verb: "Fry" };
  it("goes raw → cooking → ready with a full batch", () => {
    const s = createCooker(spec);
    expect(hasPortion(s)).toBe(false);
    expect(tapCooker(s)).toBe("start");
    expect(tapCooker(s)).toBe("busy");
    expect(tickCooker(s, 1)).toBe(null);
    expect(cookerProgress(s)).toBeCloseTo(0.5);
    expect(tickCooker(s, 1)).toBe("ready");
    expect(s).toMatchObject({ stage: "ready", stock: 3, batches: 1 });
    expect(cookerProgress(s)).toBe(1);
  });
  it("cooks faster with the Sharp Sharp Hands upgrade", () => {
    const s = createCooker(spec);
    tapCooker(s);
    expect(tickCooker(s, 1, 2)).toBe("ready");
  });
  it("serves portions until empty, then needs frying again", () => {
    const s = createCooker(spec);
    tapCooker(s);
    tickCooker(s, 2);
    expect(takePortion(s)).toBe(true);
    expect(takePortion(s)).toBe(true);
    expect(takePortion(s)).toBe(true);
    expect(s.stage).toBe("raw");
    expect(takePortion(s)).toBe(false);
  });
  it("burns leftovers after the hold time and must be thrown away", () => {
    const s = createCooker(spec);
    tapCooker(s);
    tickCooker(s, 2);
    takePortion(s);
    expect(tickCooker(s, 4.9)).toBe(null);
    expect(tickCooker(s, 0.2)).toBe("burnt");
    expect(s).toMatchObject({ stage: "burnt", stock: 0, burnt: 2 });
    expect(takePortion(s)).toBe(false);
    expect(tapCooker(s)).toBe("clear");
    expect(s.stage).toBe("raw");
  });
});

describe("sink", () => {
  it("holds four plates and washes them one by one", () => {
    const sink = createSink(4);
    expect(startWash(sink)).toBe(false);
    for (let i = 0; i < 4; i++) expect(addPlate(sink)).toBe(true);
    expect(sinkFull(sink)).toBe(true);
    expect(addPlate(sink)).toBe(false);
    expect(startWash(sink)).toBe(true);
    expect(tickSink(sink, 0.5, 0.5)).toBe(1);
    expect(tickSink(sink, 1.0, 0.5)).toBe(2);
    expect(tickSink(sink, 0.6, 0.5)).toBe(1);
    expect(sink).toMatchObject({ plates: 0, washing: 0, washed: 4 });
    expect(tickSink(sink, 1, 0.5)).toBe(0);
  });
});

describe("customer variety", () => {
  it("only regular customers in the tutorial", () => {
    const rand = seeded(1);
    for (let i = 0; i < 50; i++)
      expect(pickCustomerType(levelCfg(1), rand)).toBe("regular");
    expect(pickMood(levelCfg(1), rand)).toBe(null);
  });
  it("unlocks schoolkids first, then okada riders and conductors, then Alhaji", () => {
    const seen = (n) => {
      const rand = seeded(n),
        s = new Set();
      for (let i = 0; i < 400; i++) s.add(pickCustomerType(levelCfg(n), rand));
      return s;
    };
    expect([...seen(5)].sort()).toEqual(["regular", "schoolkid"]);
    expect(seen(15).has("okada")).toBe(true);
    expect(seen(15).has("conductor")).toBe(true);
    expect(seen(15).has("alhaji")).toBe(false);
    expect(seen(25).has("alhaji")).toBe(true);
  });
  it("combines kind and mood into patience, tips and temper", () => {
    expect(customerTraits("alhaji", "generous")).toEqual({
      patience: CUSTOMER_TYPES.alhaji.patience,
      tip: CUSTOMER_TYPES.alhaji.tip * 1.6,
      wrong: 1,
    });
    expect(customerTraits("okada", "grumpy").wrong).toBe(2);
    expect(customerTraits("regular", null)).toEqual({
      patience: 1,
      tip: 1,
      wrong: 1,
    });
  });
});

describe("missions and achievements", () => {
  it("draws three distinct missions per day, the same all day", () => {
    const a = dailyMissions("2026-10-24");
    expect(a).toHaveLength(3);
    expect(new Set(a.map((m) => m.ev)).size).toBe(3);
    expect(dailyMissions("2026-10-24")).toEqual(a);
    expect(dailyMissions("2026-10-25")).not.toEqual(a);
  });
  it("tracks progress, keeps the best combo and pays once", () => {
    const d = fresh(),
      key = "2026-10-24";
    const list = ensureDaily(d, key);
    const m = list[0];
    for (let i = 0; i < m.goal; i++)
      track(d, m.ev, m.ev === "combo" ? m.goal : m.ev === "earn" ? 1 : 1, key);
    if (m.ev === "earn") track(d, "earn", m.goal, key);
    expect(m.progress).toBeGreaterThanOrEqual(m.goal);
    expect(claimable(d).daily.map((x) => x.id)).toContain(m.id);
    const before = d.coins;
    expect(claim(d, m.id)).toBe(m.reward);
    expect(d.coins).toBe(before + m.reward);
    expect(claim(d, m.id)).toBe(0);
  });
  it("replaces missions on a new day", () => {
    const d = fresh();
    ensureDaily(d, "2026-10-24")[0].progress = 99;
    expect(ensureDaily(d, "2026-10-25")[0].progress).toBe(0);
  });
  it("counts food, combos and stars into lifetime achievements", () => {
    const d = fresh();
    track(d, "food:jollof", 2);
    track(d, "combo", 7);
    track(d, "combo", 3);
    expect(d.stats.food.jollof).toBe(2);
    expect(d.stats.combo).toBe(7);
    d.stars = { 1: 3, 2: 3 };
    const stars = ACHIEVEMENTS.find((a) => a.id === "stars30");
    expect(achievementProgress(d, stars)).toBe(6);
    track(d, "serve");
    expect(claim(d, "first")).toBe(500);
    expect(d.achievements).toEqual(["first"]);
    expect(claim(d, "serve100")).toBe(0);
  });
});

describe("cloud save", () => {
  const base = () => ({
    ...fresh(),
    unlocked: 5,
    coins: 1000,
    stars: { 1: 3, 2: 1 },
    staff: ["chidi"],
    stats: { ...fresh().stats, serve: 40, food: { jollof: 10 } },
    updatedAt: 100,
  });
  it("merges progress forward from both devices and takes money from the newest", () => {
    const phone = base(),
      tablet = {
        ...base(),
        unlocked: 8,
        coins: 250,
        stars: { 2: 3, 7: 2 },
        staff: ["bisi"],
        stats: { ...fresh().stats, serve: 12, food: { jollof: 30, eba: 2 } },
        updatedAt: 200,
      };
    const m = mergeSaves(phone, tablet);
    expect(m).toMatchObject({
      unlocked: 8,
      coins: 250,
      stars: { 1: 3, 2: 3, 7: 2 },
      updatedAt: 200,
    });
    expect(m.staff.sort()).toEqual(["bisi", "chidi"]);
    expect(m.stats.serve).toBe(40);
    expect(m.stats.food).toEqual({ jollof: 30, eba: 2 });
    expect(mergeSaves(tablet, phone)).toEqual(m);
  });
  it("encodes a backup code with a checksum", () => {
    const d = base(),
      code = encodeBackup(d);
    expect(code.startsWith("MPR2.")).toBe(true);
    expect(decodeBackup(code)).toEqual(d);
    expect(() => decodeBackup("hello")).toThrow(/not a Mama Put/);
    const [tag, , body] = code.split(".");
    expect(() => decodeBackup([tag, "0", body].join("."))).toThrow(
      /incomplete/,
    );
    expect(() => decodeBackup(code.slice(0, code.length / 2))).toThrow();
  });
  it("syncs over HTTP and resolves a version conflict by merging", async () => {
    let server = { ...base(), unlocked: 12, updatedAt: 50 },
      version = 1,
      conflictOnce = true;
    const fetchImpl = vi.fn(async (url, opts = {}) => {
      const etag = '"' + version + '"';
      if (!opts.method)
        return {
          ok: true,
          status: 200,
          headers: { get: () => etag },
          json: async () => server,
        };
      if (conflictOnce) {
        conflictOnce = false;
        server = { ...server, unlocked: 14 };
        version++;
        return { ok: false, status: 412, headers: { get: () => null } };
      }
      expect(opts.headers["If-Match"]).toBe('"' + version + '"');
      server = JSON.parse(opts.body);
      version++;
      return {
        ok: true,
        status: 200,
        headers: { get: () => '"' + version + '"' },
      };
    });
    const sync = createCloudSync({ url: "https://saves.example/", fetchImpl });
    const local = { ...base(), playerId: "mp-1", updatedAt: 300 };
    const merged = await sync.sync(local);
    expect(merged.unlocked).toBe(14);
    expect(merged.coins).toBe(1000);
    expect(server.unlocked).toBe(14);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://saves.example/saves/mp-1");
  });
});

describe("haptics", () => {
  it("vibrates only when supported, enabled and motion is allowed", () => {
    const vibrate = vi.fn(),
      Save = { d: { haptics: true } };
    createHaptics(Save, { vibrate }).play("serve");
    expect(vibrate).toHaveBeenCalledWith(18);
    Save.d.haptics = false;
    createHaptics(Save, { vibrate }).play("serve");
    Save.d.haptics = true;
    createHaptics(Save, { vibrate }, true).play("serve");
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(createHaptics(Save, {}).supported).toBe(false);
    expect(() => createHaptics(Save, undefined).play("win")).not.toThrow();
  });
});
