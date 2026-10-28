/* Rewards and save data shared by the two side games, Market Match and
   Okada Rush. Everything they earn flows back into the restaurant. */

// Recipes won in Market Match. Each becomes an owner special the guests
// can ask for in the restaurant, worth more than the everyday specials.
export const RECIPES = [
  {
    id: "coconutrice",
    name: "Coconut rice special",
    food: "jollof",
    mult: 2.8,
    icon: "🥥",
    level: 3,
  },
  {
    id: "gizdodo",
    name: "Gizdodo special",
    food: "plantain",
    mult: 2.8,
    icon: "🍌",
    level: 6,
  },
  {
    id: "nkwobi",
    name: "Nkwobi special",
    food: "beef",
    mult: 3,
    icon: "🥘",
    level: 9,
  },
  {
    id: "banga",
    name: "Banga soup special",
    food: "fish",
    mult: 3,
    icon: "🍲",
    level: 12,
  },
  {
    id: "ofensala",
    name: "Ofe nsala special",
    food: "poundedyam",
    mult: 3.1,
    icon: "🥣",
    level: 15,
  },
  {
    id: "chapman",
    name: "Chapman special",
    food: "zobo",
    mult: 2.6,
    icon: "🍹",
    level: 18,
  },
];

// Market Match tools, bought with naira or won.
export const TOOLS = {
  spoon: {
    name: "Wooden spoon",
    icon: "🥄",
    price: 1500,
    desc: "Smash any one tile",
  },
  stir: {
    name: "Stir the pot",
    icon: "🌀",
    price: 1000,
    desc: "Mix up the whole board",
  },
  moves: {
    name: "+5 moves",
    icon: "⏱️",
    price: 2000,
    desc: "Five extra moves",
  },
  hot: {
    name: "Hot start",
    icon: "🌶️",
    price: 1800,
    desc: "Start with two pepper blasts",
  },
};

// Okada Rush gear: kept between runs.
export const GEAR = {
  helmet: {
    name: "Spare helmet",
    icon: "⛑️",
    price: 1500,
    desc: "Start a run with one free crash",
  },
  box: {
    name: "Insulated box",
    icon: "📦",
    price: 25000,
    desc: "Food cools 40% slower, for good",
    once: true,
  },
};

// Rewarded wins a day. After that, play on for fun and stars.
export const DAILY_PAID = { match: 6, run: 6 };

export function sideSave(d) {
  d.side = Object.assign(
    {
      match: {
        level: 1,
        stars: {},
        tools: { spoon: 1, stir: 1, moves: 0, hot: 0 },
      },
      run: {
        best: 0,
        bestDelivered: 0,
        runs: 0,
        gear: { helmet: 1, box: false },
      },
      recipes: [],
      paid: { day: "", match: 0, run: 0 },
      log: [],
    },
    d.side || {},
  );
  return d.side;
}

// Can this side game still pay out today?
export function canPay(d, game, day) {
  const s = sideSave(d);
  if (s.paid.day !== day) s.paid = { day, match: 0, run: 0 };
  return s.paid[game] < DAILY_PAID[game];
}
function countPaid(d, game, day) {
  const s = sideSave(d);
  if (s.paid.day !== day) s.paid = { day, match: 0, run: 0 };
  s.paid[game]++;
}

// What a Market Match level gives on its first clear. Replays pay a small
// amount, capped each day.
export function matchReward(n, first) {
  const out = { cash: 0, pantry: {}, boosters: {}, tools: {}, recipe: null };
  if (!first) {
    out.cash = 300 + n * 40;
    return out;
  }
  out.cash = 600 + n * 120;
  const goods = ["rice", "plantain", "meat", "beans", "chicken", "drinks"];
  out.pantry[goods[n % goods.length]] = 1 + Math.floor(n / 6);
  const recipe = RECIPES.find((r) => r.level === n);
  if (recipe) out.recipe = recipe.id;
  if (n % 3 === 2)
    out.boosters[["freeze", "auto", "calm"][Math.floor(n / 3) % 3]] = 1;
  if (n % 4 === 0) out.tools[n % 8 ? "spoon" : "hot"] = 1;
  if (n % 5 === 0) out.tools.moves = 1;
  return out;
}

// Applies a Market Match win to the save; returns what was given.
export function claimMatch(d, n, stars, day) {
  const s = sideSave(d);
  const first = !s.match.stars[n];
  s.match.stars[n] = Math.max(s.match.stars[n] || 0, stars);
  if (n >= s.match.level) s.match.level = n + 1;
  const paid = first || canPay(d, "match", day);
  const r = matchReward(n, first);
  if (!paid) r.cash = 0;
  if (!first && paid) countPaid(d, "match", day);
  d.coins += r.cash;
  d.pantry = d.pantry || {};
  for (const [g, q] of Object.entries(r.pantry))
    d.pantry[g] = (d.pantry[g] || 0) + q;
  d.boosters = d.boosters || {};
  for (const [b, q] of Object.entries(r.boosters))
    d.boosters[b] = (d.boosters[b] || 0) + q;
  for (const [t, q] of Object.entries(r.tools))
    s.match.tools[t] = (s.match.tools[t] || 0) + q;
  if (r.recipe && !s.recipes.includes(r.recipe)) s.recipes.push(r.recipe);
  else r.recipe = null;
  if (r.cash) logSide(d, day, "match", `Market Match level ${n}`, r.cash);
  return { ...r, first };
}

// Applies an Okada Rush run to the save.
export function claimRun(d, run, money, day) {
  const s = sideSave(d);
  s.run.runs++;
  const best = run.tier.endless ? run.delivered : 0;
  const record = run.tier.endless && best > s.run.best;
  if (record) s.run.best = best;
  s.run.bestDelivered = Math.max(s.run.bestDelivered, run.delivered);
  const paid = canPay(d, "run", day);
  const net = paid ? money.net : 0;
  if (paid && money.gross > 0) countPaid(d, "run", day);
  d.coins += net;
  if (net)
    logSide(
      d,
      day,
      "run",
      `Okada Rush · ${run.delivered} delivered`,
      net,
      money.fuel,
    );
  return { paid, net, record };
}

// A short ledger of side earnings, shown in the Business Books.
function logSide(d, day, game, label, amount, cost = 0) {
  const s = sideSave(d);
  s.log.push({ day: d.day || 0, date: day, game, label, amount, cost });
  if (s.log.length > 30) s.log.splice(0, s.log.length - 30);
}

export function buyItem(d, kind, id) {
  const s = sideSave(d);
  const item = (kind === "tool" ? TOOLS : GEAR)[id];
  if (!item || d.coins < item.price) return false;
  if (kind === "gear" && item.once && s.run.gear[id]) return false;
  d.coins -= item.price;
  if (kind === "tool") s.match.tools[id] = (s.match.tools[id] || 0) + 1;
  else if (item.once) s.run.gear[id] = true;
  else s.run.gear[id] = (s.run.gear[id] || 0) + 1;
  return true;
}

// Recipe specials the restaurant can now serve.
export const unlockedRecipes = (d) =>
  RECIPES.filter((r) => (d.side?.recipes || []).includes(r.id));
