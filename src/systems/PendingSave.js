const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (v) => v && typeof v === "object" && !Array.isArray(v);

// A sync acknowledges the snapshot it uploaded. Edits made while the request
// was in flight still belong to the player and must be saved on the next sync.
export function rebasePendingSave(before, current, acknowledged) {
  if ((acknowledged.saveEpoch || 0) !== (before.saveEpoch || 0))
    return acknowledged;
  function merge(base, local, remote) {
    if (same(base, local)) return structuredClone(remote);
    if (object(base) && object(local) && object(remote)) {
      const out = {};
      for (const key of new Set([
        ...Object.keys(local),
        ...Object.keys(remote),
      ])) {
        const value = merge(base[key], local[key], remote[key]);
        if (value !== undefined) out[key] = value;
      }
      return out;
    }
    return structuredClone(local);
  }
  const result = merge(before, current, acknowledged);
  result.coins = Math.max(
    0,
    (acknowledged.coins || 0) + (current.coins || 0) - (before.coins || 0),
  );
  return result;
}
