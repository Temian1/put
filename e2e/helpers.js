import { expect } from "@playwright/test";

export const SAVE_KEY = "mamaPutRush3D.v1";

// Opens the game with an optional pre-made save and waits for the 3D boot.
// Journeys skip the first-launch guide unless the save asks for it.
export async function boot(page, save) {
  save = save ? { guideSeen: true, ...save } : { schema: 3, guideSeen: true };
  if (save)
    await page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem(key, value);
          sessionStorage.setItem("seeded", "1");
        }
      },
      [SAVE_KEY, JSON.stringify(save)],
    );
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.locator("#boot")).toHaveClass(/gone/, { timeout: 30_000 });
  await page.waitForFunction(() => window.__mp);
  return errors;
}

export async function collectReward(page) {
  const reward = page.locator("#ovReward");
  await expect(reward).toHaveClass(/show/);
  await page.locator("#rewardClaim").click({ force: true });
  await expect(reward).not.toHaveClass(/show/);
}

// Already claimed today, so no reward popup interrupts the journey.
export const claimedToday = () => {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
};

export const startLevel = (page, n) =>
  page.evaluate((n) => {
    const { Game, Save, levelCfg } = window.__mp;
    Save.d.unlocked = Math.max(Save.d.unlocked, n);
    Game.start(levelCfg(n));
  }, n);

export const waitPlaying = (page) =>
  page.waitForFunction(() => window.__mp.Game.state === "playing", null, {
    timeout: 15_000,
  });

// Reads the most urgent customer's next servable item from the bubble state.
export const nextNeed = (page) =>
  page.evaluate(() => {
    const { Game, FOODS } = window.__mp;
    const w = Game.customers
      .filter((c) => c.state === "wait")
      .sort((a, b) => a.p / a.max - b.p / b.max)[0];
    if (!w) return null;
    const ready = w.order.every((o) => o.layer !== 0 || o.drink || o.done);
    const it = w.order.find((o) => !o.done && (o.layer !== 1 || ready));
    return it ? { id: it.f, name: FOODS[it.f].name } : null;
  });

export const gameState = (page) =>
  page.evaluate(() => {
    const G = window.__mp.Game;
    return {
      state: G.state,
      won: G.won,
      served: G.served,
      lost: G.lost,
      mistakes: G.mistakes,
    };
  });

// Plays through the real food buttons, clearing tables and washing like a player.
export async function playByTapping(page, { maxMs = 80_000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(() => {
      const G = window.__mp.Game;
      return {
        state: G.state,
        dirty: G.dirty.findIndex(Boolean),
        plates: G.sink.plates,
        washing: G.sink.washing,
        dishes: !!G.cfg.dishes,
      };
    });
    if (s.state === "over" || s.state === "ending") return;
    if (s.state === "playing") {
      if (s.dishes && s.plates >= 3 && !s.washing)
        await page.locator("#btnWash").click({ force: true });
      else if (s.dirty >= 0)
        await page.locator(".dirtyChip").first().dispatchEvent("pointerdown");
      const need = await nextNeed(page);
      if (need) {
        const btn = page.locator(`.food[data-id="${need.id}"]`);
        const stage = await btn.getAttribute("data-stage");
        if (stage !== "cooking") await btn.dispatchEvent("pointerdown");
      }
    }
    await page.waitForTimeout(280);
  }
}
