import { COIN_TO_NAIRA } from "../game/currency.js";
import { emptyStats } from "../game/missions.js";
import { LEGACY_PLACES, PLACES } from "../game/data.js";
import { migrateCrew } from "../game/crew.js";
import { migrateEquip } from "../game/equipment.js";

export const SAVE_SCHEMA = 3;

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
        // Each restaurant's own staff, and its manager's safe of takings.
        crew: {},
        crewSeq: 0,
        till: {},
        // Equipment bought for each restaurant.
        equipBy: {},
        // Lagos Life purchases already added to this save.
        grantsApplied: [],
        reputation: 50,
        equip: {},
        pantry: {},
        market: { shift: 0, index: 1, out: [], news: "" },
        debt: 0,
        lastPlayed: "",
        branches: ["ch0"],
        place: "ch0",
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
  // Before schema 3, chapters opened for free: keep every restaurant a player
  // already reached and translate the old branch ids.
  if (d && (d.schema || 1) < 3) {
    const reached = PLACES.filter(
      (p) => (out.unlocked || 1) >= p.firstLevel,
    ).map((p) => p.id);
    const old = (Array.isArray(d.branches) ? d.branches : []).map(
      (b) => LEGACY_PLACES[b] || b,
    );
    out.branches = [...new Set(["ch0", ...reached, ...old])];
    out.place = LEGACY_PLACES[out.place] || out.place;
  }
  // Staff used to be shared by every restaurant.
  if (d && (!d.crew || typeof d.crew !== "object")) {
    delete out.crew;
    migrateCrew(out);
  }
  if (!out.till || typeof out.till !== "object") out.till = {};
  if (d && (!d.equipBy || typeof d.equipBy !== "object")) migrateEquip(out);
  out.schema = SAVE_SCHEMA;
  const fresh = createDefaultsShape();
  out.up = Object.assign(fresh.up, out.up || {});
  out.boosters = Object.assign(fresh.boosters, out.boosters || {});
  out.stats = Object.assign(emptyStats(), out.stats || {});
  out.stats.food = Object.assign({}, out.stats.food || {});
  if (!out.unpaid || typeof out.unpaid !== "object") out.unpaid = {};
  if (typeof out.reputation !== "number") out.reputation = 50;
  for (const k of ["equip", "pantry"])
    if (!out[k] || typeof out[k] !== "object") out[k] = {};
  if (!out.market || typeof out.market.index !== "number")
    out.market = { shift: 0, index: 1, out: [], news: "" };
  if (typeof out.debt !== "number") out.debt = 0;
  if (!Array.isArray(out.branches)) out.branches = [];
  if (!out.branches.includes("ch0")) out.branches.unshift("ch0");
  if (!PLACES.some((p) => p.id === out.place)) out.place = "ch0";
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
