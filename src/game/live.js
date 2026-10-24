import { FOODS, PLACES, STAFF, BOOSTERS } from "./data.js";
import { EQUIPMENT } from "./equipment.js";

// Settings the admin controls from the Kikter backend (Filament "Mama Put
// settings"). Defaults match the built-in game so it plays the same offline.
export const LIVE = {
  maintenance: false,
  announcement: null,
  startCash: 3000,
  dailyReward: { base: 1000, step: 500 },
  dailyBonus: 6000,
  vatRate: 0.075,
  levy: 1,
  rent: 1,
  inflation: 0.007,
  news: null,
  outOfStock: null,
  features: {
    haggle: true,
    inspections: true,
    onlineOrders: true,
    events: true,
    leaderboard: true,
  },
  inspectionChance: 0.4,
};

// Original prices, so multipliers always apply to the built-in values.
const BASE = {
  equipment: EQUIPMENT.map((it) => it.costs.slice()),
  staff: STAFF.map((s) => ({ cost: s.cost, wage: s.wage })),
  boosters: BOOSTERS.map((b) => b.cost),
};
const round = (n, step) => Math.max(0, Math.round(n / step) * step);

export function applyLiveConfig(c) {
  if (!c || typeof c !== "object") return false;
  for (const k of [
    "maintenance",
    "announcement",
    "startCash",
    "dailyBonus",
    "vatRate",
    "inspectionChance",
  ])
    if (c[k] !== undefined) LIVE[k] = c[k];
  if (c.dailyReward)
    LIVE.dailyReward = { ...LIVE.dailyReward, ...c.dailyReward };
  if (c.features) LIVE.features = { ...LIVE.features, ...c.features };
  if (c.market) {
    LIVE.inflation = c.market.inflation ?? LIVE.inflation;
    LIVE.news = c.market.news || null;
    LIVE.outOfStock = c.market.outOfStock?.length ? c.market.outOfStock : null;
  }
  const m = c.multipliers || {};
  LIVE.levy = m.levy ?? 1;
  LIVE.rent = m.rent ?? 1;
  for (const [id, price] of Object.entries(c.foodPrices || {}))
    if (FOODS[id] && price > 0) FOODS[id].price = price;
  (c.places || []).forEach((p, i) => {
    if (!PLACES[i]) return;
    if (i > 0 && p.cost >= 0) PLACES[i].cost = p.cost;
    if (p.income >= 0) PLACES[i].income = p.income;
  });
  EQUIPMENT.forEach((it, i) => {
    it.costs = BASE.equipment[i].map((v) => round(v * (m.equipment ?? 1), 500));
  });
  STAFF.forEach((s, i) => {
    s.cost = round(BASE.staff[i].cost * (m.staff ?? 1), 500);
    s.wage = round(BASE.staff[i].wage * (m.staff ?? 1), 50);
  });
  BOOSTERS.forEach((b, i) => {
    b.cost = round(BASE.boosters[i] * (m.boosters ?? 1), 100);
  });
  return true;
}
