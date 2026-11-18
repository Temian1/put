import { test, expect } from "@playwright/test";
import { boot, claimedToday } from "./helpers.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
};

async function mockServer(page, state) {
  await page.route("https://api.mock/mamaput/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/mamaput", "");
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: CORS });
    const profile = () => ({
      id: 1,
      name: "Ola",
      source: "lagoslife",
      email: state.email === undefined ? "ola@example.test" : state.email,
      inboxUnread: 0,
      supportUnread: 0,
      airtime: state.saved,
      wallet: { coins: 0 },
    });
    const send = (json, status = 200) =>
      route.fulfill({ status, headers: CORS, json });
    if (path === "/me") return send(profile());
    if (path === "/me/email") {
      state.email = req.postDataJSON().email;
      return send(profile());
    }
    if (path === "/airtime") {
      state.posted = req.postDataJSON();
      state.saved = { phone: "0912****567", network: "glo", status: "pending" };
      return send(profile());
    }
    return send({});
  });
}

const signedIn = (page, email = "ola@example.test") =>
  page.addInitScript(
    (email) =>
      localStorage.setItem(
        "mamaPutRush3D.online",
        JSON.stringify({
          id: 1,
          name: "Ola",
          token: "fake-test-only",
          source: "lagoslife",
          email,
        }),
      ),
    email,
  );

test("email must be saved before even a level-one player can enter their phone", async ({
  page,
}) => {
  const state = { saved: null, email: null };
  await mockServer(page, state);
  await signedIn(page, null);
  await boot(page, {
    schema: 3,
    unlocked: 1,
    lastClaim: claimedToday(),
    quality: "low",
  });
  await expect(page.locator("#ovEmail")).toHaveClass(/show/);
  await expect(page.locator("#ovAirtime")).not.toHaveClass(/show/);
  await expect(page.locator("#airtimePhone")).toBeDisabled();
  expect(state.posted).toBeUndefined();
  await page.locator("#emailInput").fill("ola@example.test");
  await page.locator("#emailSubmit").click();
  await expect(page.locator("#ovAirtime")).toHaveClass(/show/);
  await expect(page.locator("#airtimePhone")).toBeEnabled();
  expect(state.email).toBe("ola@example.test");
});

test("the airtime invite detects the network, saves once and never returns", async ({
  page,
}) => {
  const state = { saved: null };
  await mockServer(page, state);
  await signedIn(page);
  const errors = await boot(page, {
    schema: 3,
    unlocked: 12,
    lastClaim: claimedToday(),
  });

  const popup = page.locator("#ovAirtime");
  await expect(popup).toHaveClass(/show/);
  await expect(popup).toContainText("level 55");
  await expect(page.locator("#airtimeLevel")).toContainText(
    "43 more to reach the draw",
  );

  await page.locator("#airtimePhone").fill("123");
  await page.locator("#airtimeSubmit").click();
  await expect(page.locator("#airtimeError")).toContainText("Nigerian mobile");

  // The prefix picks Airtel; the player says it moved to Glo.
  await page.locator("#airtimePhone").fill("+234 912 345 6567");
  await expect(popup.locator('[data-net="airtel"]')).toHaveClass(/on/);
  await expect(page.locator("#airtimeHint")).toContainText("Airtel");
  await popup.locator('[data-net="glo"]').click();
  await expect(popup.locator('[data-net="glo"]')).toHaveClass(/on/);
  await page.locator("#airtimeSubmit").click();

  await expect(popup).not.toHaveClass(/show/);
  expect(state.posted).toEqual({ phone: "09123456567", network: "glo" });

  // A new day and a fresh start: the number is known, so no invite.
  await page.evaluate(() => {
    window.__mp.Save.d.airtimeAsked = "2000-1-1";
    window.__mp.Save.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.__mp?.Game);
  await page.waitForTimeout(2500);
  await expect(popup).not.toHaveClass(/show/);
  expect(errors).toEqual([]);
});

test("without a number the invite comes once a day, and Not now waits for tomorrow", async ({
  page,
}) => {
  const state = { saved: null };
  await mockServer(page, state);
  await signedIn(page);
  await boot(page, { schema: 3, unlocked: 56, lastClaim: claimedToday() });

  const popup = page.locator("#ovAirtime");
  await expect(popup).toHaveClass(/show/);
  await expect(page.locator("#airtimeLevel")).toContainText("in the draw");
  await page.locator("#airtimeLater").click();
  await expect(popup).not.toHaveClass(/show/);

  // Same day: back to the menu, no second invite.
  await page.evaluate(() => window.__mp.showMenu?.());
  await page.reload();
  await page.waitForFunction(() => window.__mp?.Game);
  await page.waitForTimeout(2500);
  await expect(popup).not.toHaveClass(/show/);

  // Next day: it asks again.
  await page.evaluate(() => {
    window.__mp.Save.d.airtimeAsked = "2000-1-1";
    window.__mp.Save.save();
  });
  await page.reload();
  await expect(popup).toHaveClass(/show/, { timeout: 15_000 });
});

test("the invite waits for the daily reward to be collected first", async ({
  page,
}) => {
  const state = { saved: null };
  await mockServer(page, state);
  await signedIn(page);
  await boot(page, { schema: 3, unlocked: 5, lastClaim: "2000-1-1" });

  await expect(page.locator("#ovReward")).toHaveClass(/show/);
  await expect(page.locator("#ovAirtime")).not.toHaveClass(/show/);
  await page.locator("#rewardClaim").click({ force: true });
  await expect(page.locator("#ovAirtime")).toHaveClass(/show/, {
    timeout: 10_000,
  });
});
