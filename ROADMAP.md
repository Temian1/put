# Missing features and roadmap

These extend the original game; they are not removed port features. Estimates are hands-on engineering/art person-days for an initial usable version, excluding store approval and licensed audio production. P0 is the first release-hardening batch, P1 expands the core game, and P2 is later content/platform work.

## Top 10 next items

1. Cooking stages: raw → cooking → ready → burnt (5–8 days).
2. Ingredient assembly: rice + chicken + dodo combinations (4–6 days).
3. Table clearing and dish washing (3–5 days).
4. Freeze Time, Auto-Serve and Patience Boost boosters (3–5 days).
5. More customer types with moods/personalities (4–7 days).
6. Pointing-hand tutorial and optional haptics (2–4 days).
7. Offline/installable PWA (2–4 days).
8. Automated Playwright journeys and screenshot regression (3–5 days).
9. Achievements, quests and missions (4–6 days).
10. Optional cloud save with conflict resolution (5–8 days).

## P0 — release hardening and accessibility

| Missing feature | Effort | Notes |
| --- | --- | --- |
| Playwright end-to-end journeys and visual regression | 3–5 days | Cover fresh/old saves, all overlays, touch, keyboard, daily rollover and Endless. Browser checks in this port are manual/tool-driven. |
| PWA manifest, service worker, offline play, install prompt | 2–4 days | Cache game chunks, fonts and future audio; define upgrade/cache invalidation behavior. |
| Error boundary, context-loss recovery and retry UI | 1–2 days | Current boot handles engine-import and WebGL initialization errors; mid-game recovery remains. |
| Explicit asset preloader and retry/progress indicators | 1–2 days | Current boot waits for fonts and generates thumbnails synchronously. |
| Full FPS/quality auto-tuner and diagnostic overlay | 2–3 days | Source-style slow-frame pixel-ratio drop is already retained; add recovery, stable measurements and device testing. |
| Pointing-hand first-time tutorial | 2–3 days | Keep existing level 1–2 hint glow; teach customer selection and urgency explicitly. |
| Haptics with `navigator.vibrate`, preference toggle | 0.5–1 day | Opt-in feedback, respect reduced motion and unsupported devices. |
| Colorblind-safe patience display | 1–2 days | Add shapes/text patterns in addition to the existing green/amber/red bar. |
| Text scaling and full keyboard navigation | 2–4 days | Focus management in overlays/map, accessible selection and readable bubble scaling. |
| Settings for language and haptics | 1–2 days | Save migration and translated UI catalog. |
| Sentry integration | 1 day | Optional consent, source maps and release tagging; no credentials shipped. |
| Analytics events | 1–2 days | Optional consent; level funnels, mistakes, quits and quality changes. |
| CI deployment observability | 0.5–1 day | Lint/test/build/Pages workflow is already included; add browser tests and deployment smoke checks. |

## P1 — gameplay depth and progression

| Missing feature | Effort | Notes |
| --- | --- | --- |
| Cooking stages: raw → cooking → ready → burnt | 5–8 days | Station state machines, readable timers, food waste and balancing. |
| Ingredient assembly and multi-part dishes | 4–6 days | Rice + chicken + dodo, item variants, recipe/order previews. |
| Table clearing and dish washing | 3–5 days | Dirty tray/plate capacity and a clear touch workflow. |
| Freeze Time, Auto-Serve, Patience Boost | 3–5 days | In-game booster inventory, effects, cooldowns and balancing. |
| Schoolkids, okada riders, Danfo conductors, Alhaji | 4–7 days | Distinct appearances, movement, patience and order tendencies. |
| Customer moods and personalities | 3–5 days | Tie dialogue, tips and reactions to understandable behavior. |
| Tips jar | 1–2 days | Separate visual collection loop and clear economy balancing. |
| Special event levels and boss customers | 4–6 days | Source has boss rush levels; unique boss characters/mechanics are additional work. |
| Restaurant expansion between chapters | 5–8 days | More stations, floorplan upgrades and expansion previews. |
| Achievements, quests and missions | 4–6 days | Versioned objectives, progress, reward UI and tests. |
| Weekly event calendar | 3–5 days | Deterministic local rotation initially; optional online scheduling later. |
| Christmas, Sallah, Easter and Independence Day events | 6–10 days | Themed rules, decor, dialogue and rewards; calendar/date handling. |
| Collectible recipe book | 3–4 days | Dish history, collection milestones, ingredients and rewards. |
| Level-start card with order preview | 1–2 days | Retain intro banner, add readable upcoming foods and modifiers. |
| Stats screen | 2–3 days | Lifetime served, tips, accuracy, streaks and personal records. |
| Expanded Nigerian menu | 5–8 days | Moi moi, akara, ofada, pepper soup, boli, ewa agoyin, chin chin and Chapman; models, stations and balance. |
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
| Optional cloud save | 5–8 days | Authentication, versioned saves, offline queue and conflict resolution. |
| Endless leaderboards | 4–6 days | Backend validation, rate limits and cheat resistance. |
| Shareable score-card image | 1–2 days | Canvas export with dish thumbnails and accessible fallback sharing. |
| Rewarded-ad and IAP placeholders | 2–3 days | Fictional coins only; real billing/ad networks require separate design and authorization. |
| Capacitor Android Play Store build | 5–8 days | Safe-area/audio/background/device QA, signing and store assets. |

## Already delivered in this port

- React HTML layers with an external store and imperative per-frame refs.
- Dynamic engine import and a separate Three.js chunk.
- Vitest rule tests, ESLint and a GitHub Actions lint/test/build/Pages workflow.
- Full engine unmount cleanup and production-only removal of the debug hook.
- SVG icons across buttons, while preserving generated 3D food thumbnails.

Splitting/loading Three.js and the basic CI workflow are therefore extensions to harden further, not missing initial implementations.
