export const needsFood = (state, order, food) => state === 'wait' && order.some(item => item.f === food && !item.done);
export function fillOrder(order, food) {
  const index = order.findIndex(item => item.f === food && !item.done);
  if (index < 0) return { index: -1, slot: -1 };
  order[index].done = true;
  return { index, slot: order.filter(item => item.done).length - 1 };
}
export const orderComplete = order => order.every(item => item.done);
