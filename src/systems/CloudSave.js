// Cloud save: conflict-safe merging, a portable backup code, and an optional
// HTTP sync adapter. No server ships with the game; set VITE_CLOUD_SAVE_URL to
// an endpoint that implements GET/PUT /saves/:playerId with ETag/If-Match.

const maxMap = (a = {}, b = {}) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] || 0, v);
  return out;
};
const union = (a = [], b = []) => [...new Set([...a, ...b])];

// Progress can only go forward, so it is merged field by field. Money and
// settings cannot be merged safely, so they come from the most recent save.
export function mergeSaves(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const newer =
    (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
  const merged = { ...newer };
  merged.unlocked = Math.max(local.unlocked || 1, remote.unlocked || 1);
  merged.stars = maxMap(local.stars, remote.stars);
  merged.best = maxMap(local.best, remote.best);
  merged.up = maxMap(local.up, remote.up);
  merged.endlessBest = Math.max(
    local.endlessBest || 0,
    remote.endlessBest || 0,
  );
  for (const k of [
    "outfits",
    "decor",
    "staff",
    "achievements",
    "taught",
    "branches",
  ])
    merged[k] = union(local[k], remote[k]);
  const { food: lf, ...ls } = local.stats || {},
    { food: rf, ...rs } = remote.stats || {};
  merged.stats = { ...maxMap(ls, rs), food: maxMap(lf, rf) };
  merged.tutorialDone = !!(local.tutorialDone || remote.tutorialDone);
  merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  merged.playerId = local.playerId || remote.playerId;
  return merged;
}

const checksum = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};
const toB64 = (s) => btoa(unescape(encodeURIComponent(s)));
const fromB64 = (s) => decodeURIComponent(escape(atob(s)));

// A copy-paste code for moving progress between devices without a server.
export function encodeBackup(d) {
  const json = JSON.stringify(d);
  return "MPR2." + checksum(json) + "." + toB64(json);
}
export function decodeBackup(code) {
  const [tag, sum, body] = String(code || "")
    .trim()
    .split(".");
  if (tag !== "MPR2" || !body)
    throw new Error("That is not a Mama Put backup code.");
  const json = fromB64(body);
  if (checksum(json) !== sum)
    throw new Error("The backup code is incomplete. Copy it again.");
  const d = JSON.parse(json);
  if (typeof d !== "object" || typeof d.unlocked !== "number")
    throw new Error("The backup code does not contain a save.");
  return d;
}

export function newPlayerId(rand = Math.random) {
  return (
    "mp-" + Date.now().toString(36) + "-" + rand().toString(36).slice(2, 10)
  );
}

// Pushes the local save; on a version conflict it pulls, merges and retries once.
export function createCloudSync({ url, fetchImpl = globalThis.fetch }) {
  let etag = null;
  const endpoint = (id) =>
    `${url.replace(/\/$/, "")}/saves/${encodeURIComponent(id)}`;
  async function pull(id) {
    const r = await fetchImpl(endpoint(id), {
      headers: { Accept: "application/json" },
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("Cloud save unavailable (" + r.status + ")");
    etag = r.headers.get("ETag");
    return r.json();
  }
  async function push(id, d) {
    const headers = { "Content-Type": "application/json" };
    if (etag) headers["If-Match"] = etag;
    else headers["If-None-Match"] = "*";
    const r = await fetchImpl(endpoint(id), {
      method: "PUT",
      headers,
      body: JSON.stringify(d),
    });
    if (r.status === 412 || r.status === 409) return { conflict: true };
    if (!r.ok) throw new Error("Cloud save failed (" + r.status + ")");
    etag = r.headers.get("ETag");
    return { conflict: false };
  }
  return {
    enabled: !!url,
    async sync(local) {
      const id = local.playerId;
      const remote = await pull(id);
      let merged = mergeSaves(local, remote);
      if ((await push(id, merged)).conflict) {
        merged = mergeSaves(merged, await pull(id));
        if ((await push(id, merged)).conflict)
          throw new Error("Another device is saving. Try again in a moment.");
      }
      return merged;
    },
  };
}
