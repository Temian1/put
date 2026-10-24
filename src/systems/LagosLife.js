// Lagos Life (Vatar games SDK). Mama Put runs inside Lagos Life as an
// embedded game: the SDK gives a signed session for the player, which the
// Kikter backend verifies before linking the Lagos Life player to a Mama
// Put account. It also carries Lagos Life purchases, the Lagos Life score
// board and pause/resume. Outside Lagos Life none of this loads.
export const SDK_URL = "https://lagoslife.app/sdk/vatar-games-v1.js";
const HOSTS =
  /(^|\.)(lagoslife\.app|naijalife\.app|lagoslife\.eliysites\.com)$/;
// Lagos Life accepts one score every 20 seconds.
const SCORE_GAP = 21000;

export function lagosLifeHinted(win = globalThis.window) {
  if (!win) return false;
  try {
    const q = new URLSearchParams(win.location.search);
    if (q.has("lagoslife") || q.has("vatar")) return true;
  } catch (e) {}
  let framed = false;
  try {
    framed = win.self !== win.top;
  } catch (e) {
    framed = true;
  }
  if (!framed) return false;
  try {
    const ref = win.document.referrer && new URL(win.document.referrer).host;
    return !ref || HOSTS.test(ref);
  } catch (e) {
    return true;
  }
}

export function createLagosLife({
  win = globalThis.window,
  doc = globalThis.document,
  timeout = 12000,
} = {}) {
  let sdkLoad = null;
  let fresh = null;
  let best = -1;
  let pending = null;
  let lastScore = -Infinity;
  let timer = 0;
  const offs = [];
  const state = { active: false, player: null, error: "" };

  const sdk = () => {
    if (!win.Vatar) throw new Error("Lagos Life is not ready.");
    return win.Vatar;
  };
  function load() {
    sdkLoad ??= new Promise((resolve, reject) => {
      if (win.Vatar) return resolve(win.Vatar);
      const tag = doc.createElement("script");
      tag.src = SDK_URL;
      const t = setTimeout(
        () => reject(new Error("Lagos Life could not load.")),
        timeout,
      );
      tag.onload = () => {
        clearTimeout(t);
        win.Vatar
          ? resolve(win.Vatar)
          : reject(new Error("Lagos Life could not load."));
      };
      tag.onerror = () => {
        clearTimeout(t);
        reject(new Error("Lagos Life could not load."));
      };
      doc.head.appendChild(tag);
    });
    return sdkLoad;
  }
  const withTimeout = (p) =>
    Promise.race([
      p,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("Lagos Life did not answer.")), timeout),
      ),
    ]);

  async function flush() {
    if (!state.active || pending === null) return;
    clearTimeout(timer);
    const wait = lastScore + SCORE_GAP - Date.now();
    if (wait > 0) {
      timer = setTimeout(flush, wait);
      return;
    }
    const value = pending;
    pending = null;
    lastScore = Date.now();
    try {
      const r = await sdk().submitScore(value);
      best = Math.max(best, value, r?.best ?? 0);
    } catch (e) {
      if (!["not_framed", "signed_out", "off", "bad_request"].includes(e?.code))
        pending = Math.max(pending ?? 0, value);
    }
    if (pending !== null) timer = setTimeout(flush, SCORE_GAP);
  }

  return {
    state,
    /**
     * Starts the SDK. Resolves with { player, session } or null when the
     * game is not running inside Lagos Life.
     */
    async connect({ onPause, onResume, onPurchase } = {}) {
      try {
        await load();
        const init = await withTimeout(sdk().init());
        fresh = { session: init.session, exp: Date.now() + 60000 };
        state.active = true;
        state.player = init.player || null;
        if (onPause) offs.push(sdk().onPause(onPause));
        if (onResume) offs.push(sdk().onResume(onResume));
        if (onPurchase) offs.push(sdk().onPurchase(onPurchase));
        return { player: init.player, session: init.session };
      } catch (e) {
        state.error = e?.message || "Lagos Life is not available.";
        return null;
      }
    },
    // A session token that is valid for at least another 30 seconds.
    async session() {
      if (!fresh || fresh.exp < Date.now() + 30000) {
        const t = await sdk().session();
        fresh = {
          session: t.session,
          exp: t.exp < 1e12 ? t.exp * 1000 : t.exp,
        };
      }
      return fresh.session;
    },
    async purchase(productId) {
      return sdk().purchase(productId);
    },
    async purchases() {
      try {
        return (await sdk().purchases()) || [];
      } catch (e) {
        return [];
      }
    },
    // Lifetime sales go to the Lagos Life board; only new highs are sent.
    score(value) {
      if (!state.active || !Number.isFinite(value)) return;
      const v = Math.max(0, Math.floor(value));
      if (v <= best || v <= (pending ?? -1)) return;
      pending = v;
      flush();
    },
    async leaderboard() {
      if (!state.active) return null;
      try {
        return await withTimeout(sdk().leaderboard());
      } catch (e) {
        return null;
      }
    },
    dispose() {
      clearTimeout(timer);
      offs.splice(0).forEach((off) => {
        try {
          off();
        } catch (e) {}
      });
      state.active = false;
    },
  };
}
