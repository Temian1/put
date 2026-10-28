// The owner's job once staff do the routine work: run the service in waves,
// tell the crew what matters most, and finish the premium plates yourself.

/* ---- Service waves ---- */
// A big customer target is served in waves of about this many customers,
// with a short planning break in between. The total target is unchanged.
export const WAVE_SIZE = 25;

export const waveCount = (goal) =>
  Number.isFinite(goal) && goal > 0
    ? Math.max(1, Math.ceil(goal / WAVE_SIZE))
    : 1;

// Which wave the shift is in, given customers served so far.
export function waveOf(served, goal) {
  const count = waveCount(goal);
  if (count === 1) return { index: 0, count, start: 0, end: goal };
  const size = Math.ceil(goal / count);
  const index = Math.min(count - 1, Math.floor(served / size));
  return {
    index,
    count,
    start: index * size,
    end: Math.min(goal, (index + 1) * size),
  };
}

// True when `served` has just finished a wave that is not the last one.
export function waveDone(prevServed, served, goal) {
  const count = waveCount(goal);
  if (count === 1 || served >= goal) return false;
  const size = Math.ceil(goal / count);
  return Math.floor(served / size) > Math.floor(prevServed / size);
}

/* ---- Crew priorities ---- */
export const PRIORITIES = {
  counter: {
    label: "Counter first",
    desc: "Servers feed waiting customers before packing deliveries",
  },
  delivery: {
    label: "Deliveries first",
    desc: "Servers pack online orders before the counter",
  },
  restock: {
    label: "Restock first",
    desc: "Cooks keep every pot and pan full, even before anyone orders",
  },
};
export const DEFAULT_PRIORITY = "counter";

// The order a server looks at its jobs in.
export const serverOrder = (priority) =>
  priority === "delivery" ? ["pack", "counter"] : ["counter", "pack"];

// Whether cooks may start a batch nobody has ordered yet.
export const cookAhead = (priority) => priority === "restock";

/* ---- Owner specials ---- */
// A premium plate the owner finishes: a marker sweeps along a bar and the
// owner taps to plate. The closer to the centre, the better the plate.
export const SPECIAL_DISHES = [
  {
    id: "partyjollof",
    name: "Party Jollof special",
    food: "jollof",
    mult: 2.4,
  },
  { id: "asun", name: "Peppered goat special", food: "beef", mult: 2.6 },
  {
    id: "ofada",
    name: "Ofada & ayamase special",
    food: "whiterice",
    mult: 2.4,
  },
  { id: "fisherman", name: "Fisherman soup special", food: "fish", mult: 2.8 },
  {
    id: "pounded",
    name: "Pounded yam & egusi special",
    food: "poundedyam",
    mult: 2.5,
  },
  { id: "suya", name: "Chicken suya special", food: "chicken", mult: 2.4 },
];

// Specials the current menu can make.
export const specialsFor = (foods) =>
  SPECIAL_DISHES.filter((s) => foods.includes(s.food));

// `pos` is the marker position from 0 to 1 when the owner tapped.
export function plateQuality(pos) {
  const off = Math.abs(pos - 0.5);
  if (off <= 0.06) return { grade: "Perfect", bonus: 1, rep: 2 };
  if (off <= 0.16) return { grade: "Great", bonus: 0.7, rep: 1 };
  if (off <= 0.3) return { grade: "Good", bonus: 0.4, rep: 0 };
  return { grade: "Messy", bonus: 0.1, rep: -1 };
}

// Price of a finished special: the dish's price times its premium, scaled
// by how well it was plated.
export const specialPrice = (basePrice, dish, quality) =>
  Math.round((basePrice * (1 + (dish.mult - 1) * quality.bonus)) / 50) * 50;

// Marker position over time: a smooth back-and-forth sweep.
export const markerAt = (t, speed = 1) =>
  0.5 - 0.5 * Math.cos(t * speed * Math.PI);
