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
  const points = Math.round((base * mult) / 5) * 5;
  return { points, coins: Math.round(points * (1 + 0.1 * tips) * coinMult) };
}
