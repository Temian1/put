import { FOODS, STOCK, FOOD_COST } from "./data.js";
import { seeded, hashStr } from "./utils.js";
import { roundNaira } from "./currency.js";
import { LIVE } from "./live.js";

// The market: stock up on ingredients before prices rise. Each cooked batch
// uses one unit of its ingredient from the pantry. With none in the pantry
// you buy on the spot at 40% more (60% more when the market is out of it).
export const INGREDIENTS = {
  rice: { name: "Rice & stew", unit: "bag", icon: "🍚", perish: false },
  beans: { name: "Beans", unit: "basin", icon: "🫘", perish: false },
  swallow: {
    name: "Garri, elubo & yam",
    unit: "bag",
    icon: "🌾",
    perish: false,
  },
  veg: {
    name: "Pepper, tomato & leaves",
    unit: "basket",
    icon: "🌶️",
    perish: true,
  },
  meat: { name: "Meat, fish & eggs", unit: "pack", icon: "🥩", perish: true },
  chicken: { name: "Chicken", unit: "carton", icon: "🍗", perish: true },
  plantain: { name: "Plantain", unit: "bunch", icon: "🍌", perish: true },
  drinks: { name: "Drinks", unit: "crate", icon: "🧃", perish: true },
};
export const FOOD_GROUP = {
  jollof: "rice",
  friedrice: "rice",
  whiterice: "rice",
  beans: "beans",
  moimoi: "beans",
  eba: "swallow",
  amala: "swallow",
  poundedyam: "swallow",
  egusi: "veg",
  efo: "veg",
  ewedu: "veg",
  beef: "meat",
  fish: "meat",
  egg: "meat",
  peppersoup: "meat",
  chicken: "chicken",
  plantain: "plantain",
  water: "drinks",
  zobo: "drinks",
  mineral: "drinks",
  malt: "drinks",
};
const NEWS = [
  "Fuel price hike: transport to the market costs more",
  "Naira falls against the dollar: imported rice is dearer",
  "Flooding on farm roads: tomatoes and pepper are scarce",
  "Festive season rush: everything at the market is moving fast",
  "Harvest season: some farm produce is cheaper today",
];

const batchOf = (f) => (FOODS[f].cook || STOCK[FOODS[f].station]).batch;
// One unit = one batch's worth of ingredients for the average food in the group.
export function basePrice(g) {
  const foods = Object.keys(FOOD_GROUP).filter((f) => FOOD_GROUP[f] === g);
  const avg =
    foods.reduce((s, f) => s + FOODS[f].price * batchOf(f) * FOOD_COST, 0) /
    foods.length;
  return roundNaira(avg, 50);
}

export const freshMarket = () => ({ shift: 0, index: 1, out: [], news: "" });

// Today's price: base x inflation index x a small daily swing per item.
export function price(d, g) {
  const m = d.market || freshMarket();
  const swing = 0.9 + seeded(hashStr(g + ":" + m.shift))() * 0.2;
  return roundNaira(basePrice(g) * m.index * swing, 50);
}

export const isOut = (d, g) => (d.market?.out || []).includes(g);

export function buy(d, g, qty, cap, discount = 1) {
  if (isOut(d, g))
    return { ok: false, why: "Out of stock at the market today" };
  const have = d.pantry[g] || 0,
    n = Math.max(0, Math.min(qty, cap - have));
  if (!n) return { ok: false, why: "Your store is full" };
  const cost = roundNaira(price(d, g) * n * discount, 50);
  if (d.coins < cost) return { ok: false, why: "Not enough money" };
  d.coins -= cost;
  d.pantry[g] = have + n;
  return { ok: true, n, cost };
}

// Called when a batch starts cooking. Returns the naira spent right now
// (0 when the pantry covered it).
export function ingredientsForBatch(d, food, discount = 1) {
  const g = FOOD_GROUP[food];
  if ((d.pantry[g] || 0) > 0) {
    d.pantry[g]--;
    return 0;
  }
  return roundNaira(price(d, g) * (isOut(d, g) ? 1.6 : 1.4) * discount, 10);
}

// After each shift: prices creep up (Nigerian food inflation), some days a
// shock hits, a couple of items sell out, and perishables spoil. The deep
// freezer keeps up to `fridge` perishable units fresh (true = no limit,
// for older callers); the rest lose a quarter.
export function advanceMarket(d, fridge) {
  let room = fridge === true ? Infinity : Math.max(0, Number(fridge) || 0);
  const m = d.market || freshMarket();
  const rng = seeded(hashStr("market" + m.shift));
  m.shift++;
  // Average rise is the admin's inflation setting (0.7% per shift by default).
  let rise = (0.004 + rng() * 0.006) * (LIVE.inflation / 0.007);
  m.news = "";
  const r = rng();
  if (r < 0.12) {
    rise += 0.05 + rng() * 0.07;
    m.news = NEWS[Math.floor(rng() * 4)];
  } else if (r < 0.18) {
    rise -= 0.03;
    m.news = NEWS[4];
  }
  m.index = Math.max(0.8, m.index * (1 + rise));
  const groups = Object.keys(INGREDIENTS);
  m.out = LIVE.outOfStock
    ? LIVE.outOfStock.slice()
    : groups.filter(() => rng() < 0.1).slice(0, 2);
  if (LIVE.news) m.news = LIVE.news;
  d.market = m;
  let spoiled = 0;
  for (const g of groups)
    if (INGREDIENTS[g].perish && d.pantry[g] > 0) {
      const kept = Math.min(d.pantry[g], room);
      room -= kept;
      const lost = Math.ceil((d.pantry[g] - kept) * 0.25);
      d.pantry[g] -= lost;
      spoiled += lost;
    }
  return { spoiled, news: m.news };
}
