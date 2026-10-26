import { UPGRADES, OUTFITS, DECOR, BOOSTERS } from "./data.js";
import { EQUIPMENT, equipAt, placeOf, migrateEquip } from "./equipment.js";

// Items bought with Lagos Life money arrive from the server as grants. Each
// one is applied to the save once: its purchase id is remembered so a
// repeat (a retry, another device, a webhook) never doubles it.
const KEEP = 200;

const NAMES = {
  booster: (id) => BOOSTERS.find((b) => b.id === id)?.name,
  upgrade: (id) => UPGRADES.find((u) => u.id === id)?.name,
  outfit: (id) => OUTFITS.find((o) => o.id === id)?.name,
  decor: (id) => DECOR.find((x) => x.id === id)?.name,
  equipment: (id) => EQUIPMENT.find((x) => x.id === id)?.name,
};

// A short label for a toast: "3 × Freeze Time", "₦50,000", "100 coins".
export function grantLabel(g, fmtNaira = (n) => "₦" + n.toLocaleString()) {
  if (g.type === "cash") return fmtNaira(g.quantity);
  if (g.type === "coins") return `${g.quantity} coins`;
  const name = NAMES[g.type]?.(g.item) || g.item;
  return g.quantity > 1 ? `${g.quantity} × ${name}` : name;
}

/**
 * Applies one grant to the save. Returns false for an unknown item or one
 * already applied. Coins live in the server wallet, so they only count as seen.
 */
export function applyGrant(d, g) {
  d.grantsApplied = Array.isArray(d.grantsApplied) ? d.grantsApplied : [];
  if (!g || !g.id || d.grantsApplied.includes(g.id)) return false;
  const n = Math.max(1, Math.floor(g.quantity || 1));
  let ok = true;
  if (g.type === "booster" && NAMES.booster(g.item))
    d.boosters[g.item] = (d.boosters[g.item] || 0) + n;
  else if (g.type === "upgrade" && NAMES.upgrade(g.item)) {
    const max = UPGRADES.find((u) => u.id === g.item).costs.length;
    d.up[g.item] = Math.min(max, (d.up[g.item] || 0) + n);
  } else if (g.type === "outfit" && NAMES.outfit(g.item)) {
    if (!d.outfits.includes(g.item)) d.outfits.push(g.item);
    d.outfit = g.item;
  } else if (g.type === "decor" && NAMES.decor(g.item)) {
    if (!d.decor.includes(g.item)) d.decor.push(g.item);
  } else if (g.type === "equipment" && NAMES.equipment(g.item)) {
    // Bought for the restaurant you are at, up to the item's top level.
    if (!d.equipBy) migrateEquip(d);
    const place = placeOf(d),
      it = EQUIPMENT.find((x) => x.id === g.item),
      kit = equipAt(d, place);
    d.equipBy[place] = {
      ...kit,
      [g.item]: Math.min(it.costs.length, (kit[g.item] || 0) + n),
    };
  } else if (g.type === "cash") d.coins += n;
  else if (g.type !== "coins") ok = false;
  d.grantsApplied = [...d.grantsApplied, g.id].slice(-KEEP);
  return ok;
}

// Applies a list; returns every id handled (to confirm with the server)
// and the ones that changed the save.
export function applyGrants(d, list = []) {
  const handled = [],
    applied = [];
  for (const g of list) {
    const fresh = !(d.grantsApplied || []).includes(g.id);
    if (fresh && applyGrant(d, g)) applied.push(g);
    handled.push(g.id);
  }
  return { handled, applied };
}
