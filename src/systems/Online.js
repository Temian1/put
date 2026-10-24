import { mergeSaves } from "./CloudSave.js";

// Online services on the Kikter backend (war.kikter.com): a player account
// per device, live game settings, cloud save, shift reports and the real
// leaderboard. Production builds use it by default; dev and tests do not
// unless VITE_MAMAPUT_API is set. Set it to "off" to disable.
export const DEFAULT_API = "https://war.kikter.com/api/mamaput";
const envApi = import.meta.env?.VITE_MAMAPUT_API;
export const API_BASE =
  envApi === "off" ? "" : envApi || (import.meta.env?.PROD ? DEFAULT_API : "");

const KEY = "mamaPutRush3D.online";
const CONFIG_KEY = "mamaPutRush3D.config";

export function createOnline({
  base = API_BASE,
  storage = globalThis.localStorage,
  fetchImpl = globalThis.fetch,
  timeout = 8000,
} = {}) {
  const read = (k) => {
    try {
      return JSON.parse(storage.getItem(k));
    } catch (e) {
      return null;
    }
  };
  const write = (k, v) => {
    try {
      storage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };
  const me = read(KEY) || {};
  const status = { online: false, banned: false, error: "" };

  async function req(method, path, body) {
    const ctrl =
      typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetchImpl(base.replace(/\/$/, "") + path, {
        method,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(me.token ? { Authorization: "Bearer " + me.token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl?.signal,
      });
      const data = r.status === 204 ? null : await r.json().catch(() => null);
      status.online = true;
      if (r.status === 403) status.banned = true;
      return { status: r.status, ok: r.ok, data };
    } catch (e) {
      status.online = false;
      status.error = e.message || "Network error";
      return { status: 0, ok: false, data: null };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function ensurePlayer(name) {
    if (me.token) return true;
    const r = await req("POST", "/players", name ? { name } : {});
    if (r.status !== 201) return false;
    Object.assign(me, {
      id: r.data.id,
      name: r.data.name,
      token: r.data.token,
    });
    write(KEY, me);
    return true;
  }

  // An admin edit or reset on the server wins over local progress.
  function applyServer(local, remote) {
    if (!remote) return local;
    const newer = (remote.updatedAt || 0) > (local.updatedAt || 0);
    if (newer && remote.reset) {
      const fresh = { ...remote };
      delete fresh.reset;
      return { ...fresh, playerId: local.playerId };
    }
    const merged = mergeSaves(local, remote);
    if (newer && remote.adminEdit)
      for (const k of ["coins", "reputation", "unlocked"])
        if (remote[k] !== undefined) merged[k] = remote[k];
    delete merged.adminEdit;
    delete merged.reset;
    return merged;
  }

  return {
    enabled: !!base,
    status,
    get player() {
      return me.token ? { id: me.id, name: me.name } : null;
    },
    cachedConfig: () => read(CONFIG_KEY),
    async config() {
      if (!base) return null;
      const r = await req("GET", "/config");
      if (r.ok && r.data) write(CONFIG_KEY, r.data);
      return r.ok ? r.data : read(CONFIG_KEY);
    },
    // Pull, merge, push. Retries once if another device saved in between.
    async sync(local) {
      if (!base || status.banned || !(await ensurePlayer())) return null;
      let pulled = await req("GET", "/save");
      if (!pulled.ok) return null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const merged = applyServer(local, pulled.data.save);
        const pushed = await req("PUT", "/save", {
          version: pulled.data.version,
          save: merged,
        });
        if (pushed.ok) {
          me.version = pushed.data.version;
          write(KEY, me);
          return merged;
        }
        if (pushed.status !== 409) return null;
        pulled = { ok: true, data: pushed.data };
      }
      return null;
    },
    async reportShift(shift) {
      if (!base || status.banned || !(await ensurePlayer())) return false;
      return (await req("POST", "/shifts", shift)).ok;
    },
    async leaderboard(board) {
      if (!base) return null;
      const r = await req(
        "GET",
        "/leaderboard?board=" + encodeURIComponent(board),
      );
      return r.ok ? r.data : null;
    },
    async rename(name) {
      if (!base || !(await ensurePlayer())) return null;
      const r = await req("PATCH", "/me", { name });
      if (r.ok) {
        me.name = r.data.name;
        write(KEY, me);
      }
      return r.ok ? r.data : null;
    },
  };
}
