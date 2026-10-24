# Missing features and roadmap

These extend the original game; they are not removed port features. Estimates are hands-on engineering/art person-days for an initial usable version, excluding store approval and licensed audio production. P0 is the first release-hardening batch, P1 expands the core game, and P2 is later content/platform work.

## Delivered in the October 2026 update

The previous top 10, plus the requested economy and staff changes:

| Item | What shipped | Still open |
| --- | --- | --- |
| Cooking stages | Dodo, chicken and fish go raw → frying → ready (batch of 3–4) → burnt. Button rings, 3D smoke/char, Sharp Sharp Hands speeds frying. | Pot stations (rice, soups) are still always ready. |
| Ingredient assembly | Orders are built as real plates: one main, a soup with every swallow, then proteins, sides, drinks. Toppings unlock after the main. | No free-form plate building outside orders. |
| Table clearing and dishwashing | Dirty plates close a lane until cleared; four-plate sink with timed washing. | No dish-capacity upgrade yet. |
| Boosters | Freeze Time, Auto-Serve, Patience Boost with shop purchase and in-level bar. | No cooldown UI beyond counts. |
| Customer variety and moods | Schoolkids, okada riders, danfo conductors, Alhaji with own looks, patience, tips, favourites and lines; calm/hungry/generous/grumpy moods. | Boss characters. |
| Tutorial hand and haptics | Pointing hand on levels 1–2 and the first level of assembly, frying, dishes and swallow; vibration toggle. | Language and text-size settings. |
| Offline PWA | Manifest, icons, service worker with offline reload, verified by a Playwright test. | Install prompt UI; fonts are cached on first use rather than self-hosted. |
| Playwright tests | Layout at five phone sizes, ten gameplay journeys, offline PWA, opt-in visual baselines; added to CI. | Visual baselines are per machine. |
| Missions and achievements | Three seeded daily missions with naira rewards, 13 lifetime achievements, menu badge. | Weekly events. |
| Cloud save | Backup codes, merge-based conflict resolution, optional ETag HTTP sync adapter. | A hosted backend and sign-in. |
| Naira economy | Real Lagos buka prices, ₦ notes, ₦50 rounding, tips, one-time coin→naira save migration. | Price inflation events. |
| Hired help | Four staff (two servers, a cleaner, a cook) with hire cost, per-shift wages and on/off duty. | Staff upgrades and morale. |
| Mobile overlay fix | Panels are border-box, never wider than the screen, and scroll when taller than it; HUD no longer overflows at 320 px. | — |

## Delivered in the business update

| Item | What shipped |
| --- | --- |
| Nigerian names | Every customer has a Nigerian name tag; VIPs, Alhaji and Odogwu get titles. |
| Odogwu customer | Orders one small item, tips ₦2,000–₦5,000 with "Keep the change!". |
| Salaries | Staff paid after each shift from takings then savings; three unpaid shifts and they quit; sack and off-duty to save money. |
| Delivery and errand staff | Two dispatch riders (trip times 9 s and 6 s) and a market errand worker (restocks drinks, 20% cheaper ingredients). |
| Reputation | ★ 0–100 changes with service; controls how often customers come and how much they tip. |
| Online orders and packing | From level 15: notifications, order cards, packing with ₦150 packs, hired or outside riders, deadlines. |
| Catering events | Birthday, naming ceremony, child dedication, wedding, burial, house warming and chieftaincy orders on seven levels and in Endless. |
| Food finishes | From level 6 every station holds a batch that runs out and costs ingredients to cook again; customers complain while waiting. |
| Left rail and zoom | Tools moved to a left rail; zoom with buttons, wheel or pinch. |
| Growth and places | Five business tiers, six branches with per-shift income, visiting changes the menu scene. |
| Art prompts | docs/ART_PROMPTS.md with keys the game loads from public/ui/manifest.json. |

## Delivered in the empire update

| Item | What shipped |
| --- | --- |
| Visible, moving staff | Back kitchen with sink, freezer, shelves and handwash; workers walk to jobs and act on arrival; riders wait by parked okadas. |
| Equipment | 11 buyable items with upkeep, all shown in 3D. |
| Seating | Up to 6 tables/12 seats; steering (path following, arrival, separation); dirty-table clearing. |
| Vehicles | Delivery okadas gate free rider trips; catering bus for events; road traffic in every scene. |
| Market | 8 ingredient groups, store capacity, per-shift inflation and shocks, sell-outs, spoilage. |
| Haggling | Accept, meet halfway or refuse, with walk-outs. |
| Taxes and bills | LGA levy, VAT 7.5% from Popular Joint, rent and light, upkeep, debt. |
| Hygiene | Live hygiene score and health inspections with fines. |
| Decline | Absence decay, debt penalty, reputation-scaled branch income, business level can drop. |
| 100 levels | Five new chapters with their own signboards, more dishes and bigger crowds. |

## Next candidates

1. Self-host fonts and add an install prompt (1–2 days).
2. Staff training upgrades and a bigger sink (2–3 days).
3. Pot stations with refill timers for rice and soups (3–4 days).
4. Boss customers and special event levels (4–6 days).
5. Hosted cloud-save backend with sign-in (5–8 days).

## P0 — release hardening and accessibility

| Missing feature | Effort | Notes |
| --- | --- | --- |
| Error boundary, context-loss recovery and retry UI | 1–2 days | Current boot handles engine-import and WebGL initialization errors; mid-game recovery remains. |
| Explicit asset preloader and retry/progress indicators | 1–2 days | Current boot waits for fonts and generates thumbnails synchronously. |
| Full FPS/quality auto-tuner and diagnostic overlay | 2–3 days | Source-style slow-frame pixel-ratio drop is already retained; add recovery, stable measurements and device testing. |
| Colorblind-safe patience display | 1–2 days | Add shapes/text patterns in addition to the existing green/amber/red bar. |
| Text scaling and full keyboard navigation | 2–4 days | Focus management in overlays/map, accessible selection and readable bubble scaling. |
| Settings for language and haptics | 1–2 days | Save migration and translated UI catalog. |
| Sentry integration | 1 day | Optional consent, source maps and release tagging; no credentials shipped. |
| Analytics events | 1–2 days | Optional consent; level funnels, mistakes, quits and quality changes. |
| CI deployment observability | 0.5–1 day | Lint/test/build/Pages workflow is already included; add browser tests and deployment smoke checks. |

## P1 — gameplay depth and progression

| Missing feature | Effort | Notes |
| --- | --- | --- |
| Special event levels and boss customers | 4–6 days | Source has boss rush levels; unique boss characters/mechanics are additional work. |
| Restaurant expansion between chapters | 5–8 days | More stations, floorplan upgrades and expansion previews. |
| Weekly event calendar | 3–5 days | Deterministic local rotation initially; optional online scheduling later. |
| Christmas, Sallah, Easter and Independence Day events | 6–10 days | Themed rules, decor, dialogue and rewards; calendar/date handling. |
| Collectible recipe book | 3–4 days | Dish history, collection milestones, ingredients and rewards. |
| Level-start card with order preview | 1–2 days | Retain intro banner, add readable upcoming foods and modifiers. |
| Stats screen | 2–3 days | Lifetime served, tips, accuracy, streaks and personal records. |
| More Nigerian menu items | 3–5 days | Moi moi, ewa agoyin and pepper soup shipped; akara, ofada, boli, chin chin and Chapman remain. |
| Real SFX and Afrobeats-style music loops | 4–8 days | Original commissioned/licensed audio, mixing and memory budgets; synth soundtrack remains functional. |

## P2 — art, content, platform and optional online features

| Missing feature | Effort | Notes |
| --- | --- | --- |
| Abuja, Port Harcourt, Kano and Ibadan chapters | 12–20 days | Distinct environments, local dishes, mechanics and 40 balanced levels. |
| glTF character and food assets | 10–20 days | Preserve readable silhouettes, mobile budgets and theme palette. |
| More hair/clothing and simple bone animation | 6–10 days | Current source-style procedural meshes and animations remain intact. |
| Day/night cycle | 2–4 days | Lighting, sign readability and performance on r149. |
| Rain-season weather | 3–5 days | Rain, puddles and optional shelter mechanics with quality controls. |
| More decor and Buka wall posters | 3–5 days | The supplied source has no poster implementation; add artwork and unlocks. |
| Voice lines in Pidgin, Yoruba, Igbo and Hausa | 8–15 days | Native-speaker recording/review, text equivalents, subtitles and per-language downloads. |
| Expand Ankara combinations | 2–3 days | Source uses six palettes with `i % 3` styles; a full six-by-three wardrobe adds variants. |
| TypeScript migration | 6–10 days | Start with save/config/order types, then Three resource/lifecycle contracts. |
| Upgrade Three.js with ColorManagement migration | 4–7 days | Keep r149 pinned until old/new lighting, textures and screenshots are verified together. |
| Further engine module decomposition | 3–5 days | Separate geometry/model factories and scene orchestration without changing cache/lifecycle ordering. |
| Endless leaderboards | 4–6 days | Backend validation, rate limits and cheat resistance. |
| Shareable score-card image | 1–2 days | Canvas export with dish thumbnails and accessible fallback sharing. |
| Rewarded-ad and IAP placeholders | 2–3 days | In-game naira only; real billing/ad networks require separate design and authorization. |
| Capacitor Android Play Store build | 5–8 days | Safe-area/audio/background/device QA, signing and store assets. |

## Already delivered in this port

- React HTML layers with an external store and imperative per-frame refs.
- Dynamic engine import and a separate Three.js chunk.
- Vitest rule tests, Playwright browser tests, ESLint and a GitHub Actions lint/test/e2e/build/Pages workflow.
- Full engine unmount cleanup and production-only removal of the debug hook.
- SVG icons across buttons, while preserving generated 3D food thumbnails.

Splitting/loading Three.js and the basic CI workflow are therefore extensions to harden further, not missing initial implementations.
