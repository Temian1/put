import { roundNaira } from "./currency.js";
import { LIVE } from "./live.js";

// Running costs that grow with the business. Values are per shift.
// Small bukas pay a local government levy; registered businesses (Popular
// Joint and up) also charge 7.5% VAT on sales, Nigeria's VAT rate.
export const LEVY = [300, 800, 2000, 5000, 10000];
export const RENT = [1000, 2500, 6000, 15000, 35000];
export const VAT_RATE = 0.075;
export const VAT_FROM_TIER = 2;

// Rates come from the admin's live settings (default 7.5% VAT, normal levy).
export function taxes(tier, sales) {
  const vat = tier >= VAT_FROM_TIER ? roundNaira(sales * LIVE.vatRate, 10) : 0;
  return { levy: roundNaira(LEVY[tier] * LIVE.levy, 10), vat };
}

// Hygiene 0–100. Equipment and a cleaner help; dirty plates, a full sink and
// customers left waiting on finished food hurt.
export function hygieneScore({
  equipment,
  cleaner,
  dirty,
  sinkFull,
  starving,
}) {
  return Math.max(
    0,
    Math.min(
      100,
      62 +
        equipment +
        (cleaner ? 10 : 0) -
        dirty * 7 -
        (sinkFull ? 10 : 0) -
        starving * 3,
    ),
  );
}

// Health inspection outcome (Lagos environmental health officers).
export function inspect(score, tier) {
  if (score >= 75) return { result: "pass", fine: 0, rep: 2 };
  if (score >= 55) return { result: "warning", fine: 0, rep: -1 };
  if (score >= 35) return { result: "fine", fine: 5000 * (tier + 1), rep: -4 };
  return { result: "sealed", fine: 12000 * (tier + 1), rep: -8 };
}

// Haggling: some customers argue the bill down.
export function makeOffer(base, rand = Math.random) {
  return roundNaira(base * (0.65 + rand() * 0.2), 50);
}
// choice: "accept" their price, "meet" halfway, or "refuse" (full price).
export function haggle(choice, full, offer, rand = Math.random) {
  if (choice === "accept")
    return { price: offer, rep: 0.5, leaves: false, line: "deal" };
  if (choice === "meet") {
    const mid = roundNaira((full + offer) / 2, 50);
    return rand() < 0.65
      ? { price: mid, rep: 0.3, leaves: false, line: "deal" }
      : { price: offer, rep: 0, leaves: false, line: "insist" };
  }
  return rand() < 0.55
    ? { price: full, rep: -0.5, leaves: false, line: "grumble" }
    : { price: 0, rep: -1.5, leaves: true, line: "walk" };
}

// A buka that stays shut loses its regulars: reputation falls for each
// missed day after the first, up to 15 points.
export function absenceDecay(lastPlayed, todayKey) {
  if (!lastPlayed || lastPlayed === todayKey) return { days: 0, rep: 0 };
  const days = Math.round(
    (Date.parse(todayKey) - Date.parse(lastPlayed)) / 86400000,
  );
  if (!(days > 1)) return { days: Math.max(0, days || 0), rep: 0 };
  return { days, rep: -Math.min(15, 1.5 * (days - 1)) };
}

// Bills that cannot be paid become debt. Debt is paid first from later
// shifts, and every shift in debt costs reputation.
export function settleDebt(d, cash) {
  let left = cash;
  if (d.debt > 0) {
    const pay = Math.min(Math.max(0, left), d.debt);
    d.debt -= pay;
    left -= pay;
  }
  if (left < 0) {
    d.debt = (d.debt || 0) - left;
    left = 0;
  }
  return left;
}
