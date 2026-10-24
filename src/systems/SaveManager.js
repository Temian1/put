import { COIN_TO_NAIRA } from "../game/currency.js";
import { emptyStats } from "../game/missions.js";

export const SAVE_SCHEMA = 2;

export function createSave(storage = globalThis.localStorage) {
  const Save = {
    key: "mamaPutRush3D.v1",
    d: null,
    defaults() {
      return {
        schema: SAVE_SCHEMA,
        coins: 3000,
        unlocked: 1,
        stars: {},
        best: {},
        up: { fast: 0, patience: 0, tips: 0, time: 0 },
        outfits: ["classic"],
        outfit: "classic",
        decor: [],
        staff: [],
        staffOff: [],
        unpaid: {},
        reputation: 50,
        branches: ["ojuelegba"],
        place: "ojuelegba",
        boosters: { freeze: 1, auto: 1, calm: 1 },
        sound: true,
        music: true,
        haptics: true,
        quality: "high",
        endlessBest: 0,
        lastClaim: "",
        streak: 0,
        dailyDone: "",
        tutorialDone: false,
        taught: [],
        stats: emptyStats(),
        missions: null,
        achievements: [],
        playerId: "",
        updatedAt: 0,
      };
    },
    load() {
      let d = null;
      try {
        d = JSON.parse(storage.getItem(this.key));
      } catch (e) {}
      this.d = migrate(d, this.defaults());
    },
    save() {
      this.d.updatedAt = Date.now();
      try {
        storage.setItem(this.key, JSON.stringify(this.d));
      } catch (e) {}
    },
  };

  return Save;
}

// Fills missing fields and upgrades version 1 saves, which counted coins.
export function migrate(d, defaults) {
  const out = Object.assign(defaults, d || {});
  if (d && !d.schema) {
    out.coins = Math.round((d.coins || 0) * COIN_TO_NAIRA);
    out.endlessBest = Math.round((d.endlessBest || 0) * COIN_TO_NAIRA);
    out.best = Object.fromEntries(
      Object.entries(d.best || {}).map(([k, v]) => [k, v * COIN_TO_NAIRA]),
    );
  }
  out.schema = SAVE_SCHEMA;
  const fresh = createDefaultsShape();
  out.up = Object.assign(fresh.up, out.up || {});
  out.boosters = Object.assign(fresh.boosters, out.boosters || {});
  out.stats = Object.assign(emptyStats(), out.stats || {});
  out.stats.food = Object.assign({}, out.stats.food || {});
  if (!out.unpaid || typeof out.unpaid !== "object") out.unpaid = {};
  if (typeof out.reputation !== "number") out.reputation = 50;
  if (!Array.isArray(out.branches) || !out.branches.includes("ojuelegba"))
    out.branches = [
      "ojuelegba",
      ...(Array.isArray(out.branches) ? out.branches : []),
    ];
  for (const k of [
    "staff",
    "staffOff",
    "taught",
    "achievements",
    "outfits",
    "decor",
  ])
    if (!Array.isArray(out[k])) out[k] = k === "outfits" ? ["classic"] : [];
  return out;
}
const createDefaultsShape = () => ({
  up: { fast: 0, patience: 0, tips: 0, time: 0 },
  boosters: { freeze: 0, auto: 0, calm: 0 },
});
