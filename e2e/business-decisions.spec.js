import { test, expect } from "@playwright/test";
import { boot, claimedToday, startLevel, waitPlaying } from "./helpers.js";

const fresh = (patch = {}) => ({
  schema: 3,
  lastClaim: claimedToday(),
  ...patch,
});

test("an opportunity card on the menu goes into the decision journal", async ({
  page,
}) => {
  await boot(
    page,
    fresh({
      day: 5,
      coins: 200000,
      unlocked: 16,
      branches: ["ch0", "ch1"],
      place: "ch1",
    }),
  );
  await expect(page.locator("#ovOffer")).toHaveClass(/show/, {
    timeout: 10_000,
  });
  await expect(page.locator("#offerExpect")).toContainText("Expected");
  await page.locator("#offerA").click();
  await expect(page.locator("#ovOffer")).not.toHaveClass(/show/);
  const journal = await page.evaluate(() => window.__mp.Save.d.journal);
  expect(journal).toHaveLength(1);
  await page.locator("#btnGrow").click({ force: true });
  await page.locator("#growBooks").click();
  await expect(page.locator("#booksList")).toContainText("Your decisions");
  await expect(page.locator("#booksList")).toContainText(journal[0].title);
});

test("prices, catering contracts and a disruption", async ({ page }) => {
  await boot(
    page,
    fresh({
      day: 1,
      coins: 200000,
      unlocked: 16,
      branches: ["ch0", "ch1"],
      place: "ch1",
    }),
  );
  // Prices: premium at this restaurant.
  await page.locator("#btnMarket").click({ force: true });
  await page.locator(".priceLevels .btn", { hasText: "Premium" }).click();
  expect(await page.evaluate(() => window.__mp.Save.d.prices.ch1)).toBe(
    "premium",
  );
  await page.locator("#marketClose").click({ force: true });
  // Contracts: take one for the next shift.
  await page.locator("#btnGrow").click({ force: true });
  await page.locator("#growList .card.contract .btn").first().click();
  const k = await page.evaluate(() => window.__mp.Save.d.contract);
  expect(k.portions).toBeGreaterThan(0);
  await page.locator("#growClose").click({ force: true });
  // The contract arrives in the next level; a disruption asks for a choice.
  await startLevel(page, 15);
  await waitPlaying(page);
  expect(await page.evaluate(() => window.__mp.Game.contract?.event)).toBe(
    k.event,
  );
  expect(await page.evaluate(() => window.__mp.Game.priceFactor)).toBeCloseTo(
    1.2,
  );
  await page.evaluate(() =>
    window.__mp.Game.announce({
      id: "gas",
      icon: "🔥",
      title: "Gas is running low",
      text: "test",
      choices: [
        { id: "refill", label: "Refill now", cost: 6000, effect: {} },
        {
          id: "risk",
          label: "Manage it",
          cost: 0,
          effect: { cook: 0.7 },
          note: "slower",
        },
      ],
    }),
  );
  await expect(page.locator("#ovDisrupt")).toHaveClass(/show/);
  await page.locator("#disrupt1").click();
  await expect(page.locator("#ovDisrupt")).not.toHaveClass(/show/);
  expect(await page.evaluate(() => window.__mp.Game.fx.cook)).toBeCloseTo(0.7);
  expect(await page.evaluate(() => window.__mp.Game.state)).toBe("playing");
});
