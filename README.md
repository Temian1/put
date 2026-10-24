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
  - **Level 4 (cooking stages):** dodo, chicken and fish must be fried. Tap to start frying; a ready batch holds several portions and burns if left too long. Tap a burnt pan to throw it away.
  - **Level 11 (dishwashing):** served customers leave dirty plates. Tap **Clear** (or the tray) to move a plate to the sink; the lane stays closed until you do. The sink holds four plates. Tap **Sink** (or press **W**) to wash.
- **Boosters** (one of each to start, more in the shop): *Freeze Time* stops the clock and patience for 8 s, *Auto-Serve* completes the most urgent order, *Patience Boost* refills everyone waiting.
- **Customers:** schoolkids, okada riders, danfo conductors and Alhaji join the regulars, VIPs and wedding guests, each with their own look, patience, tips and favourite orders. Some show a mood (😌 calm, 🤤 hungry, 💸 generous, 😤 grumpy). Happy customers who did not wait long leave a tip.
- **Hire help** (Menu → Hire Help, or Shop → Staff): Chidi and Tunde serve, Aunty Bisi clears tables and washes plates, Iya Basira keeps the pans frying. Staff work every shift and their wages come out of that shift's takings. Toggle anyone off duty to save wages.
- **Missions:** three new daily missions with naira rewards, plus lifetime achievements. The menu badge shows how many are ready to claim.
- Upgrades, outfits, decor, daily login reward, daily challenge (₦6,000 win bonus) and Endless Rush (after level 50) remain.
- **Escape** pauses. The game pauses when its tab is hidden. Settings has sound, music, vibration and graphics toggles.

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
    kitchen.js               Cooking stage state machine and the sink
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
    react.css                Additions: notes, tools, cooking states, small screens
public/
  sw.js, manifest.webmanifest, icons/   Offline/install support
  food/manifest.json                    Optional painted food icons
tests/                       Vitest rules, systems and lifecycle tests
e2e/                         Playwright journeys, layout, PWA and visual tests
docs/FOOD_ART_PROMPTS.md     Image prompts for food art
```

The engine stays in one module to keep its shared geometry/material caches and animation ordering. Rules and systems are plain modules without React or Three.js, so they are unit-tested directly.

React creates every HTML layer, including order bubbles, dirty-table chips, flying naira notes and floating text. The small store publishes structural changes only; bubble and chip positions, patience bars, cooking rings and count-ups update DOM refs directly, at most every 100 ms for HUD text.

Development builds expose `window.__mp = { Game, Save, levelCfg, FOODS, stations, trays }` for tests. Production builds omit it.

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
