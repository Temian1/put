import { mergeSaves } from "./CloudSave.js";

// Online services on the Kikter backend (war.kikter.com): sign-in, live game
// settings, cloud save, shift reports, the coin wallet and the real
// leaderboard. Players must sign in with
// a Kikter account (the same one Lagos War uses) or, inside Lagos Life, with
// their Lagos Life player, so every device shares one save and wallet.
// Production builds use it by default; dev and tests do not unless
// VITE_MAMAPUT_API is set. Set it to "off" to disable.
export const DEFAULT_API = "https://war.kikter.com/api/mamaput";
const envApi = import.meta.env?.VITE_MAMAPUT_API;
export const API_BASE =
  envApi === "off" ? "" : envApi || (import.meta.env?.PROD ? DEFAULT_API : "");

const KEY = "mamaPutRush3D.online";
const CONFIG_KEY = "mamaPutRush3D.config";

// First validation message from a Laravel error response.
const errorOf = (r, fallback) =>
  (r.data?.errors && Object.values(r.data.errors)[0]?.[0]) ||
  r.data?.message ||
  (r.status ? fallback : "Could not reach the server. Try again.");

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
  const status = { online: false, banned: false, expired: false, error: "" };
  const signedIn = () => !!me.token && !!me.source && me.source !== "guest";

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
      if (r.status === 403 && /suspended/i.test(data?.message || ""))
        status.banned = true;
      // A guest the server no longer knows starts again; a signed-in player
      // whose sign-in ended must sign in again (never silently become a guest).
      if (r.status === 401 && me.token) {
        if (signedIn()) status.expired = true;
        else forget();
      }
      return { status: r.status, ok: r.ok, data };
    } catch (e) {
      status.online = false;
      status.error = e.message || "Network error";
      return { status: 0, ok: false, data: null };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function forget() {
    for (const k of Object.keys(me)) delete me[k];
    write(KEY, me);
  }

  function remember(data) {
    Object.assign(me, {
      id: data.id,
      name: data.name,
      source: data.source || "guest",
      account: data.account || null,
      lagoslife: data.lagoslife || null,
      wallet: data.wallet?.coins ?? me.wallet ?? 0,
      email: data.email ?? data.account?.email ?? null,
      supportUnread: data.supportUnread ?? me.supportUnread ?? 0,
    });
    if (data.token) me.token = data.token;
    write(KEY, me);
  }

  async function ensurePlayer() {
    return signedIn() && !status.expired;
  }

  // Signing in links or merges this device's guest on the server and gives
  // a new token. The caller then syncs, which merges the local save in.
  async function signIn(path, body) {
    if (!base) return { ok: false, error: "Online play is switched off." };
    const r = await req("POST", path, body);
    if (!r.ok || !r.data?.token)
      return { ok: false, error: errorOf(r, "Could not sign in.") };
    const previousId = me.id;
    remember(r.data);
    if (previousId !== me.id) {
      me.version = 0;
      delete me.baseCash;
      delete me.baseEpoch;
      delete me.saveOwner;
    }
    write(KEY, me);
    status.expired = false;
    status.banned = false;
    return { ok: true, player: r.data };
  }

  // An admin edit or reset on the server wins over local progress.
  function applyServer(local, remote) {
    if (!remote) return local;
    const localEpoch = local.saveEpoch || 0;
    const remoteEpoch = remote.saveEpoch || 0;
    const newer =
      remoteEpoch > localEpoch ||
      (remoteEpoch === localEpoch &&
        (remote.updatedAt || 0) > (local.updatedAt || 0));
    if (newer && remote.reset) {
      const fresh = { ...remote };
      delete fresh.reset;
      return { ...fresh, playerId: local.playerId };
    }
    const merged = mergeSaves(local, remote);
    // An account's first sync starts from its cloud cash. Thereafter only
    // changes since this device's acknowledged balance are applied, so a
    // freshly opened or stale browser cannot replace another device's money.
    const hasBase =
      me.saveOwner === me.id &&
      Number.isFinite(me.baseCash) &&
      me.baseEpoch === remoteEpoch &&
      localEpoch === remoteEpoch;
    merged.coins = hasBase
      ? Math.max(0, (remote.coins || 0) + (local.coins || 0) - me.baseCash)
      : remote.coins || 0;
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
    // Who is signed in: source is guest, kikter, lagoslife or both.
    get account() {
      return me.token
        ? {
            source: me.source || "guest",
            signedIn: signedIn(),
            email: me.email || me.account?.email || null,
            supportUnread: me.supportUnread || 0,
            lagoslife: me.lagoslife?.name || null,
            wallet: me.wallet || 0,
          }
        : null;
    },
    cachedConfig: () => read(CONFIG_KEY),
    async config() {
      if (!base) return null;
      const r = await req("GET", "/config");
      if (r.ok && r.data) write(CONFIG_KEY, r.data);
      return r.ok ? r.data : read(CONFIG_KEY);
    },
    ensurePlayer,
    login: (email, password) => signIn("/auth/login", { email, password }),
    register: (name, email, password) =>
      signIn("/auth/register", { name, email, password }),
    lagosLife: (session) => signIn("/auth/lagoslife", { session }),
    // Ends the sign-in on this device. The account keeps its progress.
    async logout() {
      if (base && me.token) await req("POST", "/auth/logout", {});
      forget();
      status.expired = false;
    },
    async refresh() {
      if (!base || !me.token || status.expired) return null;
      const r = await req("GET", "/me");
      if (r.ok) remember(r.data);
      return r.ok ? r.data : null;
    },
    // Background check for a saved email and new support replies. Takes only
    // those two fields: a slower reply must not undo a coin swap.
    async checkInbox() {
      if (!base || !signedIn() || status.expired) return;
      const r = await req("GET", "/me");
      if (!r.ok) return;
      me.email = r.data.email ?? r.data.account?.email ?? null;
      me.supportUnread = r.data.supportUnread ?? 0;
      write(KEY, me);
    },
    async wallet() {
      if (!base || !signedIn() || status.expired) return null;
      const r = await req("GET", "/wallet");
      if (r.ok) {
        me.wallet = r.data.coins;
        write(KEY, me);
      }
      return r.ok ? r.data : null;
    },
    // Swaps coins for in-game naira; returns { cash } to add to the save.
    async exchange(coins) {
      if (!base || !signedIn()) return { ok: false, error: "Sign in first." };
      const r = await req("POST", "/wallet/exchange", { coins });
      if (!r.ok) return { ok: false, error: errorOf(r, "Could not swap.") };
      me.wallet = r.data.coins;
      write(KEY, me);
      return { ok: true, ...r.data };
    },
    // Delivers a Lagos Life purchase (once per purchase) into the wallet.
    async claimPurchase(session, purchaseId) {
      if (!base || !signedIn()) return null;
      const r = await req("POST", "/lagoslife/purchase", {
        session,
        purchaseId,
      });
      if (r.ok) {
        me.wallet = r.data.coins;
        write(KEY, me);
      }
      return r.ok ? r.data : { error: errorOf(r, "Could not deliver.") };
    },
    // Shop items bought on Lagos Life that the game has not applied yet.
    async grants() {
      if (!base || !signedIn() || status.expired) return [];
      const r = await req("GET", "/lagoslife/grants");
      return r.ok ? r.data.grants || [] : [];
    },
    async ackGrants(ids) {
      if (!base || !signedIn() || !ids.length) return false;
      return (await req("POST", "/lagoslife/grants/ack", { ids })).ok;
    },
    // Pull, merge, push. Retries once if another device saved in between.
    async sync(local, prepare = (save) => save) {
      if (!base || status.banned || !(await ensurePlayer())) return null;
      let pulled = await req("GET", "/save");
      if (!pulled.ok) return null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const remote = pulled.data.save;
        if (
          remote &&
          (me.saveOwner !== me.id ||
            (remote.saveEpoch || 0) > (local.saveEpoch || 0))
        ) {
          // Keep the original device snapshot recoverable before adopting a
          // different cloud balance. Never replace a larger recovery copy.
          const key = `${KEY}.recovery.${me.id}`;
          const previous = read(key);
          if (!previous || (local.coins || 0) > (previous.save?.coins || 0))
            write(key, { at: Date.now(), playerId: me.id, save: local });
        }
        // Settlement may mutate nested tills/crew. Keep failed uploads and
        // conflict retries from changing either input before they succeed.
        const merged = prepare(
          structuredClone(applyServer(local, pulled.data.save)),
        );
        const pushed = await req("PUT", "/save", {
          version: pulled.data.version,
          save: merged,
        });
        if (pushed.ok) {
          me.version = pushed.data.version;
          me.saveOwner = me.id;
          me.baseCash = merged.coins || 0;
          me.baseEpoch = merged.saveEpoch || 0;
          write(KEY, me);
          return merged;
        }
        if (pushed.status !== 409) return null;
        pulled = { ok: true, data: pushed.data };
      }
      return null;
    },
    // Returns the server reply ({ coins } earned for a won shift) or null.
    async reportShift(shift) {
      if (!base || status.banned || !(await ensurePlayer())) return null;
      const r = await req("POST", "/shifts", shift);
      if (r.ok && r.data?.wallet != null) {
        me.wallet = r.data.wallet;
        write(KEY, me);
      }
      return r.ok ? r.data || {} : null;
    },
    async leaderboard(board, scope = "all") {
      if (!base) return null;
      const r = await req(
        "GET",
        "/leaderboard?board=" +
          encodeURIComponent(board) +
          (scope === "lagoslife" ? "&scope=lagoslife" : ""),
      );
      return r.ok ? r.data : null;
    },
    // The contact email the game asks for. Not verified, not a login.
    async saveEmail(email) {
      if (!base || !(await ensurePlayer()))
        return { ok: false, error: "Sign in first." };
      const r = await req("PUT", "/me/email", { email });
      if (!r.ok)
        return {
          ok: false,
          offline: !r.status,
          error: errorOf(r, "Could not save your email."),
        };
      remember(r.data);
      return { ok: true };
    },
    // Requests and complaints sent to support, with their replies.
    async support() {
      if (!base || !(await ensurePlayer()))
        return { ok: false, error: "Support needs you to be online." };
      const r = await req("GET", "/support");
      return r.ok
        ? { ok: true, tickets: r.data.tickets }
        : { ok: false, error: errorOf(r, "Could not load your messages.") };
    },
    async sendSupport(category, message) {
      const r = await req("POST", "/support", { category, message });
      return r.ok
        ? { ok: true, tickets: r.data.tickets }
        : { ok: false, error: errorOf(r, "Could not send your message.") };
    },
    async replySupport(id, message) {
      const r = await req("POST", `/support/${id}/reply`, { message });
      return r.ok
        ? { ok: true, tickets: r.data.tickets }
        : { ok: false, error: errorOf(r, "Could not send your message.") };
    },
    async readSupport() {
      const r = await req("POST", "/support/read", {});
      if (r.ok) {
        me.supportUnread = 0;
        write(KEY, me);
      }
    },
    async rename(name) {
      if (!base || !(await ensurePlayer())) return null;
      const r = await req("PATCH", "/me", { name });
      if (r.ok) remember(r.data);
      return r.ok ? r.data : null;
    },
  };
}
