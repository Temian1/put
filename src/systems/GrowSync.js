// Grow is mutable: max-merging a safe resurrects collected money, and
// unioning crews brings back fired workers. Compare against this browser's
// last acknowledged state instead of trusting its save timestamp.
export const GROW_FIELDS = [
  "crew",
  "crewSeq",
  "till",
  "awayFrom",
  "awayOpenMs",
  "day",
];

export function growSnapshot(save) {
  return Object.fromEntries(
    GROW_FIELDS.map((key) => [key, structuredClone(save[key] ?? null)]),
  );
}

const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const record = (v) => v && typeof v === "object" && !Array.isArray(v);

function reconcile(local, remote, base, preferLocal) {
  if (equal(local, base)) return remote;
  if (equal(remote, base)) return local;
  if (record(local) && record(remote)) {
    const result = {};
    for (const key of new Set([
      ...Object.keys(local),
      ...Object.keys(remote),
    ])) {
      const value = reconcile(
        local[key],
        remote[key],
        base?.[key],
        preferLocal,
      );
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  return preferLocal ? local : remote;
}

export function mergeGrow(merged, local, remote, baseline) {
  const preferLocal = (local.updatedAt || 0) >= (remote.updatedAt || 0);
  for (const key of GROW_FIELDS) {
    const value = baseline
      ? reconcile(local[key], remote[key], baseline[key], preferLocal)
      : remote[key];
    if (value === undefined) delete merged[key];
    else merged[key] = structuredClone(value);
  }
  return merged;
}
