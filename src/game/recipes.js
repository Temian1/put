import { FOODS } from "./data.js";

const kindOf = (f) => FOODS[f].kind;
const take = (pool, rand) =>
  pool.splice(Math.floor(rand() * pool.length), 1)[0];

// Builds a believable buka plate of about k items from the level's menu:
// at most one main, a soup with every swallow, then proteins, sides and drinks.
// Customers' favourite foods are tried first when `likes` is given.
export function buildOrder(foods, k, { rand = Math.random, likes } = {}) {
  const pref = (list) => {
    if (!likes) return list;
    const liked = list.filter((f) => likes.includes(f));
    return liked.length && rand() < 0.7 ? liked : list;
  };
  const mains = foods.filter((f) => kindOf(f) === "main");
  const soups = foods.filter((f) => kindOf(f) === "soup");
  const extras = foods.filter((f) =>
    ["protein", "side", "drink"].includes(kindOf(f)),
  );
  const order = [];
  // A single-item order is never a lone soup or a swallow without soup.
  if (k <= 1) {
    const solo = foods.filter(
      (f) => kindOf(f) !== "soup" && !(FOODS[f].swallow && soups.length),
    );
    return [take(pref(solo.slice()), rand)];
  }
  if (mains.length) {
    const choice = pref(mains.slice());
    order.push(take(choice, rand));
    if (FOODS[order[0]].swallow && soups.length)
      order.push(take(pref(soups.slice()), rand));
  }
  const pool = extras.slice();
  while (order.length < k && pool.length) {
    const options = pref(pool.filter((f) => !order.includes(f)));
    const f = take(options, rand);
    pool.splice(pool.indexOf(f), 1);
    order.push(f);
  }
  return order;
}

// Converts food ids into order items. Without assembly every item is free-form.
export function toItems(ids, assembly) {
  return ids.map((f) => {
    const kind = kindOf(f);
    return {
      f,
      done: false,
      layer: assembly ? (kind === "main" || kind === "drink" ? 0 : 1) : null,
      drink: kind === "drink",
    };
  });
}

// Short plate name for the order bubble, e.g. "Eba + Egusi + Beef".
export const plateName = (ids) =>
  ids
    .filter((f) => kindOf(f) !== "drink")
    .map((f) => FOODS[f].short)
    .join(" + ");
