import { test, expect } from "@playwright/test";
import { boot, claimedToday, SAVE_KEY } from "./helpers.js";

// A stand-in for the Kikter backend (war.kikter.com/api/mamaput).
async function mockApi(page) {
  const s = { token: null, coins: 1000, version: 0, save: null, scopes: [] };
  const player = (extra = {}) => ({
    id: 9,
    name: "Iya Bose Buka",
    source: s.token === "acct" ? "kikter" : "guest",
    account:
      s.token === "acct" ? { name: "Bose", email: "bose@example.com" } : null,
    lagoslife: null,
    wallet: { coins: s.coins },
    ...extra,
  });
  await page.route("https://api.mock/mamaput/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/mamaput", "");
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
        wallet: { perWin: 5, dailyCap: 100, rate: 200, min: 10 },
      });
    if (path === "/players") {
      // A new guest starts with an empty cloud save.
      s.token = "guest";
      s.save = null;
      s.version = 0;
      return reply(201, { ...player(), token: "guest" });
    }
    if (path === "/auth/register") {
      if (!body.email.includes("@"))
        return reply(422, { errors: { email: ["Bad email"] } });
      s.token = "acct";
      return reply(201, { ...player(), token: "acct" });
    }
    if (path === "/auth/login")
      return reply(422, { errors: { email: ["Wrong email or password."] } });
    if (path === "/auth/logout") {
      s.token = null;
      return reply(200, { ok: true });
    }
    if (path === "/wallet")
      return reply(200, { coins: s.coins, earnedToday: 0, signedIn: true });
    if (path === "/wallet/exchange") {
      s.coins -= body.coins;
      return reply(200, { cash: body.coins * 200, coins: s.coins });
    }
    if (path === "/save" && req.method() === "GET")
      return reply(200, { version: s.version, save: s.save });
    if (path === "/save") {
      s.save = body.save;
      s.version++;
      return reply(200, { version: s.version });
    }
    if (path === "/leaderboard") {
      s.scopes.push(url.searchParams.get("scope") || "all");
      return reply(200, {
        rows: [
          {
            rank: 1,
            name: "Lagos Queen",
            value: 900000,
            tier: "Busy Buka",
            restaurants: 2,
            source: "lagoslife",
            you: false,
          },
        ],
        me: null,
        players: 1,
      });
    }
    return reply(200, {});
  });
  return s;
}

test("guest signs up, swaps coins for naira, filters the board and logs out", async ({
  page,
}) => {
  const api = await mockApi(page);
  const errors = await boot(page, {
    schema: 3,
    lastClaim: claimedToday(),
    coins: 5000,
    unlocked: 4,
  });
  // A guest gets a reminder dot on the account button.
  await expect(page.locator("#accountDot")).toBeVisible();
  await page.locator("#btnAccount").click({ force: true });
  await expect(page.locator("#ovAccount")).toHaveClass(/show/);

  await page.locator("#accEmail").fill("bose@example.com");
  await page.locator("#accPassword").fill("wrong");
  await page.locator("#accSubmit").click();
  await expect(page.locator("#accError")).toHaveText(
    "Wrong email or password.",
  );

  await page.locator("#tabRegister").click();
  await expect(page.locator("#accName")).toBeVisible();
  await page.locator("#accSubmit").click();
  await expect(page.locator("#accError")).toContainText("name");
  await page.locator("#accName").fill("Bose");
  await page.locator("#accPassword").fill("secret-pass-1");
  await page.locator("#accSubmit").click();

  await expect(page.locator("#accSigned")).toBeVisible();
  await expect(page.locator("#accWho")).toContainText("bose@example.com");
  await expect(page.locator("#accCoins")).toHaveText("1,000");
  await expect(page.locator("#accountDot")).toBeHidden();
  // This phone's progress went up to the account.
  await expect.poll(() => api.save?.unlocked).toBe(4);

  await page.locator("#accSwap").fill("10");
  await page.locator("#accSwapBtn").click();
  await expect(page.locator("#accCoins")).toHaveText("990");
  await expect(page.locator("#menuCoins")).toHaveText("₦7,000");

  await page.locator("#accClose").click();
  await page.locator("#btnBoard").click({ force: true });
  await expect(page.locator("#boardList")).toContainText("Lagos Queen");
  await expect(page.locator("#boardList")).toContainText("Lagos Life");
  await page.locator("#boardScope").check({ force: true });
  await expect.poll(() => api.scopes.at(-1)).toBe("lagoslife");
  await page.locator("#boardClose").click({ force: true });

  await page.locator("#btnAccount").click({ force: true });
  await page.locator("#accLogout").click();
  await expect(page.locator("#accLogout")).toContainText("Tap again");
  await page.locator("#accLogout").click();
  await expect(page.locator("#ovAccount")).not.toHaveClass(/show/);
  const save = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)),
    SAVE_KEY,
  );
  expect(save.unlocked).toBe(1);
  expect(errors).toEqual([]);
});
