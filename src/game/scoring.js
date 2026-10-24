export function scoreOrder({ base, combo, patienceRatio, vip, tips, coinMult }) {
  const mult = (1 + .1 * Math.min(combo, 10)) * (patienceRatio > .6 ? 1.25 : 1) * (vip ? 2 : 1);
  const points = Math.round(base * mult / 5) * 5;
  return { points, coins: Math.round(points * (1 + .1 * tips) * coinMult) };
}
