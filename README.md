# Mama Put Rush 3D

A Nigerian buka cooking game in React 18 + JavaScript with imperative Three.js **0.149.0**, Vite and SVG button icons. Serve real mama put food at Lagos prices, in naira, from a roadside buka to a food empire.

## Run

Use Node.js 22 LTS (22.14+ recommended) and npm.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173/put/**. For a production build:

```sh
npm run lint
npm test            # unit tests (Vitest)
npm run test:e2e    # browser journeys + offline PWA check (Playwright)
npm run build
npm run preview
```

Preview: **http://127.0.0.1:4173/put/**. `npm run format` formats the source.

Playwright needs a browser once: `npx playwright install chromium`. To use an installed Chrome instead, set `PW_CHANNEL=chrome` (PowerShell: `$env:PW_CHANNEL="chrome"`). `npm run test:visual` compares panel screenshots against baselines in `e2e/__screenshots__`; baselines depend on the machine's fonts, so refresh them with `npm run test:visual -- --update-snapshots` on a new machine.

## Play

- Choose PLAY, then an unlocked level on the map. Tap a food button or its 3D station; keyboard **1–9** also serves. Tap a customer or bubble to pick who gets the food.
- **Money is naira.** Each dish costs what a working-class Lagos mainland buka charges: rice and stew ₦800, beef ₦600, dodo ₦500, fried chicken ₦2,500, pure water ₦100. A typical plate comes to ₦1,500–₦2,500. Bills round to the nearest ₦50.
- **The menu is real mama put food:** jollof, fried rice, rice and stew, ewa agoyin, eba, amala, pounded yam, egusi, efo riro, ewedu and gbegiri, goat pepper soup, beef, fried chicken, fried fish, boiled egg, dodo, moi moi, pure water, zobo, mineral and malt.
- Mechanics unlock gradually and a pointing hand teaches each one the first time:
  - **Levels 1–2:** tap what customers want.
  - **Level 3 (plate assembly):** dish the main first; meat, dodo and soup go on top ("Jollof first!"). Every swallow comes with a soup. Tapping a topping too early is a hint, not a mistake.
  - **Level 4 (cooking stages):** dodo, chicken and fish must be fried. Tap to start frying; the finished batch goes straight into stock (e.g. 4 portions of dodo) and stays there until served.
  - **Level 6 (food finishes):** every pot, basin and cooler holds a batch (e.g. 8 plates of rice) that runs out. A finished food shows **Finished!**; tap it to cook a new batch, which costs ingredients (30% of menu price). Customers waiting only on finished food complain, lose patience faster and hurt your reputation.
  - **Level 11 (dishwashing):** served customers leave dirty plates. Tap **Clear** (or the tray) to move a plate to the sink; the lane stays closed until you do. The sink holds four plates. Tap the blue sink button on the left rail (or press **W**) to wash.
  - **Level 15 (online orders):** orders pop up with a notification and appear as cards above the food buttons, with a deadline. Tap a card to select it, tap foods to pack them, then **Pack & send**. Packs cost ₦150 each. A hired dispatch rider delivers free; with none free, an outside rider is called for ₦1,000. Late orders are cancelled and cost reputation.
  - **Level 27 onward (catering events):** birthday parties, naming ceremonies, child dedications, owambe weddings, burial receptions, house warmings and chieftaincy titles order in bulk (8–16 portions) for a 40% premium. The day cannot close until the event is delivered or runs out of time.
- **Boosters** (one of each to start, more in the shop): *Freeze Time* stops the clock and patience for 8 s, *Auto-Serve* completes the most urgent order, *Patience Boost* refills everyone waiting.
- **Customers** all have Nigerian names (Chief, Alhaji and Odogwu titles included). Schoolkids, okada riders, danfo conductors, Alhaji and the **Odogwu** (buys something small, then says "Keep the change!" and tips ₦2,000–₦5,000) join the regulars, VIPs and wedding guests. Some show a mood (😌 calm, 🤤 hungry, 💸 generous, 😤 grumpy).
- **Reputation (★ 0–100, menu top bar):** fast, correct service raises it; lost customers, wrong food, complaints and late deliveries lower it. Higher reputation brings customers more often and bigger tips; low reputation means fewer customers.
- **Staff** (Menu → Staff, or Shop → Staff): Chidi and Tunde serve and pack orders, Aunty Bisi clears and washes, Iya Basira cooks when pots or pans finish, Emeka and Musa are dispatch riders, Ngozi runs market errands (restocks drinks, ingredients 20% cheaper). Salaries are paid after every shift from that shift's cash, then savings. A worker unpaid three shifts in a row quits. Put staff off duty, or **Sack** them, to save money.
- **End of shift:** the summary lists sales, ingredients, takeaway packs, outside riders, salaries, branch income and the change in reputation. A failed shift still keeps the sales made and still pays its bills.
- **Restaurants (Grow screen and map):** every chapter is a restaurant, and you pay to open it. Beat level 10 and you can open Junction Food Spot in Yaba for ₦50,000. Level 11 stays locked until you pay. The costs rise to ₦2.5m for Food Empire HQ in Ikoyi. Opened restaurants earn money after every shift (less when reputation is low). From Grow you can **Play** an old restaurant's levels again or **Visit** it, which shows that restaurant on the menu. Your business level (Roadside Buka → Food Empire) still comes from lifetime sales and reputation.
- **Left rail in levels:** zoom in/out (also mouse wheel or two-finger pinch), boosters and the sink.
- **Missions:** three new daily missions with naira rewards, plus lifetime achievements. The menu badge shows how many are ready to claim.
- Upgrades, outfits, decor, daily login reward, daily challenge (₦6,000 win bonus) and Endless Rush (after level 50) remain.
- **Menu header:** reputation ★ and your cash; the green arrow on the cash pill opens Upgrades and the shop.
- **Leaderboard** (menu): rank against rival bukas across Nigeria by lifetime sales, stars and Endless best. Rivals are simulated in the game; a global online board would need a server.
- **Escape** pauses. The game pauses when its tab is hidden. Settings has sound, music, vibration and graphics toggles.

## Running a food empire

The game runs for **100 levels in 10 chapters**. After the Mama Put Empire (levels 41–50) come Ikeja City Restaurant, Port Harcourt Branch, Abuja Food Court, Catering Company and Food Empire HQ, with up to nine dishes and 37 customers a shift. A bigger business also brings 2 more customers per business level to every shift.

- **Visible staff:** hired workers live in the back kitchen, the floor between the pots and the food buttons. They walk to the job and do it on arrival:
  - Cooks and servers step up to the pots.
  - The cleaner walks round the bench to clear counters and tables, then washes at the sink.
  - Ngozi walks off to the market and comes back with stock.
  - Riders wait beside their okadas at the roadside and ride off with deliveries.
- **Buka equipment (Shop → Buka):** plastic tables and chairs, deep freezer, gas burners, bigger pots, double sink, handwash station, uniforms, store shelves, lit signboard, delivery okadas and a catering bus. Everything appears in the scene and most items have upkeep.
  - Each okada lets one hired rider deliver free.
  - Without a bus, every event delivery hires one for ₦8,000.
- **Seating:** served customers take a free chair, sit, eat, then leave a plate on the table to be cleared (tap the round chip, or the cleaner does it). Movement uses path following with arrival and separation steering, so customers slow into their seat and step around each other.
- **Market (menu):** buy ingredients (rice, beans, swallow, pepper and leaves, meat and fish, chicken, plantain, drinks) for your store.
  - Every cooked batch uses one unit. With none in store you pay 40% more on the spot, or 60% more when the market is sold out.
  - Prices rise a little every shift, with occasional shocks (fuel price, exchange rate, floods).
  - Perishables lose a quarter each shift without a deep freezer.
- **Haggling (from level 8):** some customers argue the bill: "₦1,400 too much! ₦900?". Accept, meet halfway (they may insist) or refuse (they may pay full price grumbling, or walk out). Waiting too long counts as refusing.
- **Hygiene and health inspectors (from level 20):** the rail shows hygiene (0–100). Dirty plates, a full sink and customers stuck waiting lower it; a cleaner, a handwash station, uniforms and a freezer raise it. Inspectors from the environmental health office visit some shifts:
  - **Pass:** reputation goes up.
  - **Warning:** no fine, but you're told to clean up.
  - **Fine:** you pay a hygiene fine.
  - **Very dirty:** a bigger fine and the loss of a life.
- **Bills and taxes:** every shift pays the LGA levy, rent and NEPA light, and equipment upkeep. From Popular Joint up you also pay 7.5% VAT on sales. Bills you can't pay become debt, repaid first from later shifts. Every shift in debt costs reputation and brings fewer customers.
- **Decline:** reputation falls if the buka stays closed (up to 15 points for long absences), and branch income shrinks with low reputation. Business level is set by reputation and lifetime sales, so a struggling business drops back down the levels.
- **Growth is slow on purpose:** business levels need ₦250k, ₦1.2m, ₦4m and ₦12m in lifetime sales. Branches cost ₦150k–₦6m, an okada ₦450k+ and the bus ₦2.5m. The street fills with more stalls, buildings, people and traffic as you grow.

## Restaurants, staff and managers

- **Staff per restaurant:** every restaurant has its own crew. Hire them in Shop → Staff, picking the restaurant at the top. You can hire up to 3 servers, 2 cooks, 2 cleaners, 2 riders and 1 market errand per restaurant. Each extra hire of a job gets a new Nigerian name. Staff only work, and are only paid, when you play at their restaurant.
- **Managers:** Junior, Experienced and Expert managers run a restaurant while you play elsewhere. They earn 55%, 80% or 100% of its potential, take a cut, and pay its staff. A good manager turns extra staff into profit. The takings go into the manager's safe, which holds 12 shifts of money. Collect it in Grow (the Grow button shows how much is waiting). Without a manager an old restaurant stays shut while you are away. At the restaurant you are playing, a manager also cuts waste on ingredients and packs.
- **Serving:** a server collects every ready dish of a customer's order along the bench and serves it in one trip.
- **Seating:** any clean chair can be used from level 1, by VIPs too. A dirty plate only blocks its own chair.
- **Litter (level 13+):** customers and passers-by drop nylon, sachets, bones and paper on the dining floor. Tap the brown broom buttons to sweep it, or hire a cleaner. Litter lowers hygiene. When the place is dirty, customers complain and lose patience, fewer people come, and three or more complaints cost reputation. Inspectors fine low hygiene.
- **Renovate the building (Shop → Buka):** tiles and paint, then standing fans, then air-conditioning. Each level adds hygiene, cuts litter and makes customers more patient.
- **Camera:** drag empty floor to look around, pinch or use the rail buttons to zoom, and tap the target button to re-centre.
- **Modals:** every modal scrolls with a finger drag on small phones.

## Online backend and admin (war.kikter.com)

The frontend (Vercel, https://mamaput-phi.vercel.app) talks to the Kikter Games Laravel app at **https://war.kikter.com/api/mamaput**. Admins manage the game in Filament at **https://war.kikter.com/admin**, under **Mama Put Rush**:

- **Players:** every player with how they sign in (guest, Kikter account, Lagos Life or both), business level, level reached, lifetime sales, cash, reputation, stars, restaurants, staff, shifts and last seen. Admins can:
  - edit name, cash, reputation and level unlocked (the game applies it on its next sync)
  - link a player to a Kikter account
  - add or take away coins from their wallet
  - ban or unban, reset progress, or delete
  - view the full cloud save
- **Shifts:** every shift the game reports (mode, level, won, served, sales, cash, stars, duration). Shifts that look impossible are flagged and counted in the sidebar badge.
- **Settings:** maintenance mode, menu announcement, leaderboard on/off, starting cash, daily rewards and bonus, all 21 menu prices, each restaurant's opening cost and income, multipliers for equipment, staff and boosters, VAT rate, levy and rent, market inflation, news headline and sold-out items, and switches for haggling, inspections, online orders and events (plus inspection chance).
- **Accounts & Lagos Life (Settings tab):** allow or block guest play, switch Lagos Life sign-in on or off, coins per won shift and daily cap, naira per coin and smallest swap, Lagos Life coin packs (product ID, name, coins), and optional separate Lagos Life keys if Mama Put is registered as its own Lagos Life game (otherwise it uses the Lagos War keys).
- **Coin ledger:** every wallet change: won shifts, swaps for naira, Lagos Life purchases, linked wallets and admin adjustments.
- **Dashboard:** a Mama Put Rush stats row (players, active today, shifts, sales, status).

How the game uses it:

- **Guest play:** on first start the game creates a guest player and keeps its token in the browser. Players can rename their buka in Settings, and that name shows on the leaderboard.
- **Sign-in (account button, top left):** log in or create a Kikter account. It is the same account Lagos War uses, so the coin balance is shared. Signing in merges this phone's guest progress into the account. Every device signed in to the account shares one save. Logging out leaves the progress on the account and starts this phone as a fresh guest.
- **Lagos Life:** when the game runs inside Lagos Life (in a frame from lagoslife.app, or with `?lagoslife=1`), it loads the Vatar SDK and signs in with the Lagos Life player automatically. The server verifies the session. A Lagos Life player who also logs in with a Kikter account gets both linked to one player, so progress made outside and inside Lagos Life syncs. Lagos Life coin packs are bought with Lagos Life checkout, and each purchase adds its coins to the wallet once. Lifetime sales are sent to the Lagos Life score board.
- **Coins:** signed-in players earn coins for won shifts (up to a daily cap) and can swap coins for naira in their buka.
- **Settings:** the game fetches them at start and caches them for offline play. Maintenance blocks starting shifts.
- **Cloud save:** syncs at start, after every shift and on reconnect, with version checks; a conflict merges and retries. Admin edits and resets win over local progress.
- **Leaderboard:** real players only (lifetime sales, stars, Endless best). Banned players are hidden. Lagos Life players are marked, and a filter shows only Lagos Life players.

API: `GET /config`, `POST /players`, `POST /auth/register|login|lagoslife|logout`, `GET|PATCH /me`, `GET|PUT /save`, `POST /shifts`, `GET /wallet`, `POST /wallet/exchange`, `POST /lagoslife/purchase`, `GET /leaderboard?board=sales|stars|endless&scope=all|lagoslife`. Players authenticate with `Authorization: Bearer <token>`. Each device gets its own token, and logging out revokes it.

The backend files added to war.kikter.com are copied in [`server/kikter-backend/`](server/kikter-backend/), because that server has no git repository. The production build uses the API by default. Dev and tests don't, unless `VITE_MAMAPUT_API` is set; `off` disables it.

**Hosting note:** the cPanel account is close to its **inode (file count) limit**: about 3,500 of 300,000 left. Avoid `composer install`, `npm install` and `php artisan optimize`/`view:cache` on the server, since they create thousands of files. The app's vendor folder is packed into one `storage/app/deploy/vendor.tar.gz` phar for this reason.

## Offline and install

Production builds register a service worker (`public/sw.js`) and a web app manifest. After one online visit the game loads offline and can be installed to the home screen. Built assets are cached cache-first because their file names are content-hashed. The page and JSON lists are network-first, so a new deploy is picked up on the next online visit. The dev server does not register the worker.

## Food art

All 21 menu foods now use a matching set of generated food icons on buttons, order bubbles and chapter cards. The game loads the 256px transparent WebP files through `public/food/manifest.json`; missing or failed images fall back to the procedural 3D thumbnails. The counter models remain procedural.

See the [food icon gallery](docs/FOOD_ART_GALLERY.md), [source prompts and installation instructions](docs/FOOD_ART_PROMPTS.md), and [1024px transparent PNG masters](art/food-icons/). Masters are kept outside `public` so only the small runtime copies ship with the game. The generation log records the exact prompts, output paths and master hashes.

## Project structure

```text
src/
  App.jsx                    Canvas ref, effect mount/cleanup, UI provider
  main.jsx                   React entry point, styles, service worker registration
  engine/
    SceneManager.js          Renderer, food/person models, environments, stations,
                             customers, staff, game loop, input, camera and menus
    Lifetime.js              Owned listeners, timers and animation frames
  game/
    data.js                  Menu and prices, chapters, unlocks, upgrades, staff,
                             boosters, customer kinds, moods, lines, level configs
    currency.js              Naira formatting and rounding
    recipes.js               Plate assembly: believable buka orders
    OrderSystem.js           Item matching with main-before-topping layering
    kitchen.js               Cooking/stock state machine and the sink
    deliveries.js            Online and event orders, packing, dispatch riders
    staff.js                 Payroll, unpaid strikes, quitting and sacking
    growth.js                Reputation, business tiers and branches
    leaderboard.js           Rankings against rival bukas
    equipment.js             Buka equipment, effects and upkeep
    market.js                Ingredients, store, inflation, sell-outs, spoilage
    business.js              Taxes, rent, hygiene, inspections, haggling, debt
    customers.js             Customer kind/mood selection and traits
    missions.js              Daily missions, achievements and lifetime stats
    scoring.js               Bill, combo/fast/VIP bonuses, tips and wages
    utils.js                 Math, date and seeded RNG helpers
  systems/
    SaveManager.js           Save schema v2 and v1 (coins) → naira migration
    CloudSave.js             Save merging, backup codes, optional HTTP sync
    Haptics.js               Optional vibration feedback
    AudioManager.js          Synthesized SFX and 108 bpm music
  store/gameStore.js         useSyncExternalStore-compatible structural UI store
  ui/
    GameLayout.jsx           Menu, HUD, booster bar, sink, overlays
    Surface.jsx              Screen/overlay visibility subscriptions
    DynamicLayers.jsx        Map, shop tabs, missions, food buttons, bubbles, chips
    bridge.jsx               Engine actions, React portals and DOM-ref handoff
    Icon.jsx                 Inline SVG icons
  styles/
    original.css             Base game stylesheet
    react.css                Additions: notes, cooking states, small screens
    business.css             Tool rail, order cards, staff, growth, shift ledger
public/
  sw.js, manifest.webmanifest, icons/   Offline/install support
  food/manifest.json                    Painted food icons
  ui/manifest.json                      Optional staff, order and place art
tests/                       Vitest rules, systems and lifecycle tests
e2e/                         Playwright journeys, layout, PWA and visual tests
docs/FOOD_ART_PROMPTS.md     Image prompts for food art
docs/ART_PROMPTS.md          Image prompts for staff, riders, packs, events, places
```

The engine stays in one module to keep its shared geometry/material caches and animation ordering. Rules and systems are plain modules without React or Three.js, so they are unit-tested directly.

React creates every HTML layer, including order bubbles, dirty-table chips, flying naira notes and floating text. The small store publishes structural changes only; bubble and chip positions, patience bars, cooking rings and count-ups update DOM refs directly, at most every 100 ms for HUD text.

Development builds expose `window.__mp = { Game, Save, levelCfg, FOODS, stations, trays, camera }` for tests. Production builds omit it.

## Saves and cloud save

The key remains **`mamaPutRush3D.v1`**. Saves now carry `schema: 2`. Older saves counted fictional coins; they are converted once at ₦25 per coin (coins, best scores and Endless best), and everything else carries over.

Settings → **Backup & cloud save** shows a backup code. Paste it on another device and tap Restore. Restoring merges rather than overwrites. Progress (levels, stars, best scores, upgrades, outfits, decor, staff, achievements, lifetime stats) keeps the best of both. Cash and settings come from whichever save is newer, because money cannot be merged safely.

Optional server sync: build with `VITE_CLOUD_SAVE_URL=https://your-api.example` and a **Sync with cloud** button appears. The endpoint must implement `GET` and `PUT /saves/:playerId` with JSON bodies and ETags (`If-Match` / `If-None-Match: *`, `412` on a stale version). On a conflict the game pulls, merges and retries once. No server ships with this repository.

## Deploy to GitHub Pages

The default Vite base is **`/put/`**. `.github/workflows/deploy.yml` runs lint, unit tests, Playwright journeys and build on pushes and pull requests to `main`; pushes to `main` also deploy `dist` using GitHub Pages Actions.

In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions**. The expected URL is **https://temian1.github.io/put/** after the deployment succeeds. To rename the repository or use a custom domain, update Vite's base accordingly.

## Deploy to Vercel

Import this GitHub repository into Vercel. The included `vercel.json` selects Vite, runs **`npm run build:vercel`**, and publishes **`dist`**. That build overrides the base to `/` for a normal Vercel domain.

## Verification and remaining work

See [ROADMAP.md](ROADMAP.md) for what is delivered and what remains. [PARITY.md](PARITY.md) records the original port's verification against the reference game, which this version now deliberately departs from (menu, prices, currency and new mechanics).
