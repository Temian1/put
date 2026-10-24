import { seeded, hashStr } from "./utils.js";
import { fmtNaira } from "./currency.js";

// Events the game reports. "max" events keep the best value, others add up.
export const MAX_EVENTS = new Set(["combo"]);

// Daily missions: three are drawn per calendar day from this pool.
const POOL = [
  { ev: "serve", text: (n) => `Serve ${n} customers`, tiers: [12, 20, 32] },
  {
    ev: "earn",
    text: (n) => `Take ${fmtNaira(n)} in sales`,
    tiers: [15000, 30000, 60000],
  },
  { ev: "combo", text: (n) => `Reach a x${n} combo`, tiers: [4, 6, 9] },
  {
    ev: "food:jollof",
    text: (n) => `Dish ${n} plates of jollof`,
    tiers: [5, 9, 14],
  },
  {
    ev: "food:plantain",
    text: (n) => `Serve ${n} portions of dodo`,
    tiers: [5, 9, 14],
  },
  {
    ev: "food:beef",
    text: (n) => `Serve ${n} pieces of beef`,
    tiers: [5, 9, 14],
  },
  { ev: "cook", text: (n) => `Fry ${n} batches`, tiers: [3, 6, 10] },
  { ev: "wash", text: (n) => `Wash ${n} plates`, tiers: [5, 10, 18] },
  {
    ev: "win",
    text: (n) => `Win ${n} level${n > 1 ? "s" : ""}`,
    tiers: [1, 2, 4],
  },
  { ev: "tip", text: (n) => `Collect ${n} tips`, tiers: [4, 8, 14] },
  {
    ev: "booster",
    text: (n) => `Use ${n} booster${n > 1 ? "s" : ""}`,
    tiers: [1, 2, 3],
  },
  {
    ev: "perfect",
    text: () => "Win a level without losing a customer",
    tiers: [1, 1, 1],
  },
];
const REWARDS = [1500, 3000, 5000];

export function dailyMissions(key) {
  const rng = seeded(hashStr("missions" + key)),
    pool = POOL.slice(),
    out = [];
  for (let i = 0; i < 3; i++) {
    const m = pool.splice(Math.floor(rng() * pool.length), 1)[0],
      tier = Math.floor(rng() * 3);
    out.push({
      id: m.ev + ":" + tier,
      ev: m.ev,
      goal: m.tiers[tier],
      text: m.text(m.tiers[tier]),
      reward: REWARDS[tier],
      progress: 0,
      claimed: false,
    });
  }
  return out;
}

// Lifetime achievements read straight from lifetime stats.
export const ACHIEVEMENTS = [
  { id: "first", stat: "serve", goal: 1, name: "First Customer", reward: 500 },
  { id: "serve100", stat: "serve", goal: 100, name: "Regulars", reward: 4000 },
  {
    id: "serve1000",
    stat: "serve",
    goal: 1000,
    name: "Talk of the Street",
    reward: 25000,
  },
  { id: "combo10", stat: "combo", goal: 10, name: "Sharp Sharp", reward: 5000 },
  {
    id: "earn100k",
    stat: "earn",
    goal: 100000,
    name: "First ₦100k",
    reward: 5000,
  },
  {
    id: "earn1m",
    stat: "earn",
    goal: 1000000,
    name: "Millionaire Madam",
    reward: 30000,
  },
  { id: "cook50", stat: "cook", goal: 50, name: "Hot Oil", reward: 6000 },
  {
    id: "wash100",
    stat: "wash",
    goal: 100,
    name: "Clean Kitchen",
    reward: 6000,
  },
  {
    id: "tip50",
    stat: "tip",
    goal: 50,
    name: "Customers' Favourite",
    reward: 5000,
  },
  { id: "hire", stat: "hire", goal: 1, name: "Helping Hands", reward: 3000 },
  { id: "staff4", stat: "hire", goal: 4, name: "Full Staff", reward: 15000 },
  { id: "stars30", stat: "stars", goal: 30, name: "Star Buka", reward: 10000 },
  {
    id: "stars150",
    stat: "stars",
    goal: 150,
    name: "Empire Builder",
    reward: 50000,
  },
];

export const emptyStats = () => ({
  serve: 0,
  earn: 0,
  combo: 0,
  cook: 0,
  wash: 0,
  win: 0,
  tip: 0,
  booster: 0,
  perfect: 0,
  hire: 0,
  food: {},
});

// Keeps today's missions in the save, replacing yesterday's.
export function ensureDaily(d, key) {
  if (!d.missions || d.missions.day !== key)
    d.missions = { day: key, list: dailyMissions(key) };
  return d.missions.list;
}

export function track(d, ev, amount = 1, key) {
  const s = d.stats;
  if (ev.startsWith("food:")) {
    const f = ev.slice(5);
    s.food[f] = (s.food[f] || 0) + amount;
  } else if (MAX_EVENTS.has(ev)) s[ev] = Math.max(s[ev] || 0, amount);
  else s[ev] = (s[ev] || 0) + amount;
  if (key) ensureDaily(d, key);
  for (const m of d.missions?.list || []) {
    if (m.ev !== ev || m.claimed) continue;
    m.progress = MAX_EVENTS.has(ev)
      ? Math.max(m.progress, amount)
      : m.progress + amount;
  }
}

export const totalStars = (d) =>
  Object.values(d.stars || {}).reduce((a, b) => a + b, 0);

export function achievementProgress(d, a) {
  const v = a.stat === "stars" ? totalStars(d) : d.stats[a.stat] || 0;
  return Math.min(v, a.goal);
}

export function claimable(d) {
  const daily = (d.missions?.list || []).filter(
    (m) => !m.claimed && m.progress >= m.goal,
  );
  const ach = ACHIEVEMENTS.filter(
    (a) =>
      !d.achievements.includes(a.id) && achievementProgress(d, a) >= a.goal,
  );
  return { daily, ach, count: daily.length + ach.length };
}

// Pays a finished mission or achievement. Returns the naira awarded (0 if not ready).
export function claim(d, id) {
  const m = (d.missions?.list || []).find((x) => x.id === id);
  if (m) {
    if (m.claimed || m.progress < m.goal) return 0;
    m.claimed = true;
    d.coins += m.reward;
    return m.reward;
  }
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || d.achievements.includes(id) || achievementProgress(d, a) < a.goal)
    return 0;
  d.achievements.push(id);
  d.coins += a.reward;
  return a.reward;
}
