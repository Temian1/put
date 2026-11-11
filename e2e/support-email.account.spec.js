import { test, expect } from "@playwright/test";
import { boot, claimedToday } from "./helpers.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
};

// A small stand-in for the server: one signed-in Lagos Life player.
async function mockServer(page, state) {
  await page.route("https://api.mock/mamaput/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/mamaput", "");
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: CORS });
    const profile = () => ({
      id: 1,
      name: "Ola",
      version: 1,
      source: "lagoslife",
      email: state.email,
      supportUnread: state.tickets.filter((t) => t.unread).length,
      account: null,
      lagoslife: { name: "Ola" },
      wallet: { coins: 0 },
    });
    const send = (json, status = 200) =>
      route.fulfill({ status, headers: CORS, json });
    if (state.offline && path === "/me/email") return route.abort();
    if (path === "/config") return send({ accounts: { lagoslife: true } });
    if (path === "/me" && req.method() === "GET") return send(profile());
    if (path === "/me/email") {
      state.email = req.postDataJSON().email;
      return send(profile());
    }
    if (path === "/support/read") {
      state.tickets.forEach((t) => (t.unread = false));
      return send({ ok: true });
    }
    if (path === "/support" && req.method() === "POST") {
      const { category, message } = req.postDataJSON();
      state.tickets.unshift({
        id: state.tickets.length + 1,
        category,
        status: "open",
        unread: false,
        messages: [{ id: 1, body: message, support: false }],
      });
      return send({ tickets: state.tickets }, 201);
    }
    if (path === "/support") return send({ tickets: state.tickets });
    if (path === "/save") return send({ version: 1, save: null });
    return send({});
  });
}

const signedIn = (page) =>
  page.addInitScript(() =>
    localStorage.setItem(
      "mamaPutRush3D.online",
      JSON.stringify({
        id: 1,
        name: "Ola",
        token: "fake-test-only",
        source: "lagoslife",
        lagoslife: { name: "Ola" },
      }),
    ),
  );
const save = (unlocked) => ({
  schema: 3,
  unlocked,
  lastClaim: claimedToday(),
});

test("no email is asked for before two levels are passed", async ({ page }) => {
  const state = { email: null, tickets: [] };
  await mockServer(page, state);
  await signedIn(page);
  await boot(page, save(2));
  await page.waitForTimeout(1200);
  await expect(page.locator("#ovEmail")).not.toHaveClass(/show/);
  await page.evaluate(() => window.__mp.Game.start(window.__mp.levelCfg(2)));
  await expect(page.locator("#ovEmail")).not.toHaveClass(/show/);
});

test("after two levels the email popup must be answered, then play goes on", async ({
  page,
}) => {
  const state = { email: null, tickets: [] };
  await mockServer(page, state);
  await signedIn(page);
  const errors = await boot(page, save(3));
  const popup = page.locator("#ovEmail");
  await expect(popup).toHaveClass(/show/);

  // Nothing starts until it is answered.
  await page.evaluate(() => window.__mp.Game.start(window.__mp.levelCfg(3)));
  expect(await page.evaluate(() => window.__mp.Game.state)).not.toBe("playing");

  await page.locator("#emailInput").fill("not an email");
  await page.locator("#emailSubmit").click();
  await expect(page.locator("#emailError")).toContainText("valid email");
  await expect(popup).toHaveClass(/show/);

  await page.locator("#emailInput").fill("ola@example.test");
  await page.locator("#emailSubmit").click();
  await expect(popup).not.toHaveClass(/show/);
  expect(state.email).toBe("ola@example.test");
  // The level that was waiting starts by itself.
  await page.waitForFunction(() => window.__mp.Game.state === "playing");
  expect(errors).toEqual([]);
});

test("a player with an email is never asked", async ({ page }) => {
  const state = { email: "known@example.test", tickets: [] };
  await mockServer(page, state);
  await signedIn(page);
  await page.addInitScript(() => {
    const me = JSON.parse(localStorage.getItem("mamaPutRush3D.online"));
    me.email = "known@example.test";
    localStorage.setItem("mamaPutRush3D.online", JSON.stringify(me));
  });
  await boot(page, save(9));
  await page.waitForTimeout(1200);
  await expect(page.locator("#ovEmail")).not.toHaveClass(/show/);
});

test("with no connection the popup cannot trap the player", async ({
  page,
}) => {
  const state = { email: null, tickets: [], offline: true };
  await mockServer(page, state);
  await signedIn(page);
  await boot(page, save(3));
  await expect(page.locator("#ovEmail")).toHaveClass(/show/);
  await expect(page.locator("#emailLater")).toBeHidden();
  await page.locator("#emailInput").fill("ola@example.test");
  await page.locator("#emailSubmit").click();
  await expect(page.locator("#emailError")).toContainText("reach the server");
  await page.locator("#emailLater").click();
  await expect(page.locator("#ovEmail")).not.toHaveClass(/show/);
});

test("support opens from home and the map, sends a message and shows replies", async ({
  page,
}) => {
  const state = {
    email: "known@example.test",
    tickets: [
      {
        id: 9,
        category: "payment",
        status: "answered",
        unread: true,
        messages: [
          { id: 1, body: "Where are my coins?", support: false },
          { id: 2, body: "They are back now.", support: true },
        ],
      },
    ],
  };
  await mockServer(page, state);
  await signedIn(page);
  const errors = await boot(page, save(1));

  // A reply waiting shows a dot on More, and on Support inside it.
  await expect(page.locator("#moreDot")).toBeVisible();
  await page.locator("#btnMore").click();
  await expect(page.locator("#supportDot")).toBeVisible();
  await page.locator("#btnSupport").click();
  const panel = page.locator("#ovSupport");
  await expect(panel).toHaveClass(/show/);
  await expect(panel).toContainText("They are back now.");
  await expect(page.locator("#supportDot")).toBeHidden();
  await expect(page.locator("#moreDot")).toBeHidden();

  await expect(page.locator("#supportSend")).toBeDisabled();
  await page.locator("#supportTopic").selectOption("complaint");
  await page.locator("#supportText").fill("The okada game froze on me");
  await page.locator("#supportSend").click();
  await expect(panel).toContainText("The okada game froze on me");
  await expect(panel).toContainText("Waiting for us");
  await expect(page.locator("#supportText")).toHaveValue("");
  expect(state.tickets[0].category).toBe("complaint");
  await page.locator("#supportClose").click();
  await expect(panel).not.toHaveClass(/show/);

  await page.locator("#btnPlay").click({ force: true });
  await expect(page.locator("#scrMap")).toHaveClass(/show/);
  await page.locator("#mapSupport").click();
  await expect(panel).toHaveClass(/show/);
  expect(errors).toEqual([]);
});
