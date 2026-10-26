import { test, expect } from "@playwright/test";
import { claimedToday, SAVE_KEY } from "./helpers.js";

// Inside Lagos Life: the game signs in with the Lagos Life session and sells
// its own shop items for Lagos Life money. The SDK and the Kikter backend
// are both stand-ins here.
test("buying a booster with Lagos Life adds it to the save once", async ({
  page,
}) => {
  const s = { grants: [], acked: [], claims: 0 };
  await page.addInitScript(
    ([key, save]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(key, save);
        sessionStorage.setItem("seeded", "1");
      }
      const off = () => () => {};
      window.Vatar = {
        init: async () => ({
          player: { id: "t_1", name: "Eboy" },
          session: "sess",
          mode: "test",
        }),
        session: async () => ({ session: "sess", exp: Date.now() + 600000 }),
        purchase: async (productId) => ({ purchaseId: "pu_42", productId }),
        purchases: async () => [],
        onPause: off,
        onResume: off,
        onPurchase: off,
        submitScore: async (n) => ({ best: n, accepted: true }),
        leaderboard: async () => ({ top: [], me: null }),
      };
    },
    [
      SAVE_KEY,
      JSON.stringify({ schema: 3, lastClaim: claimedToday(), coins: 5000 }),
    ],
  );
  await page.route("https://api.mock/mamaput/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/mamaput", "");
    const body = req.postDataJSON?.() ?? null;
    const reply = (status, json) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        json,
      });
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      });
    if (path === "/config")
      return reply(200, {
        accounts: { guests: true, lagoslife: true },
        lagoslifeProducts: [
          {
            productId: "mp_freeze_3",
            name: "3 Freeze Time boosters",
            type: "booster",
            item: "freeze",
            amount: 3,
          },
        ],
      });
    if (path === "/players")
      return reply(201, { id: 3, name: "G", token: "g" });
    if (path === "/auth/lagoslife")
      return reply(200, {
        id: 3,
        name: "Eboy's Buka",
        token: "ll",
        source: "lagoslife",
        lagoslife: { name: "Eboy" },
        wallet: { coins: 0 },
      });
    if (path === "/lagoslife/purchase") {
      s.claims++;
      s.grants = [
        { id: body.purchaseId, type: "booster", item: "freeze", quantity: 3 },
      ];
      return reply(200, { granted: true, grants: s.grants, coins: 0 });
    }
    if (path === "/lagoslife/grants") return reply(200, { grants: s.grants });
    if (path === "/lagoslife/grants/ack") {
      s.acked.push(...body.ids);
      s.grants = s.grants.filter((g) => !body.ids.includes(g.id));
      return reply(200, { applied: body.ids.length });
    }
    if (path === "/save" && req.method() === "GET")
      return reply(200, { version: 0, save: null });
    if (path === "/save") return reply(200, { version: 1 });
    if (path === "/wallet") return reply(200, { coins: 0, signedIn: true });
    return reply(200, {});
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?lagoslife=1");
  await expect(page.locator("#boot")).toHaveClass(/gone/, { timeout: 30_000 });
  // Signed in with Lagos Life without typing anything.
  await expect
    .poll(() =>
      page.evaluate(() => window.__mp.Online.account?.lagoslife || null),
    )
    .toBe("Eboy");
  const before = await page.evaluate(
    () => window.__mp.Save.d.boosters.freeze || 0,
  );
  await page.locator("#btnShop").click({ force: true });
  await page.locator("#tabBoost").click({ force: true });
  const card = page.locator("#shopList .card", { hasText: "Freeze" });
  await card.locator(".lagosBuy").click();
  await expect
    .poll(() => page.evaluate(() => window.__mp.Save.d.boosters.freeze))
    .toBe(before + 3);
  await expect.poll(() => s.acked).toEqual(["pu_42"]);
  // Asking again (e.g. a webhook delivery) does not add it twice.
  await page.evaluate(() => window.__mp.Save.d.grantsApplied.includes("pu_42"));
  expect(s.claims).toBe(1);
  expect(await page.evaluate(() => window.__mp.Save.d.boosters.freeze)).toBe(
    before + 3,
  );
  expect(errors).toEqual([]);
});
