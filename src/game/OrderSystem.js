// An order item is { f, done, layer }. Layer 1 items (soup, protein, side) sit
// on the plate, so they can only be served once every layer 0 main is dished.
// Drinks and mains are layer 0. Orders without layers behave as before.
export const baseReady = (order) =>
  order.every((item) => item.layer !== 0 || item.drink || item.done);

export function canFill(order, food) {
  const item = order.find((it) => it.f === food && !it.done);
  if (!item) return false;
  return item.layer !== 1 || baseReady(order);
}

export const needsFood = (state, order, food) =>
  state === "wait" && canFill(order, food);

// True when the customer wants this food but the plate is not ready for it yet.
export const blockedFood = (state, order, food) =>
  state === "wait" &&
  order.some((it) => it.f === food && !it.done) &&
  !canFill(order, food);

export function fillOrder(order, food) {
  const index = order.findIndex(
    (item) =>
      item.f === food && !item.done && (item.layer !== 1 || baseReady(order)),
  );
  if (index < 0) return { index: -1, slot: -1 };
  order[index].done = true;
  return { index, slot: order.filter((item) => item.done).length - 1 };
}
export const orderComplete = (order) => order.every((item) => item.done);
export const nextNeeded = (order) =>
  order.filter((it) => !it.done && (it.layer !== 1 || baseReady(order)));
