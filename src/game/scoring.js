import { roundNaira } from "./currency.js";

// base is the order's menu price in naira; points equal the bill after bonuses.
export function scoreOrder({
  base,
  combo,
  patienceRatio,
  vip,
  tips,
  coinMult,
}) {
  const mult =
    (1 + 0.1 * Math.min(combo, 10)) *
    (patienceRatio > 0.6 ? 1.25 : 1) *
    (vip ? 2 : 1);
  const points = roundNaira(base * mult);
  return {
    points,
    coins: roundNaira(points * (1 + 0.1 * tips) * coinMult, 10),
  };
}

// Customer tip on top of the bill; only paid when they did not wait too long.
export function tipFor({ base, patienceRatio, tipFactor }) {
  if (patienceRatio <= 0.35) return 0;
  return roundNaira(base * 0.1 * tipFactor * (patienceRatio > 0.6 ? 1.5 : 1));
}

// Wages come out of the shift's takings but never push it below zero.
export const netAfterWages = (earned, wages) => Math.max(0, earned - wages);
