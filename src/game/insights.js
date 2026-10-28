// Teaching through the numbers: after every shift, Mama Nkechi (a mentor
// who has run bukas for thirty years) explains the two or three things
// that mattered most, in plain words, with one tip each. She speaks after
// the fact, never before, so players still make their own choices.
export const MENTOR = "Mama Nkechi";

// Healthy targets used in the advice (common food-service rules of thumb).
export const TARGETS = { foodCost: 0.35, staffCost: 0.3, fixedCost: 0.35 };

const pct = (v) => Math.round(v * 100) + "%";

/**
 * `s` is one shift's numbers: sales, foodCost (bought on the spot),
 * storeUsed (value of ingredients taken from the store), emergencyExtra
 * (premium paid for buying on the spot), packCost, riderFees, rent,
 * upkeep, taxes, fines, settlements, wages (earned today), served, lost,
 * spoiled, complaints, net, debt, owed, payday (days left).
 * Returns up to `max` insights, most important first.
 */
export function shiftInsights(s, fmt = (n) => "₦" + Math.round(n), max = 3) {
  const out = [];
  const add = (tone, weight, title, tip) =>
    out.push({ tone, weight, title, tip });
  const sales = Math.max(0, s.sales || 0);
  const food = (s.foodCost || 0) + (s.storeUsed || 0);
  const foodPct = sales ? food / sales : 0;
  const staffPct = sales ? (s.wages || 0) / sales : 0;
  const fixed = (s.rent || 0) + (s.upkeep || 0) + (s.taxes || 0);
  const fixedPct = sales ? fixed / sales : 0;

  if (s.debt > 0)
    add(
      "bad",
      100,
      `You are in debt: ${fmt(s.debt)}`,
      "Debt costs you reputation every shift. Cut costs you don't need and pay it off before buying new things.",
    );
  if (s.lost >= 3)
    add(
      "bad",
      60 + s.lost * 4,
      `${s.lost} customers left hungry`,
      "Each one is lost sales and reputation. Cook before the rush, keep food in stock, or hire a server.",
    );
  if (sales && foodPct > 0.45)
    add(
      "bad",
      55 + (foodPct - 0.45) * 100,
      `Food cost was ${pct(foodPct)} of sales`,
      `Aim for under ${pct(TARGETS.foodCost)}. Buy at the market when prices are low and don't cook more pots than you can sell.`,
    );
  if (s.emergencyExtra > 0)
    add(
      "bad",
      40 + Math.min(30, s.emergencyExtra / 500),
      `${fmt(s.emergencyExtra)} extra paid buying ingredients on the spot`,
      "Your store was empty, so you paid 40% more. Stock up at the market before you open.",
    );
  if (s.spoiled > 0)
    add(
      "bad",
      35 + s.spoiled * 2,
      `${s.spoiled} units of food spoiled`,
      "Perishables go bad overnight. Buy them closer to when you need them, or get freezer space.",
    );
  if (sales && staffPct > TARGETS.staffCost + 0.1)
    add(
      "bad",
      45 + (staffPct - 0.4) * 80,
      `Wages were ${pct(staffPct)} of today's sales`,
      "Too many workers for the customers you had. Put some off duty on quiet days, or sell more.",
    );
  if (sales && fixedPct > 0.5)
    add(
      "bad",
      40,
      `Rent, upkeep and taxes took ${pct(fixedPct)} of sales`,
      "Fixed bills come whatever you sell. Busy shifts spread them over more plates; avoid equipment you don't use.",
    );
  if ((s.fines || 0) + (s.settlements || 0) > 0)
    add(
      "bad",
      38,
      `Inspector cost you ${fmt((s.fines || 0) + (s.settlements || 0))}`,
      "Keep plates washed and the floor swept. A handwash station and a cleaner pay for themselves.",
    );
  if (s.complaints >= 2)
    add(
      "bad",
      30 + s.complaints * 3,
      `${s.complaints} customers complained about dirt`,
      "A dirty floor drives people away. Sweep litter quickly or hire a cleaner.",
    );
  if (s.owed > 0 && s.payday <= 2)
    add(
      "bad",
      50,
      `Payday in ${s.payday} day${s.payday === 1 ? "" : "s"}: ${fmt(s.owed)} owed`,
      "Keep that money aside. Unpaid workers slow down, and after two months they quit.",
    );

  if (s.net > 0 && sales) {
    const margin = s.net / sales;
    add(
      "good",
      margin >= 0.2 ? 30 : 10,
      `Profit ${fmt(s.net)}, a ${pct(margin)} margin`,
      margin >= 0.2
        ? "Healthy. Put some aside for bad days before you spend it."
        : "You made money, but only a little. Look at your biggest cost above.",
    );
  } else if (sales)
    add(
      "bad",
      70,
      `You lost ${fmt(-s.net)} on this shift`,
      "Busy is not the same as profitable. Check what took the most money.",
    );
  if (sales && foodPct > 0 && foodPct <= 0.3)
    add(
      "good",
      12,
      `Food cost only ${pct(foodPct)} of sales`,
      "Well bought. Buying in the market ahead keeps plates cheap.",
    );
  if (!s.lost && s.served >= 5)
    add(
      "good",
      14,
      "Nobody left hungry",
      "Fast service keeps your reputation climbing.",
    );

  // Problems first; at most one piece of praise.
  const bad = out
    .filter((i) => i.tone === "bad")
    .sort((a, b) => b.weight - a.weight);
  const good = out
    .filter((i) => i.tone === "good")
    .sort((a, b) => b.weight - a.weight);
  return [
    ...bad.slice(0, max - (good.length ? 1 : 0)),
    ...good.slice(0, 1),
  ].slice(0, max);
}

/**
 * One line of the business books. `history` keeps the last DAYS entries.
 */
export const BOOK_DAYS = 60;
export function recordDay(d, entry) {
  d.history = [...(Array.isArray(d.history) ? d.history : []), entry].slice(
    -BOOK_DAYS,
  );
  return d.history;
}

// Averages over the last `n` days in the books.
export function bookSummary(history = [], n = 7) {
  const h = history.slice(-n);
  if (!h.length) return null;
  const sum = (k) => h.reduce((t, e) => t + (e[k] || 0), 0);
  const sales = sum("sales");
  return {
    days: h.length,
    sales: sum("sales") / h.length,
    net: sum("net") / h.length,
    foodPct: sales ? sum("food") / sales : 0,
    staffPct: sales ? sum("wages") / sales : 0,
    lost: sum("lost") / h.length,
    best: h.reduce((b, e) => (e.net > b.net ? e : b), h[0]),
    worst: h.reduce((b, e) => (e.net < b.net ? e : b), h[0]),
  };
}

// Ingredient cost and margin for one plate of each dish.
export function plateCosts(foods, priceOf, unitCost, batchOf) {
  return foods.map((f) => {
    const price = priceOf(f),
      cost = Math.round(unitCost(f) / Math.max(1, batchOf(f)));
    return {
      id: f,
      price,
      cost,
      margin: price - cost,
      pct: price ? cost / price : 0,
    };
  });
}
