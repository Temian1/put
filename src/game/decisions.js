// Decisions that might or might not work. Players invest with partial
// information, live with the result over the next few days, and the
// decision journal later compares what they expected with what happened.
import { EVENTS } from "./data.js";

/* ---- Menu pricing ---- */
// Charging more earns more per plate but brings fewer customers. How much
// customers care depends on where the restaurant is.
export const PRICE_LEVELS = {
  cheap: { label: "Cheap", mult: 0.85, demand: 0.85 },
  normal: { label: "Normal", mult: 1, demand: 1 },
  premium: { label: "Premium", mult: 1.2, demand: 1.18 },
};
// 1 = average; students and drivers (roadside, market) watch prices
// closely; city and first-class diners less so.
export const PRICE_SENSITIVITY = {
  ch0: 1.5,
  ch1: 1.2,
  ch2: 1.4,
  ch3: 0.9,
  ch4: 1,
  ch5: 0.7,
  ch6: 0.9,
  ch7: 1,
  ch8: 0.8,
  ch9: 0.5,
};
export const priceLevelAt = (d, place) =>
  (d.prices && d.prices[place]) || "normal";

// Price factor on every plate, and the gap between arrivals (higher =
// fewer customers), for a restaurant's price level.
export function pricing(d, place) {
  const lv = PRICE_LEVELS[priceLevelAt(d, place)] || PRICE_LEVELS.normal;
  const k = PRICE_SENSITIVITY[place] ?? 1;
  return { mult: lv.mult, gap: 1 + (lv.demand - 1) * k };
}

/* ---- Active effects from decisions ---- */
// Each effect lasts until `until` (a working day) at one restaurant, or
// everywhere when `place` is "*".
export function activeEffects(d, place) {
  const day = d.day || 0;
  const out = {
    gap: 1,
    price: 1,
    online: 1,
    commission: 0,
    cook: 1,
    riderFee: 1,
    noOnline: false,
  };
  for (const e of d.effects || []) {
    if (e.until < day || (e.place !== "*" && e.place !== place)) continue;
    if (e.gap) out.gap *= e.gap;
    if (e.price) out.price *= e.price;
    if (e.online) out.online *= e.online;
    if (e.commission) out.commission = Math.max(out.commission, e.commission);
  }
  return out;
}
const addEffect = (d, e) => {
  d.effects = [...(d.effects || []).filter((x) => x.until >= (d.day || 0)), e];
};

/* ---- Opportunity cards ---- */
// Areas where office workers read flyers; elsewhere word of mouth matters.
const FLYER_AREAS = { ch1: 0.82, ch4: 0.85, ch5: 0.8, ch7: 0.8, ch8: 0.9 };

export const OPPORTUNITIES = [
  {
    id: "bulkrice",
    title: "Bulk rice deal",
    text: (c) =>
      `A supplier offers 8 bags of rice now for ${c.fmt(c.bulkCost)}: 15% under today's price. Rice keeps, but the money is tied up and prices may fall.`,
    cost: (c) => c.bulkCost,
    expect: "Save about 15% on rice",
    needs: (c) =>
      c.foods.some((f) => ["jollof", "friedrice", "whiterice"].includes(f)),
    apply(d, c) {
      d.pantry.rice = (d.pantry.rice || 0) + 8;
      return { unit: Math.round(c.bulkCost / 8) };
    },
    resolve: (d, entry, c) => {
      const saved = Math.round((c.ricePrice - entry.data.unit) * 8);
      return {
        good: saved > 0,
        text:
          saved > 0
            ? `Rice now costs ${c.fmt(c.ricePrice)} a bag: the deal saved you ${c.fmt(saved)}.`
            : `Rice got cheaper (${c.fmt(c.ricePrice)} a bag): buying early cost you ${c.fmt(-saved)}.`,
      };
    },
    days: 5,
  },
  {
    id: "flyers",
    title: "Print flyers",
    text: (c) =>
      `A printer offers 500 flyers for ${c.fmt(15000)}. They might bring more customers for 3 days, depending on who passes your restaurant.`,
    cost: () => 15000,
    expect: "About 20% more customers for 3 days",
    apply(d, c) {
      addEffect(d, {
        id: "flyers",
        place: c.place,
        until: (d.day || 0) + 3,
        gap: FLYER_AREAS[c.place] || 0.96,
      });
      return {};
    },
    resolve: (d, entry) => ({
      good: entry.data.after > entry.data.before * 1.1,
      text:
        `Customers a day went from ${entry.data.before.toFixed(1)} to ${entry.data.after.toFixed(1)}. ` +
        (FLYER_AREAS[entry.place]
          ? "Office workers here read flyers."
          : "Here, word of mouth works better than flyers."),
    }),
    days: 3,
    measure: "served",
  },
  {
    id: "deliveryapp",
    title: "Join a delivery app",
    text: () =>
      "A food delivery app wants to list you for 5 days: about 60% more online orders, but they keep 20% of every delivery.",
    cost: () => 0,
    expect: "More online orders; 20% commission",
    needs: (c) => c.online,
    apply(d, c) {
      addEffect(d, {
        id: "deliveryapp",
        place: c.place,
        until: (d.day || 0) + 5,
        online: 0.62,
        commission: 0.2,
      });
      return {};
    },
    resolve: (d, entry, c) => ({
      good: entry.data.after > entry.data.before,
      text: `Average sales went from ${c.fmt(entry.data.before)} to ${c.fmt(entry.data.after)} a day, after the app's commission.`,
    }),
    days: 5,
    measure: "net",
  },
  {
    id: "pricewar",
    title: "A rival opened across the road",
    text: () =>
      "A new buka is selling 10% cheaper. Match them for 4 days to keep your customers, or keep your prices and hope your food wins.",
    cost: () => 0,
    choices: [
      { id: "match", label: "Match their prices" },
      { id: "hold", label: "Keep my prices" },
    ],
    expect: "Match: keep customers, thinner margin. Hold: fewer customers.",
    apply(d, c, choice) {
      addEffect(
        d,
        choice === "match"
          ? {
              id: "pricewar",
              place: c.place,
              until: (d.day || 0) + 4,
              price: 0.9,
            }
          : {
              id: "pricewar",
              place: c.place,
              until: (d.day || 0) + 4,
              gap: 1 + 0.15 * (PRICE_SENSITIVITY[c.place] ?? 1),
            },
      );
      return {};
    },
    resolve: (d, entry, c) => ({
      good: entry.data.after >= entry.data.before * 0.95,
      text: `Average profit went from ${c.fmt(entry.data.before)} to ${c.fmt(entry.data.after)} a day.`,
    }),
    days: 4,
    measure: "net",
    decline: false,
  },
  {
    id: "generator",
    title: "Buy a generator",
    text: (c) =>
      `A generator for ${c.fmt(60000)} keeps the cooler and lights on during NEPA outages here. Without one, outages cost sales.`,
    cost: () => 60000,
    expect: "No more outage losses at this restaurant",
    needs: (c, d) => !(d.generators || []).includes(c.place),
    apply(d, c) {
      d.generators = [...(d.generators || []), c.place];
      return {};
    },
    resolve: (d, entry) => ({
      good: true,
      text: `The generator has covered ${entry.data.outages || 0} outage${entry.data.outages === 1 ? "" : "s"} so far.`,
    }),
    days: 10,
  },
  {
    id: "loan",
    title: "Microfinance loan",
    text: (c) =>
      `A microfinance bank offers ${c.fmt(150000)} now. In 10 days you repay ${c.fmt(172500)} (15% interest). Good if you can grow with it; dangerous if not.`,
    cost: () => -150000,
    expect: "Grow faster; repay with 15% interest",
    needs: (c, d) => !(d.loans || []).length && c.level >= 8,
    apply(d) {
      d.loans = [
        ...(d.loans || []),
        { due: (d.day || 0) + 10, amount: 172500 },
      ];
      return { coinsBefore: d.coins - 150000 };
    },
    resolve: (d, entry, c) => ({
      good: d.coins > entry.data.coinsBefore,
      text:
        d.coins > entry.data.coinsBefore
          ? `After repaying, you have ${c.fmt(d.coins - entry.data.coinsBefore)} more than before the loan.`
          : "After repaying, you are worse off than before the loan.",
    }),
    days: 10,
  },
];

// One card at most every few days, if one fits the restaurant.
export function drawOpportunity(d, ctx, rand = Math.random) {
  const day = d.day || 0;
  if (day < 2 || day - (d.lastOffer || -99) < 3 || d.offer) return null;
  const fits = OPPORTUNITIES.filter(
    (o) =>
      (!o.needs || o.needs(ctx, d)) &&
      !(d.journal || []).some((j) => j.id === o.id && !j.outcome),
  );
  if (!fits.length) return null;
  const card = fits[Math.floor(rand() * fits.length)];
  d.offer = { id: card.id, place: ctx.place, day };
  d.lastOffer = day;
  return card;
}

export const cardById = (id) => OPPORTUNITIES.find((o) => o.id === id) || null;

// Records the decision with the numbers to judge it by later.
export function decide(d, ctx, choice, baseline) {
  const card = cardById(d.offer?.id);
  d.offer = null;
  if (!card) return null;
  if (choice === "decline") {
    d.journal = [
      ...(d.journal || []),
      {
        id: card.id,
        title: card.title,
        day: d.day || 0,
        place: ctx.place,
        choice,
        outcome: { good: null, text: "You passed on it." },
      },
    ].slice(-30);
    return null;
  }
  const cost = card.cost(ctx);
  d.coins -= cost;
  const data = card.apply(d, ctx, choice) || {};
  const entry = {
    id: card.id,
    title: card.title,
    day: d.day || 0,
    place: ctx.place,
    choice,
    cost,
    expect: card.expect,
    due: (d.day || 0) + card.days,
    data: { ...data, before: baseline?.[card.measure || "net"] ?? 0 },
    outcome: null,
  };
  d.journal = [...(d.journal || []), entry].slice(-30);
  return entry;
}

// Average of a measure over history entries at a place (for baselines).
export function averageAt(
  history = [],
  place,
  key,
  fromDay = -Infinity,
  toDay = Infinity,
) {
  const h = history.filter(
    (e) => e.place === place && e.day >= fromDay && e.day <= toDay,
  );
  return h.length ? h.reduce((t, e) => t + (e[key] || 0), 0) / h.length : 0;
}

// Judges decisions whose time has come. Returns the newly judged entries.
export function resolveDecisions(d, ctx) {
  const done = [];
  for (const e of d.journal || []) {
    if (e.outcome || e.due > (d.day || 0)) continue;
    const card = cardById(e.id);
    if (!card) continue;
    e.data.after = averageAt(
      d.history,
      e.place,
      card.measure || "net",
      e.day + 1,
      e.due,
    );
    e.outcome = card.resolve(d, e, ctx);
    done.push(e);
  }
  return done;
}

// Loans fall due: repaid from cash, or added to debt.
export function payLoans(d) {
  const due = (d.loans || []).filter((l) => l.due <= (d.day || 0));
  d.loans = (d.loans || []).filter((l) => l.due > (d.day || 0));
  let paid = 0;
  for (const l of due) {
    paid += l.amount;
    if (d.coins >= l.amount) d.coins -= l.amount;
    else {
      d.debt = (d.debt || 0) + (l.amount - d.coins);
      d.coins = 0;
    }
  }
  return paid;
}

/* ---- Catering contracts ---- */
// Three offers to choose from: different events, sizes, deadlines and pay.
export function contractOffers(d, foods, rand = Math.random) {
  const ids = Object.keys(EVENTS);
  const pick = () => ids[Math.floor(rand() * ids.length)];
  const kinds = [
    { size: 1, time: 1.3, label: "Relaxed" },
    { size: 2, time: 1, label: "Standard" },
    { size: 3, time: 0.8, label: "Rush job" },
  ];
  return kinds.map((k, i) => {
    const id = pick();
    return {
      key: `${d.day || 0}-${i}`,
      event: id,
      name: EVENTS[id].name,
      icon: EVENTS[id].icon,
      size: k.size,
      time: k.time,
      label: k.label,
      portions: EVENTS[id].size * k.size,
      pay: 1 + 0.25 * (k.size - 1) + (k.time < 1 ? 0.3 : 0),
    };
  });
}

/* ---- Announced disruptions ---- */
// At the start of some shifts something goes wrong; the owner picks how
// to handle it. Each choice has a clear cost.
export const DISRUPTIONS = [
  {
    id: "gas",
    icon: "🔥",
    title: "Gas is running low",
    text: "The cylinder won't last the shift.",
    choices: [
      { id: "refill", label: "Refill now", cost: 6000, effect: {} },
      {
        id: "risk",
        label: "Manage it",
        cost: 0,
        effect: { cook: 0.7 },
        note: "Pots cook 30% slower today",
      },
    ],
  },
  {
    id: "outage",
    icon: "💡",
    title: "NEPA took light",
    text: "No power for the cooler and blender today.",
    needs: (ctx, d) => !(d.generators || []).includes(ctx.place),
    choices: [
      { id: "diesel", label: "Rent a generator", cost: 5000, effect: {} },
      {
        id: "warm",
        label: "Sell warm drinks",
        cost: 0,
        effect: { price: 0.92 },
        note: "Customers pay 8% less today",
      },
    ],
  },
  {
    id: "traffic",
    icon: "🚦",
    title: "Go-slow on the expressway",
    text: "Outside riders want double fare today.",
    needs: (ctx) => ctx.online,
    choices: [
      {
        id: "pay",
        label: "Pay double fares",
        cost: 0,
        effect: { riderFee: 2 },
        note: "Outside riders cost twice as much today",
      },
      {
        id: "pause",
        label: "Pause online orders",
        cost: 0,
        effect: { noOnline: true },
        note: "No online orders today",
      },
    ],
  },
];

// About one shift in four, from level 6 and day 3, a disruption fits.
export function drawDisruption(d, ctx, rand = Math.random) {
  // The first few working days stay calm.
  if (ctx.level < 6 || (d.day || 0) < 3 || rand() > 0.25) return null;
  const fits = DISRUPTIONS.filter((x) => !x.needs || x.needs(ctx, d));
  return fits.length ? fits[Math.floor(rand() * fits.length)] : null;
}
