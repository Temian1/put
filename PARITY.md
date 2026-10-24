# Port parity and verification

Validated on 24 October 2026 using Node 22.14, Chromium, React 18.3.1 and Three.js 0.149.0. The supplied `mama-put-rush.html` is retained unchanged as the rule-test oracle.

## Automated checks

- `npm install`: succeeds; lockfile committed.
- `npm run lint`: passes.
- `npm test`: 80 passing tests across game rules and engine lifecycle ownership.
- `npm run build`: succeeds with separate React/UI, engine and Three.js chunks.
- `npm run dev` and `npm run preview`: start successfully and serve `/put/`.
- Final `npm audit`: zero known vulnerabilities at verification time.

The rule tests execute the original HTML's data functions independently in a VM and compare every resulting field for all 50 levels and 12 seeded daily fixtures. Tests also cover scoring/rounding, the 60% fast boundary, combo cap, VIP/tips/daily stacking, save defaults/merges/failures/round trips, outstanding/duplicate/wrong order items and store notifications. Lifecycle tests check cancellation, listener removal and suppression of stale callbacks.

## Browser evidence

| Flow | Observed result |
| --- | --- |
| Boot and menu | Fonts, 3D scene and all 11 offscreen-rendered thumbnails load. |
| Map | Five chapter cards and all 50 nodes render; current node starts the correct level. |
| Level 1 | Automatic input through actual React food-button pointer handlers served 5/5, kept 3 lives, won, saved coins and unlocked level 2. A recorded run scored 283 including 123 time-bonus points. |
| Speech-bubble selection | A pointer event on the React bubble selected its customer. |
| Keyboard serving | The corresponding 1–9 key filled the selected customer's requested item. |
| Wrong item | Unrequested food registered a mistake; the original penalty/feedback path ran. |
| Pause | Pause button and Escape worked; timer stayed unchanged while paused, then resumed. |
| Losing lives | Accelerated patience exhaustion produced three customer losses, zero lives and the fail overlay. |
| Running out of time | Accelerated remaining time produced the `Time Don Finish!` fail screen. |
| Daily reward | Collect updated the original save key and awarded the source's day-one 60 coins. |
| Daily challenge | Two modifiers rendered. A full 5-customer win awarded the 250 bonus and saved `dailyDone`. A full replay won without a second daily bonus. |
| Endless | Temporarily unlocked in the test save; served 6 customers through food-button handlers, expanded to 3 lanes, then ended after 3 accelerated losses and saved a new 525-point personal best. Test save restored afterward. |
| Shop | Fast Hands purchase deducted exactly 100 coins. Outfit purchases/equipping and all three decor purchases worked. A zero-coin test showed the exact missing-coin toast and did not deduct money. |
| Graphics | High → low → high settings updated successfully. |
| Themes | Levels 1, 11, 21, 31 and 41 built all five themes with 3/5/6/6/6 food buttons. |
| SVG buttons | No rendered button lacked an SVG, including dynamic food, map and shop controls. |
| Production preview | Boot, map, level start and pause worked. `window.__mp` was absent. |
| Console | No application warnings or errors in the tested development and production play flows. |

Debug-only save/config adjustments were used to exercise locked content and loss conditions quickly; this is not a claim of manually completing all 50 levels. Gameplay wins used actual food-button event paths rather than calling `serve` or directly forcing wins.

## Visual comparison and deliberate differences

The menu was visually compared against the original at **390 × 844** and **1280 × 800**. Original colors, textures, typography, layout, camera fitting, procedural scene, original CSS animations and safe-area rules are retained. Screenshots are not pixel-diff certified: customers, menu camera orbit and animation phase vary over time, and this task explicitly adds SVG icons.

The supplied HTML is a document fragment without charset/viewport metadata. For comparison it was wrapped with UTF-8 and the same responsive viewport tags, without changing its game code. The React entry includes those tags permanently. Comparing the bare fragment directly on mobile instead produces a scaled 980px viewport and can garble Unicode text.

Intentional implementation differences:

- Inline SVGs were added to text-only buttons as requested. Existing procedural food thumbnails remain in food controls, bubbles and the map.
- Pause now explicitly suspends/resumes audio, as required by the brief. The original only suspended audio on tab hide.
- An explicit `[hidden]` rule ensures elements intended to be hidden stay hidden despite authored `display` rules, including Endless-only HUD/result visibility.
- Structural HTML is React-owned. The original math, rendering geometry, food flight timing and animation sequence remain imperative. The engine stays in one orchestration module to preserve shared caches; rule/data/audio/save modules are extracted. Further decomposition is listed on the roadmap.
- HUD timer/progress/stars/lives are throttled to 10 Hz as requested; numeric count-ups and bubble/FX animation remain on refs/canvases.
- Three.js is installed from npm, loaded in a separate chunk and pinned to r149; its old CDN global-script warning is eliminated.

## Brief details absent or different in the source

These source behaviors were preserved rather than inventing new parity features:

- Endless begins with **two** lanes, becoming three after **five** serves.
- The daily reward is **40 + streak × 20**, so day one gives **60** coins. The source's initial placeholder says 50 but the actual award formula gives 60.
- There are six Ankara palettes, each assigned one of three styles using `i % 3`; the source does not generate every six-by-three combination.
- Boss levels are rush configurations, not distinct boss customer mechanics.
- The source's Buka contains a zinc wall, palms, parasols and chairs, but no wall-poster implementation.

See [ROADMAP.md](ROADMAP.md) for all requested missing features, estimates, priorities and additional technical improvements. No all-device, all-level, automated pixel-parity or audio-recording comparison is claimed.
