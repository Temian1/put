// All money in the game is Nigerian naira, shown the way a buka would write it.
const grouped = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export const fmtNaira = (n) =>
  (n < 0 ? "-₦" : "₦") + grouped.format(Math.round(Math.abs(n)));

// Short form for tight HUD pills: ₦950, ₦4.8k, ₦125k, ₦1.25m.
// Short amounts for tight spaces: ₦950, ₦4.8k, ₦125k, ₦3.4m, ₦1.25b, ₦2t.
const UNITS = [
  [1e12, "t"],
  [1e9, "b"],
  [1e6, "m"],
  [1e3, "k"],
];
export function fmtNairaShort(n) {
  const a = Math.abs(n),
    sign = n < 0 ? "-₦" : "₦";
  if (a < 1000) return sign + Math.round(a);
  for (const [size, unit] of UNITS)
    if (a >= size) {
      const v = a / size;
      // Two decimals under 10, one under 100, whole numbers above.
      return (
        sign +
        +v.toFixed(v < 10 ? (unit === "k" ? 1 : 2) : v < 100 ? 1 : 0) +
        unit
      );
    }
  return sign + Math.round(a);
}

// Cash at a buka is counted to the nearest ₦50 note.
export const roundNaira = (n, step = 50) => Math.round(n / step) * step;

// Old saves counted fictional coins; 1 coin ≈ ₦25 keeps every unlock affordable.
export const COIN_TO_NAIRA = 25;
