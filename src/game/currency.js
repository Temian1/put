// All money in the game is Nigerian naira, shown the way a buka would write it.
const grouped = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export const fmtNaira = (n) =>
  (n < 0 ? "-₦" : "₦") + grouped.format(Math.round(Math.abs(n)));

// Short form for tight HUD pills: ₦950, ₦4.8k, ₦125k, ₦1.25m.
export function fmtNairaShort(n) {
  const a = Math.abs(n),
    sign = n < 0 ? "-₦" : "₦";
  if (a < 1000) return sign + Math.round(a);
  if (a < 1e6) return sign + +(a / 1000).toFixed(a < 1e5 ? 1 : 0) + "k";
  return sign + +(a / 1e6).toFixed(a < 1e7 ? 2 : 1) + "m";
}

// Cash at a buka is counted to the nearest ₦50 note.
export const roundNaira = (n, step = 50) => Math.round(n / step) * step;

// Old saves counted fictional coins; 1 coin ≈ ₦25 keeps every unlock affordable.
export const COIN_TO_NAIRA = 25;
