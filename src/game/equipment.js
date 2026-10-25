// Buka equipment bought with naira. Every item shows up in the 3D buka and
// most carry upkeep (gas, light, repairs) charged after each shift.
export const EQUIPMENT = [
  {
    id: "tables",
    name: "Plastic table & chairs",
    desc: "Seats 2 more customers. Seated customers free the counter sooner",
    icon: "🪑",
    costs: [15000, 35000, 70000, 140000, 280000],
    upkeep: 150,
  },
  {
    id: "fridge",
    name: "Deep freezer",
    desc: "Meat, fish, plantain and drinks stop spoiling. +5 hygiene",
    icon: "🧊",
    costs: [85000],
    upkeep: 500,
  },
  {
    id: "burner",
    name: "Extra gas burner",
    desc: "Pots and pans cook 25% faster per burner",
    icon: "🔥",
    costs: [35000, 90000],
    upkeep: 300,
  },
  {
    id: "bigpots",
    name: "Bigger pots",
    desc: "+3 plates in every pot and pan batch per level",
    icon: "🍲",
    costs: [30000, 80000],
    upkeep: 0,
  },
  {
    id: "sink",
    name: "Double sink",
    desc: "The sink holds 3 more plates and washes faster",
    icon: "🚰",
    costs: [25000],
    upkeep: 100,
  },
  {
    id: "handwash",
    name: "Handwash station & bin",
    desc: "+12 hygiene. Health inspectors check for it",
    icon: "🧼",
    costs: [12000],
    upkeep: 50,
  },
  {
    id: "uniforms",
    name: "Staff uniforms & caps",
    desc: "+8 hygiene, and your staff look the part",
    icon: "👕",
    costs: [20000],
    upkeep: 0,
  },
  {
    id: "store",
    name: "Store room shelves",
    desc: "Keep 10 more of every market item per level",
    icon: "📦",
    costs: [45000, 120000],
    upkeep: 0,
  },
  {
    id: "sign",
    name: "Lit signboard",
    desc: "Customers come 8% more often",
    icon: "💡",
    costs: [60000],
    upkeep: 200,
  },
  {
    id: "building",
    name: "Renovate the building",
    desc: "Tiles and paint, then standing fans, then air-conditioning. +6 hygiene, less litter and more patient customers per level",
    icon: "🏗️",
    costs: [60000, 180000, 450000],
    upkeep: 400,
  },
  {
    id: "bike",
    name: "Delivery okada",
    desc: "Each okada lets one hired rider deliver with no outside fee",
    icon: "🏍️",
    costs: [450000, 600000, 750000],
    upkeep: 800,
  },
  {
    id: "bus",
    name: "Catering bus",
    desc: "Delivers event orders free. Without it you hire a bus for ₦8,000",
    icon: "🚐",
    costs: [2500000],
    upkeep: 2500,
  },
];
export const BUS_HIRE = 8000;

// Each restaurant has its own equipment. `place` defaults to the restaurant
// you are at (d.place). Saves from before restaurants had their own kit
// keep it in d.equip until they are migrated.
export const placeOf = (d) => d.place || "ch0";
export const equipAt = (d, place = placeOf(d)) =>
  d.equipBy ? d.equipBy[place] || {} : d.equip || {};
export const level = (d, id, place) => equipAt(d, place)[id] || 0;
export const maxLevel = (item) => item.costs.length;
export const nextCost = (d, item, place) =>
  item.costs[level(d, item.id, place)];
// All equipment levels at a restaurant, for the manager's earnings.
export const equipTotal = (d, place) =>
  Object.values(equipAt(d, place)).reduce((s, n) => s + n, 0);

// What the equipment does, as plain numbers the game reads.
export function effects(d, place) {
  const L = (id) => level(d, id, place);
  return {
    tables: 1 + L("tables"),
    seats: 2 * (1 + L("tables")),
    fridge: L("fridge") > 0,
    cookSpeed: 1 + 0.25 * L("burner"),
    batchBonus: 3 * L("bigpots"),
    sinkCap: 4 + 3 * L("sink"),
    washTime: L("sink") ? 0.35 : 0.5,
    hygiene:
      12 * L("handwash") +
      8 * L("uniforms") +
      5 * L("fridge") +
      6 * L("building"),
    building: L("building"),
    // Less rubbish dropped, and customers wait longer in a nicer place.
    litterRate: 1 - 0.2 * L("building"),
    comfort: 1 + 0.04 * L("building"),
    pantryCap: 10 + 10 * L("store"),
    spawn: L("sign") ? 0.92 : 1,
    bikes: L("bike"),
    bus: L("bus") > 0,
    uniforms: L("uniforms") > 0,
  };
}

export const upkeep = (d, place) =>
  EQUIPMENT.reduce((s, it) => s + it.upkeep * level(d, it.id, place), 0);

export function buyEquipment(d, item, place = placeOf(d)) {
  const cost = nextCost(d, item, place);
  if (cost === undefined || d.coins < cost) return false;
  d.coins -= cost;
  if (!d.equipBy) migrateEquip(d);
  d.equipBy[place] = {
    ...equipAt(d, place),
    [item.id]: level(d, item.id, place) + 1,
  };
  return true;
}

// Equipment used to be shared by every restaurant: each one you own keeps
// a copy of what you had, so nobody loses anything they paid for.
export function migrateEquip(out) {
  const old = out.equip && typeof out.equip === "object" ? out.equip : {};
  out.equipBy = {};
  for (const b of out.branches || ["ch0"]) out.equipBy[b] = { ...old };
  return out;
}
