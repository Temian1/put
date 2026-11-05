import { test, expect } from "@playwright/test";
import { boot, claimedToday } from "./helpers.js";

test("visitors and cached guests cannot enter any game or close the sign-in gate", async ({
  page,
}) => {
  const requested = [];
  await page.addInitScript(() =>
    localStorage.setItem(
      "mamaPutRush3D.online",
      JSON.stringify({
        id: 1,
        name: "Mama Put 1234",
        token: "old-guest",
        source: "guest",
      }),
    ),
  );
  await page.route("https://api.mock/mamaput/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/mamaput",
      "",
    );
    requested.push(path);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      json:
        path === "/config"
          ? { accounts: { guests: true, lagoslife: true } }
          : {},
    });
  });
  const errors = await boot(page, { schema: 3, lastClaim: claimedToday() });
  const account = page.locator("#ovAccount");
  await expect(account).toHaveClass(/show/);
  await page.locator("#accClose").click();
  await expect(account).toHaveClass(/show/);
  for (const id of ["#btnPlay", "#btnMatch", "#btnRun"]) {
    await page.locator(id).dispatchEvent("click");
    await expect(account).toHaveClass(/show/);
    expect(await page.evaluate(() => window.__mp.Game.state)).not.toBe(
      "playing",
    );
    expect(await page.evaluate(() => window.__mp.sideActive())).toBe(false);
  }
  await page.evaluate(() => window.__mp.Game.start(window.__mp.levelCfg(1)));
  expect(await page.evaluate(() => window.__mp.Game.state)).not.toBe("playing");
  expect(requested).not.toContain("/players");
  expect(errors).toEqual([]);
});
