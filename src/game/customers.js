import { CUSTOMER_TYPES, MOODS } from "./data.js";

// Picks who walks in next. VIPs and wedding guests are decided by the level;
// everyone else is a weighted pick of the kinds unlocked for this chapter.
export function pickCustomerType(cfg, rand = Math.random) {
  if (cfg.tutorial) return "regular";
  const level = cfg.mode === "level" ? cfg.n : 99;
  const open = Object.entries(CUSTOMER_TYPES).filter(
    ([, t]) => cfg.ci >= t.minCi && level >= (t.minLevel || 0),
  );
  const total = open.reduce((s, [, t]) => s + t.weight, 0);
  let r = rand() * total;
  for (const [id, t] of open) {
    r -= t.weight;
    if (r < 0) return id;
  }
  return "regular";
}

// About half of customers show a mood that changes patience, tips and temper.
export function pickMood(cfg, rand = Math.random) {
  if (cfg.tutorial || rand() < 0.5) return null;
  const ids = Object.keys(MOODS);
  return ids[Math.floor(rand() * ids.length)];
}

export function customerTraits(type, mood) {
  const t = CUSTOMER_TYPES[type] || CUSTOMER_TYPES.regular,
    m = (mood && MOODS[mood]) || { patience: 1, tip: 1, wrong: 1 };
  return {
    patience: t.patience * m.patience,
    tip: t.tip * m.tip,
    wrong: m.wrong,
  };
}
