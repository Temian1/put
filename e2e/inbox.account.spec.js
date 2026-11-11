import { test, expect } from "@playwright/test";
import { boot, claimedToday } from "./helpers.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
};

const notes = () => [
  {
    id: 2,
    type: "passed",
    title: "Bisi passed you on Top Bukas",
    body: "You're now #6. Take your place back!",
    at: new Date().toISOString(),
    read: false,
    reward: 0,
    claimed: false,
    canReply: true,
    from: { id: 8, name: "Bisi" },
    board: "sales",
  },
  {
    id: 1,
    type: "announcement",
    title: "Weekend bonus",
    body: "Thanks for playing!",
    at: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    reward: 25,
    claimed: false,
    canReply: false,
    from: null,
    board: null,
  },
];

async function mockServer(page, state) {
  await page.route("https://api.mock/mamaput/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/mamaput", "");
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: CORS });
    const send = (json, status = 200) =>
      route.fulfill({ status, headers: CORS, json });
    if (path === "/me")
      return send({
        id: 1,
        name: "Ola",
        source: "lagoslife",
        email: "ola@example.test",
        inboxUnread: state.notes.filter((n) => !n.read).length,
        supportUnread: 0,
        wallet: { coins: state.coins },
      });
    if (path === "/inbox") return send({ notes: state.notes });
    if (path === "/inbox/read") {
      state.notes.forEach((n) => (n.read = true));
      return send({ ok: true });
    }
    if (path === "/inbox/1/claim") {
      state.notes[1].claimed = true;
      state.coins += 25;
      return send({
        coins: 25,
        wallet: { coins: state.coins },
        notes: state.notes,
      });
    }
    if (path === "/inbox/2/reply") {
      state.reply = req.postDataJSON().message;
      state.notes[0].canReply = false;
      return send({ notes: state.notes });
    }
    if (path === "/inbox/2/mute") {
      state.muted = true;
      return send({ notes: state.notes });
    }
    if (path === "/leaderboard") return send({ rows: [], players: 0 });
    return send({});
  });
}

test("the bell shows unread news, pays rewards and lets you answer a rival", async ({
  page,
}) => {
  const state = { notes: notes(), coins: 0 };
  await mockServer(page, state);
  await page.addInitScript(() =>
    localStorage.setItem(
      "mamaPutRush3D.online",
      JSON.stringify({
        id: 1,
        name: "Ola",
        token: "fake-test-only",
        source: "lagoslife",
        email: "ola@example.test",
      }),
    ),
  );
  const errors = await boot(page, {
    schema: 3,
    unlocked: 6,
    lastClaim: claimedToday(),
  });

  await expect(page.locator("#inboxBadge")).toHaveText("2");
  await expect(page.locator("#menuName")).toHaveText("Ola");
  await page.locator("#btnInbox").click();
  const inbox = page.locator("#ovInbox");
  await expect(inbox).toHaveClass(/show/);
  await expect(inbox).toContainText("Bisi passed you on Top Bukas");
  await expect(page.locator("#inboxBadge")).toBeHidden();

  await inbox.getByRole("button", { name: "Claim 25 coins" }).click();
  await expect(inbox.getByRole("button", { name: "Claimed ✓" })).toBeDisabled();
  expect(state.coins).toBe(25);

  // Quick emoji plus a short message, answered once.
  await inbox.getByRole("button", { name: "Add 😤" }).click();
  await page.getByLabel("Reply to Bisi").press("End");
  await page.getByLabel("Reply to Bisi").type(" I go collect am back");
  await inbox.getByRole("button", { name: "Send" }).click();
  await expect(inbox).toContainText("Replied ✓");
  expect(state.reply).toBe("😤 I go collect am back");

  await inbox.getByRole("button", { name: "Mute Bisi" }).click();
  await expect.poll(() => state.muted).toBe(true);

  await inbox.getByRole("button", { name: "See ranks" }).click();
  await expect(page.locator("#ovBoard")).toHaveClass(/show/);
  await expect(inbox).not.toHaveClass(/show/);
  expect(errors).toEqual([]);
});
