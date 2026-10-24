import { describe, it, expect, vi, afterEach } from "vitest";
import { createOnline } from "../src/systems/Online.js";
import { createLagosLife, lagosLifeHinted } from "../src/systems/LagosLife.js";
import { LIVE, applyLiveConfig } from "../src/game/live.js";
import { FOODS, PLACES, STAFF } from "../src/game/data.js";
import { EQUIPMENT } from "../src/game/equipment.js";
import { taxes } from "../src/game/business.js";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const json = (status, data) => ({
  status,
  ok: status < 300,
  json: async () => data,
});

// Minimal stand-in for the Kikter API.
function fakeServer() {
  const s = { version: 0, save: null, shifts: [], token: "tok" };
  const fetchImpl = vi.fn(async (url, opts = {}) => {
    const path = url.replace("https://api.test", "");
    const body = opts.body ? JSON.parse(opts.body) : null;
    const bearer = opts.headers?.Authorization?.slice(7);
    if (s.revoked?.includes(bearer))
      return json(401, { message: "Unknown player." });
    const authed = bearer === "tok" || bearer === "acct";
    if (path === "/auth/login") {
      if (body.password !== "secret-pass")
        return json(422, { errors: { email: ["Wrong email or password."] } });
      s.loginBearer = bearer;
      return json(200, {
        id: 7,
        name: "Mama Put 1234",
        token: "acct",
        source: "kikter",
        account: { name: "Iya Bose", email: body.email },
        wallet: { coins: 1000 },
      });
    }
    if (path === "/auth/lagoslife")
      return json(200, {
        id: 7,
        name: "Mama Put 1234",
        token: "acct",
        source: "both",
        account: { email: "bose@example.com" },
        lagoslife: { name: "Bose LL" },
        wallet: { coins: 1000 },
      });
    if (path === "/auth/logout") {
      (s.revoked ||= []).push(bearer);
      return json(200, { ok: true });
    }
    if (path === "/wallet/exchange")
      return json(200, { cash: body.coins * 200, coins: 1000 - body.coins });
    if (path === "/players" && opts.method === "POST")
      return json(201, {
        id: 7,
        name: body.name || "Mama Put 1234",
        token: "tok",
      });
    if (!authed && path !== "/config" && !path.startsWith("/leaderboard"))
      return json(401, { message: "Unknown player." });
    if (path === "/config")
      return json(200, { maintenance: false, foodPrices: { jollof: 1100 } });
    if (path === "/save" && opts.method === "GET")
      return json(200, { version: s.version, save: s.save });
    if (path === "/save" && opts.method === "PUT") {
      if (body.version !== s.version)
        return json(409, { version: s.version, save: s.save });
      s.save = body.save;
      s.version++;
      return json(200, { version: s.version });
    }
    if (path === "/shifts") {
      s.shifts.push(body);
      return bearer === "acct"
        ? json(201, { ok: true, coins: 5, wallet: 1005 })
        : json(201, { ok: true, coins: 0, wallet: null });
    }
    if (path.startsWith("/leaderboard"))
      return json(200, {
        rows: [
          {
            rank: 1,
            name: "Iya Bose",
            value: 9e5,
            tier: "Busy Buka",
            restaurants: 2,
            you: false,
          },
        ],
        me: null,
        players: 1,
      });
    return json(404, {});
  });
  return { s, fetchImpl };
}

afterEach(() => vi.restoreAllMocks());

describe("online services", () => {
  it("is disabled without an API base", async () => {
    const o = createOnline({ base: "", storage: memory(), fetchImpl: vi.fn() });
    expect(o.enabled).toBe(false);
    expect(await o.sync({ coins: 1 })).toBe(null);
  });
  it("creates a player once and remembers the token", async () => {
    const { fetchImpl } = fakeServer();
    const storage = memory();
    const o = createOnline({ base: "https://api.test", storage, fetchImpl });
    await o.sync({ coins: 3000, unlocked: 1, updatedAt: 1 });
    expect(o.player).toEqual({ id: 7, name: "Mama Put 1234" });
    const again = createOnline({
      base: "https://api.test",
      storage,
      fetchImpl,
    });
    expect(again.player.id).toBe(7);
    await again.sync({ coins: 3000, unlocked: 1, updatedAt: 2 });
    expect(
      fetchImpl.mock.calls.filter(([u]) => u.endsWith("/players")),
    ).toHaveLength(1);
  });
  it("uploads the save and retries after a version conflict", async () => {
    const { s, fetchImpl } = fakeServer();
    const o = createOnline({
      base: "https://api.test",
      storage: memory(),
      fetchImpl,
    });
    const local = {
      coins: 5000,
      unlocked: 4,
      stars: { 1: 3 },
      updatedAt: 10,
      stats: { serve: 4 },
    };
    await o.sync(local);
    expect(s.save.unlocked).toBe(4);
    // Another device saved in between: the merge keeps the furthest progress.
    s.save = { ...s.save, unlocked: 9, updatedAt: 5 };
    s.version = 5;
    const merged = await o.sync({ ...local, updatedAt: 20 });
    expect(merged.unlocked).toBe(9);
    expect(s.save.unlocked).toBe(9);
  });
  it("applies admin edits and resets from the server", async () => {
    const { s, fetchImpl } = fakeServer();
    const o = createOnline({
      base: "https://api.test",
      storage: memory(),
      fetchImpl,
    });
    await o.sync({ coins: 5000, unlocked: 30, reputation: 70, updatedAt: 10 });
    s.save = {
      ...s.save,
      coins: 999999,
      unlocked: 12,
      adminEdit: true,
      updatedAt: 99,
    };
    const edited = await o.sync({
      coins: 5000,
      unlocked: 30,
      reputation: 70,
      updatedAt: 20,
    });
    expect(edited).toMatchObject({ coins: 999999, unlocked: 12 });
    expect(edited.adminEdit).toBeUndefined();
    s.save = {
      coins: 3000,
      unlocked: 1,
      reputation: 50,
      reset: true,
      updatedAt: 999,
    };
    const reset = await o.sync({
      coins: 5000,
      unlocked: 30,
      stars: { 5: 3 },
      updatedAt: 30,
    });
    expect(reset).toMatchObject({ coins: 3000, unlocked: 1 });
    expect(reset.stars).toBeUndefined();
    expect(reset.reset).toBeUndefined();
  });
  it("reports shifts and reads the real leaderboard", async () => {
    const { s, fetchImpl } = fakeServer();
    const o = createOnline({
      base: "https://api.test",
      storage: memory(),
      fetchImpl,
    });
    expect(
      await o.reportShift({ mode: "level", level: 3, won: true, sales: 9000 }),
    ).toMatchObject({ ok: true, coins: 0 });
    expect(s.shifts).toHaveLength(1);
    const board = await o.leaderboard("sales");
    expect(board.rows[0].name).toBe("Iya Bose");
  });
  it("caches the live config for offline starts", async () => {
    const { fetchImpl } = fakeServer();
    const storage = memory();
    const o = createOnline({ base: "https://api.test", storage, fetchImpl });
    expect((await o.config()).foodPrices.jollof).toBe(1100);
    const offline = createOnline({
      base: "https://api.test",
      storage,
      fetchImpl: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    expect((await offline.config()).foodPrices.jollof).toBe(1100);
    expect(offline.status.online).toBe(false);
  });
});

describe("accounts and wallet", () => {
  it("signs a guest in, earns and swaps coins, then logs out", async () => {
    const { s, fetchImpl } = fakeServer();
    const storage = memory();
    const o = createOnline({ base: "https://api.test", storage, fetchImpl });
    await o.sync({ coins: 3000, unlocked: 2, updatedAt: 1 });
    expect(o.account).toMatchObject({ source: "guest", signedIn: false });
    const bad = await o.login("bose@example.com", "nope");
    expect(bad).toEqual({ ok: false, error: "Wrong email or password." });
    const r = await o.login("bose@example.com", "secret-pass");
    expect(r.ok).toBe(true);
    // The guest token goes with the login so the server can merge it.
    expect(s.loginBearer).toBe("tok");
    expect(o.account).toMatchObject({
      source: "kikter",
      signedIn: true,
      email: "bose@example.com",
      wallet: 1000,
    });
    // Signed in on the next page load too.
    const reload = createOnline({
      base: "https://api.test",
      storage,
      fetchImpl,
    });
    expect(reload.account.signedIn).toBe(true);
    expect((await o.reportShift({ won: true })).coins).toBe(5);
    expect(o.account.wallet).toBe(1005);
    expect(await o.exchange(10)).toMatchObject({ ok: true, cash: 2000 });
    expect(o.account.wallet).toBe(990);
    await o.logout();
    expect(o.account).toBe(null);
    expect(s.revoked).toEqual(["acct"]);
  });
  it("never turns an ended sign-in into a guest", async () => {
    const { s, fetchImpl } = fakeServer();
    const o = createOnline({
      base: "https://api.test",
      storage: memory(),
      fetchImpl,
    });
    await o.login("bose@example.com", "secret-pass");
    s.revoked = ["acct"];
    expect(await o.sync({ coins: 1, unlocked: 1 })).toBe(null);
    expect(o.status.expired).toBe(true);
    expect(o.account.signedIn).toBe(true);
    expect(
      fetchImpl.mock.calls.filter(([u]) => u.endsWith("/players")),
    ).toHaveLength(0);
  });
  it("signs in with a Lagos Life session", async () => {
    const { fetchImpl } = fakeServer();
    const o = createOnline({
      base: "https://api.test",
      storage: memory(),
      fetchImpl,
    });
    const r = await o.lagosLife("signed-session");
    expect(r.ok).toBe(true);
    expect(o.account).toMatchObject({ source: "both", lagoslife: "Bose LL" });
    const call = fetchImpl.mock.calls.find(([u]) =>
      u.endsWith("/auth/lagoslife"),
    );
    expect(JSON.parse(call[1].body)).toEqual({ session: "signed-session" });
  });
});

describe("Lagos Life SDK", () => {
  const sdk = () => ({
    init: vi.fn(async () => ({
      player: { id: "p_1", name: "Bose" },
      session: "s1",
      mode: "live",
    })),
    session: vi.fn(async () => ({ session: "s2", exp: Date.now() + 120000 })),
    submitScore: vi.fn(async (n) => ({ best: n, accepted: true })),
    leaderboard: vi.fn(async () => ({ top: [], me: null })),
    purchases: vi.fn(async () => [{ purchaseId: "pu_1" }]),
    onPause: vi.fn(() => () => {}),
    onResume: vi.fn(() => () => {}),
    onPurchase: vi.fn(() => () => {}),
  });
  it("only loads inside Lagos Life", () => {
    const win = (top, referrer, search = "") => {
      const w = { location: { search }, document: { referrer } };
      w.self = w;
      w.top = top ? w : {};
      return w;
    };
    expect(lagosLifeHinted(win(true, ""))).toBe(false);
    expect(lagosLifeHinted(win(true, "", "?lagoslife=1"))).toBe(true);
    expect(lagosLifeHinted(win(false, "https://lagoslife.app/play"))).toBe(
      true,
    );
    expect(lagosLifeHinted(win(false, "https://evil.example/"))).toBe(false);
  });
  it("connects, refreshes sessions and sends only new high scores", async () => {
    const Vatar = sdk();
    const ll = createLagosLife({ win: { Vatar }, doc: {} });
    expect(await ll.connect()).toEqual({
      player: { id: "p_1", name: "Bose" },
      session: "s1",
    });
    expect(await ll.session()).toBe("s1");
    ll.score(5000);
    await Promise.resolve();
    ll.score(4000);
    expect(Vatar.submitScore).toHaveBeenCalledTimes(1);
    expect(Vatar.submitScore).toHaveBeenCalledWith(5000);
    expect(await ll.purchases()).toEqual([{ purchaseId: "pu_1" }]);
    ll.dispose();
  });
  it("reports no Lagos Life when the SDK fails", async () => {
    const ll = createLagosLife({
      win: {
        Vatar: { init: async () => Promise.reject(new Error("not_framed")) },
      },
      doc: {},
    });
    expect(await ll.connect()).toBe(null);
    expect(ll.state.active).toBe(false);
  });
});

describe("admin live settings", () => {
  it("apply prices, costs, taxes and switches", () => {
    const jollof = FOODS.jollof.price,
      place = PLACES[1].cost,
      table = EQUIPMENT[0].costs[0],
      wage = STAFF[0].wage;
    applyLiveConfig({
      foodPrices: { jollof: 1200 },
      places: [
        { cost: 0, income: 0 },
        { cost: 80000, income: 2000 },
      ],
      multipliers: { equipment: 2, staff: 1.5, boosters: 1, levy: 2, rent: 1 },
      vatRate: 0.1,
      features: { haggle: false },
      market: { inflation: 0.01, news: "Rice scarce", outOfStock: ["rice"] },
    });
    expect(FOODS.jollof.price).toBe(1200);
    expect(PLACES[1]).toMatchObject({ cost: 80000, income: 2000 });
    expect(EQUIPMENT[0].costs[0]).toBe(table * 2);
    expect(STAFF[0].wage).toBe(wage * 1.5);
    expect(LIVE.features).toMatchObject({ haggle: false, inspections: true });
    expect(taxes(2, 100000)).toEqual({ levy: 4000, vat: 10000 });
    // Restore the built-in values for the other tests.
    applyLiveConfig({
      foodPrices: { jollof },
      places: [
        { cost: 0, income: 0 },
        { cost: place, income: 1500 },
      ],
      multipliers: {},
      vatRate: 0.075,
      features: { haggle: true },
      market: { inflation: 0.007, news: null, outOfStock: [] },
    });
    expect(EQUIPMENT[0].costs[0]).toBe(table);
    expect(taxes(2, 100000).vat).toBe(7500);
  });
});
