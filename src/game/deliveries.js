import { FOODS, NAMES, AREAS, EVENTS } from "./data.js";
import { buildOrder } from "./recipes.js";
import { roundNaira } from "./currency.js";

// Online and event orders are packed into takeaway packs and sent with a
// dispatch rider. Items: [{ f, need, got }]. Event orders are bulk portions.
export const PACK_COST = 150; // one takeaway pack or cooler liner
export const ON_CALL_FEE = 1000; // calling an outside rider
export const ON_CALL_TRIP = 11; // seconds an outside rider takes
export const DELIVERY_FEE = 800; // charged to the online customer

let seq = 0;
const pickFrom = (list, rand) => list[Math.floor(rand() * list.length)];

export function makeOnlineOrder(foods, rand = Math.random, quantity = 1) {
  const k = 1 + Math.floor(rand() * 3);
  const ids = buildOrder(foods, k, { rand });
  const need = Math.max(1, Math.min(4, Math.floor(quantity) || 1));
  const max = 38 + ids.length * need * 8;
  return {
    id: "o" + ++seq,
    kind: "online",
    who: pickFrom(NAMES, rand),
    where: pickFrom(AREAS, rand),
    items: ids.map((f) => ({ f, need, got: 0 })),
    max,
    t: max,
    packing: 0,
    sent: false,
  };
}

// Splits the event's size across up to three foods it likes that the level sells.
export function makeEventOrder(
  eventId,
  foods,
  rand = Math.random,
  sizeMultiplier = 1,
) {
  const ev = EVENTS[eventId];
  let menu = ev.menu.filter((f) => foods.includes(f));
  if (menu.length < 2)
    menu = foods.filter((f) => FOODS[f].kind !== "soup" && !FOODS[f].swallow);
  menu = menu.slice();
  const picks = [];
  while (picks.length < 3 && menu.length)
    picks.push(menu.splice(Math.floor(rand() * menu.length), 1)[0]);
  const size =
    ev.size * Math.max(1, Math.min(4, Math.floor(sizeMultiplier) || 1));
  const base = Math.floor(size / picks.length);
  const items = picks.map((f, i) => ({
    f,
    need: base + (i < size % picks.length ? 1 : 0),
    got: 0,
  }));
  const max = 60 + size * 4;
  return {
    id: "e" + ++seq,
    kind: "event",
    event: eventId,
    who: pickFrom(NAMES, rand),
    where: pickFrom(AREAS, rand),
    items,
    max,
    t: max,
    packing: 0,
    sent: false,
  };
}

export const packNeeds = (o, f) =>
  !o.sent && !o.packing && o.items.some((it) => it.f === f && it.got < it.need);

export function packFill(o, f) {
  const it = o.items.find((x) => x.f === f && x.got < x.need);
  if (!it || o.sent || o.packing) return false;
  it.got++;
  return true;
}

export const packComplete = (o) => o.items.every((it) => it.got >= it.need);
export const portions = (o) => o.items.reduce((s, it) => s + it.need, 0);
// Packs needed: one per online order, one cooler per four event portions.
export const packsFor = (o) =>
  o.kind === "event"
    ? Math.ceil(portions(o) / 4)
    : Math.max(1, ...o.items.map((it) => it.need));

// Event catering pays a 40% premium on menu price. Online adds the delivery fee.
export function orderValue(o) {
  const food = o.items.reduce((s, it) => s + FOODS[it.f].price * it.need, 0);
  return o.kind === "event"
    ? roundNaira(food * 1.4)
    : roundNaira(food + DELIVERY_FEE);
}

// Counts deadlines down for unsent orders and returns the ones that expired.
export function tickOrders(list, dt) {
  const expired = [];
  for (const o of list) {
    if (o.sent) continue;
    o.t -= dt;
    if (o.t <= 0) expired.push(o);
  }
  return expired;
}

// Rider pool: hired riders are free to use; when all are out an outside
// rider is called for a fee. Each rider is away for their trip time.
export function createRiders(specs) {
  return specs.map((s) => ({ id: s.id, name: s.name, trip: s.trip, away: 0 }));
}
export function dispatch(riders) {
  const r = riders.find((x) => x.away <= 0);
  if (r) {
    r.away = r.trip;
    return { rider: r, fee: 0, trip: r.trip };
  }
  return { rider: null, fee: ON_CALL_FEE, trip: ON_CALL_TRIP };
}
export function tickRiders(riders, dt) {
  riders.forEach((r) => (r.away = Math.max(0, r.away - dt)));
}
