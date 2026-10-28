import { test, expect } from "@playwright/test";
import { boot } from "./helpers.js";

test("a new player is shown how to play, then gets the daily reward", async ({
  page,
}) => {
  const errors = await boot(page, { schema: 3, guideSeen: false });
  const guide = page.locator("#ovGuide");
  await expect(guide).toHaveClass(/show/);
  await expect(page.locator("#ovReward")).not.toHaveClass(/show/);
  await expect(page.locator("#guideBack")).toBeDisabled();
  for (let i = 0; i < 5; i++)
    await page.locator("#guideNext").click({ force: true });
  await expect(page.locator("#guideNext")).toHaveText(/Let's cook!/);
  await page.locator("#guideNext").click({ force: true });
  await expect(guide).not.toHaveClass(/show/);
  await expect(page.locator("#ovReward")).toHaveClass(/show/);
  expect(await page.evaluate(() => window.__mp.Save.d.guideSeen)).toBe(true);

  // The ⓘ button in the header opens it again from the first page.
  await page.locator("#rewardClaim").click({ force: true });
  await page.locator("#btnHelp").click({ force: true });
  await expect(guide).toHaveClass(/show/);
  await expect(page.locator("#ovGuide .guidePage").first()).toBeVisible();
  await page.locator("#guideSkip").click({ force: true });
  await expect(guide).not.toHaveClass(/show/);
  expect(errors).toEqual([]);
});
