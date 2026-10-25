import { TIERS, PLACES, chapterOf } from "./data.js";

// Reputation (0–100) is how the street rates your buka. Good, fast service
// raises it; lost customers, finished pots and late deliveries lower it.
export const REP_START = 50;
export const REP = {
  serveFast: 0.8,
  serve: 0.3,
  wrong: -0.4,
  lost: -3,
  complain: -0.5,
  delivered: 0.6,
  late: -2.5,
  eventDone: 4,
  eventFailed: -6,
};
export const clampRep = (r) => Math.max(0, Math.min(100, r));

// More customers come to a well-rated buka: the gap between arrivals shrinks
// from 1.3x (rep 0) to 0.75x (rep 100). Tips scale the same way.
export const spawnFactor = (rep) => 1.3 - (0.55 * clampRep(rep)) / 100;
export const repTipFactor = (rep) => 0.7 + (0.6 * clampRep(rep)) / 100;

export function tierOf(d) {
  const earn = d.stats?.earn || 0,
    rep = d.reputation ?? REP_START;
  let t = 0;
  TIERS.forEach((tier, i) => {
    if (earn >= tier.earn && rep >= tier.rep) t = i;
  });
  return t;
}

export const nextTier = (d) => TIERS[tierOf(d) + 1] || null;

// A restaurant can be opened once the chapter before it is beaten
// (its first level is unlocked) and the owner has the opening money.
export function canOpen(d, place) {
  if (d.branches.includes(place.id)) return { ok: false, why: "owned" };
  if (d.unlocked < place.firstLevel)
    return { ok: false, why: `Beat level ${place.firstLevel - 1} first` };
  if (d.coins < place.cost) return { ok: false, why: "Not enough money" };
  return { ok: true };
}

export const placeOfLevel = (n) => PLACES[chapterOf(n)];
export const levelOpen = (d, n) => d.branches.includes(placeOfLevel(n).id);
// The newest restaurant you could open next, if any.
export const nextToOpen = (d) =>
  PLACES.find(
    (p) => !d.branches.includes(p.id) && d.unlocked >= p.firstLevel,
  ) || null;

export function openBranch(d, place) {
  if (!canOpen(d, place).ok) return false;
  d.coins -= place.cost;
  d.branches.push(place.id);
  return true;
}
