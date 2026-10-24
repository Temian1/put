import { test, expect } from "@playwright/test";
import { boot, claimedToday, startLevel } from "./helpers.js";

test("all 21 painted food icons load on the map, food buttons and order bubbles", async ({
  page,
}) => {
  const errors = await boot(page, { schema: 2, lastClaim: claimedToday() });
  const { manifest, foods } = await page.evaluate(async () => ({
    manifest: await (
      await fetch(new URL("food/manifest.json", location.href))
    ).json(),
    foods: Object.fromEntries(
      Object.entries(window.__mp.FOODS).map(([id, food]) => [id, food.img]),
    ),
  }));
  expect(Object.keys(manifest).sort()).toEqual(Object.keys(foods).sort());
  expect(Object.keys(foods)).toHaveLength(21);
  for (const [id, file] of Object.entries(manifest))
    expect(foods[id]).toBe("/put/food/" + file);
  const dimensions = await page.evaluate(
    async (urls) =>
      Promise.all(
        urls.map(
          (src) =>
            new Promise((resolve) => {
              const image = new Image();
              image.onload = () =>
                resolve([image.naturalWidth, image.naturalHeight]);
              image.onerror = () => resolve(null);
              image.src = src;
            }),
        ),
      ),
    Object.values(foods),
  );
  expect(dimensions.every((size) => size?.[0] === 256 && size[1] === 256)).toBe(
    true,
  );
  await page.locator("#btnPlay").click({ force: true });
  const mapSources = await page
    .locator(".chap .foods img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  expect(mapSources.length).toBeGreaterThan(0);
  expect(
    mapSources.every(
      (src) => src.startsWith("/put/food/") && src.endsWith(".webp"),
    ),
  ).toBe(true);
  await startLevel(page, 1);
  const buttonSources = await page
    .locator(".food img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  expect(
    buttonSources.every(
      (src) => src.startsWith("/put/food/") && src.endsWith(".webp"),
    ),
  ).toBe(true);
  await expect
    .poll(() => page.locator(".bubble .it img").count(), { timeout: 20_000 })
    .toBeGreaterThan(0);
  const bubbleSources = await page
    .locator(".bubble .it img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  expect(
    bubbleSources.every(
      (src) => src.startsWith("/put/food/") && src.endsWith(".webp"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("a failed painted image keeps the procedural thumbnail fallback", async ({
  page,
}) => {
  await page.route("**/food/manifest.json", (route) =>
    route.fulfill({ json: { jollof: "missing-food-test.webp" } }),
  );
  await page.route("**/food/missing-food-test.webp", (route) => route.abort());
  const errors = await boot(page, { schema: 2, lastClaim: claimedToday() });
  expect(await page.evaluate(() => window.__mp.FOODS.jollof.img)).toMatch(
    /^data:image\/png/,
  );
  await startLevel(page, 1);
  await expect(page.locator('.food[data-id="jollof"] img')).toHaveAttribute(
    "src",
    /^data:image\/png/,
  );
  expect(errors).toEqual([]);
});
