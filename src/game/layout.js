// Rearranging the dining room: hold a table to pick it up, drag it, and let
// go. Each restaurant keeps its own layout. A table may not block the
// counter queue, the walkway or another table.
export const DINING_BOUNDS = { x: 4.25, zMin: -2.0, zMax: -0.15 };
// Where customers stand at the counter (one, two or three lanes).
export const QUEUE_X = [-2.05, 0, 2.05];

export const tablesAt = (d, place) =>
  (d.layout && d.layout[place] && d.layout[place].tables) || [];

/**
 * Whether a table can stand at (x, z); `others` are the other tables'
 * [x, z] positions. Chairs stick out sideways, so tables need more room
 * left and right than front and back.
 */
export function canPlace(x, z, others = []) {
  const b = DINING_BOUNDS;
  if (Math.abs(x) > b.x || z < b.zMin || z > b.zMax) return false;
  if (QUEUE_X.some((q) => Math.abs(x - q) < 0.85 && z > -1.45)) return false;
  return !others.some(
    ([ox, oz]) => Math.abs(x - ox) < 1.55 && Math.abs(z - oz) < 0.85,
  );
}

export const snap = (v) => Math.round(v * 20) / 20;

// Saves every table's position for a restaurant.
export function saveLayout(d, place, positions) {
  d.layout = { ...(d.layout || {}) };
  d.layout[place] = { tables: positions.map(([x, z]) => [snap(x), snap(z)]) };
  return d.layout[place];
}
