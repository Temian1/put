import { test, expect } from "@playwright/test";

test("installable manifest and offline reload", async ({ page, context }) => {
  await page.goto("./");
  await expect(page.locator("#boot")).toHaveClass(/gone/, { timeout: 30_000 });
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    return (await fetch(href)).json();
  });
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i) => i.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  // Wait until the service worker controls the page and has cached the shell.
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  await page.reload();
  await expect(page.locator("#boot")).toHaveClass(/gone/, { timeout: 30_000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#boot")).toHaveClass(/gone/, { timeout: 30_000 });
  await expect(page.locator("#btnPlay")).toBeVisible();
  await context.setOffline(false);
});
