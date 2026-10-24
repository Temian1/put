# Mama Put Rush 3D

A faithful React 18 + JavaScript port of the supplied Nigerian street-food game, with imperative Three.js **0.149.0**, Vite, and SVG button icons.

## Run

Use Node.js 22 LTS (22.14+ recommended) and npm.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173/put/**. For a production build:

```sh
npm run lint
npm test
npm run build
npm run preview
```

Preview: **http://127.0.0.1:4173/put/**. `npm ci` installs the exact lockfile dependencies in CI. `npm run format` formats the source.

## Play

- Choose PLAY, then an unlocked level on the map. The first two levels provide food hints and extra patience.
- Tap a food button or its 3D station. Keyboard **1–9** serves the corresponding food.
- Tap a customer or order bubble to select them. Otherwise the most urgent customer needing that food receives it.
- **Escape** pauses/resumes. Enter/Space activates focused food buttons. The game pauses when its tab becomes hidden.
- Complete orders before patience runs out. Wrong food costs patience and combo; losing three customers or running out of time ends a level.
- Spend earned coins on four upgrade tracks, outfits and kitchen decor. Claim a daily login reward and a seeded daily challenge with a once-per-day 250-coin win bonus.
- Beat level 50 to unlock Endless Rush. It starts with two lanes, adds the third after five serves and ramps difficulty as you play.

## Project structure

```text
src/
  App.jsx                    Canvas ref, effect mount/cleanup, UI provider
  main.jsx                   React entry point and styles
  engine/
    SceneManager.js          Imperative renderer, models, environments, customers,
                             chef, particles, input, camera and game orchestration
    Lifetime.js              Owned listeners, timers and animation frames
  game/
    data.js                  All foods, chapters, upgrades, outfits, lines, configs
    utils.js                 Original math, date and seeded RNG helpers
    scoring.js               Exact combo/fast/VIP/tips/daily rounding rules
    OrderSystem.js           Outstanding-item matching and tray-slot assignment
  systems/
    SaveManager.js           Original persistence schema and merge behavior
    AudioManager.js          Original synthesized SFX and 108 bpm music
  store/gameStore.js         useSyncExternalStore-compatible structural UI store
  ui/
    GameLayout.jsx           React menu, HUD, boot and overlay markup
    Surface.jsx              Screen/overlay visibility subscriptions
    DynamicLayers.jsx        React map, shop, food controls, bubbles, daily mods
    bridge.jsx               Engine actions, React portals and DOM-ref handoff
    Icon.jsx                 Inline SVG button icons
  styles/
    original.css             Entire original stylesheet, formatted
    react.css                SVG additions and native hidden-attribute behavior
tests/game.test.js           Original-source parity oracle and rule tests
mama-put-rush.html           Unmodified reference game
```

The procedural engine remains together to preserve the original shared geometry/material caches and animation ordering. It does not use react-three-fiber. Extracted rules and systems have no React dependency.

React creates every HTML layer, including dynamic order bubbles, flying coin elements and floating text. The small store publishes structural changes; screen components subscribe to their own visibility. Bubble positions, patience bars, count-up numbers and Web Animations operate on DOM refs, while confetti uses a canvas. Timer, progress, stars and lives update at most every 100 ms. No per-frame React state updates occur.

The engine waits for Lilita One and Baloo 2, with the original 2.5-second timeout, before rendering sign textures. It generates food thumbnails with a disposable offscreen renderer. Unmount cancels owned animation frames and timers, removes listeners, closes audio and disposes current/cached/retired GPU resources. A reused canvas stays available for React hot reload.

Development builds expose `window.__mp = { Game, Save, levelCfg, FOODS }` for verification. Production builds omit this hook. The engine and Three.js are loaded as separate chunks; an engine-load failure leaves a readable boot error.

## Saves

The key remains **`mamaPutRush3D.v1`**, with the exact original defaults and upgrade merge behavior. Existing saves carry over when the game remains on the **same browser origin**. Browsers do not share localStorage between localhost, GitHub Pages and Vercel domains. No server, accounts, credentials or environment variables are required.

## Deploy to GitHub Pages

The default Vite base is **`/put/`**. `.github/workflows/deploy.yml` runs lint, tests and build on pushes and pull requests to `main`; pushes to `main` also deploy `dist` using GitHub Pages Actions.

In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions**. The expected URL is **https://temian1.github.io/put/** after the deployment succeeds. GitHub Pages must be available for the repository/account. To rename the repository or use a custom domain, update Vite's base accordingly.

## Deploy to Vercel

Import this GitHub repository into Vercel. The included `vercel.json` selects Vite, runs **`npm run build:vercel`**, and publishes **`dist`**. That build overrides the base to `/` for a normal Vercel domain. The GitHub Pages build keeps `/put/`.

## Verification and remaining work

`npm test` checks all 50 level configurations and 12 date/unlock daily fixtures against formulas executed directly from the untouched original. It also tests scoring, storage migration/failure handling, order matching and external-store snapshots. See [PARITY.md](PARITY.md) for browser checks and deliberate differences, and [ROADMAP.md](ROADMAP.md) for missing features with priorities and effort estimates.

The original HTML is a fragment without charset or viewport metadata. The React entry adds valid document metadata. For mobile visual comparisons, wrap the reference with the same UTF-8 and viewport tags; otherwise the browser uses a 980px layout viewport and can misdecode the reference text. Random customer appearances, menu orbit and animation timing also prevent unseeded screenshots from being pixel-identical.

Fonts still load from Google Fonts, as in the source. Offline font hosting and a complete offline PWA are future work. This version uses fictional in-game coins only.
