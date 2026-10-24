# Food art verification

Completed 24 October 2026. The set follows all 21 food entries in [FOOD_ART_PROMPTS.md](FOOD_ART_PROMPTS.md). Optional app, dirty-plate and cash-bundle illustrations were not part of this food set.

## Assets and installation

- Generated one food icon per built-in `image_gen` call, requesting genuine transparency and the shared style block.
- Saved 21 PNG masters at exactly **1024 × 1024**, RGBA, under [`art/food-icons/`](../art/food-icons/). The earlier jollof prototype is preserved; installed jollof v2 includes the peas, carrots and onion rings in the document.
- Exported 21 **256 × 256 WebP** runtime copies under [`public/food/`](../public/food/), totaling **315,548 bytes** (about 308 KiB).
- Verified alpha extrema of 0–255 and fully transparent corners in all 42 new exported images. Normalized transparent padding to approximately 80% maximum subject extent without changing the food illustration.
- Verified exact coverage of the game's 21 food IDs in [`manifest.json`](../public/food/manifest.json).
- Kept high-resolution masters outside `public` so the game distributes only the small runtime assets. Counter food models remain procedural.
- Recorded exact generation prompts, output paths, master SHA-256 hashes and export settings in [`generation.json`](../art/food-icons/generation.json).

View the complete [food icon gallery](FOOD_ART_GALLERY.md).

## Checks

- **70 unit tests passed**, covering rules, business systems, saves and lifecycle ownership.
- **ESLint passed.**
- **Production build passed.**
- **All 34 browser checks were verified:** the isolated full run passed 33 checks, then the remaining delivery check passed its targeted rerun after correcting the test fixture and its order-specific assertions. Tests used local Chrome against an isolated source copy with dedicated ports to avoid live-edit hot reloads and development-server reuse.
- The food-art journey verified that all 21 runtime images load at 256 × 256 and appear on food buttons, order bubbles and chapter cards.
- A deliberate failed-image request verified that a procedural thumbnail remains available as the fallback.
- The browser checks covered level-one completion, cooking, stock depletion, plate assembly, washing, boosters, staff, payroll, branches, online packing/dispatch, save migration, backup restore, pause, mobile/landscape layouts and offline PWA reload.
- A 390 × 844 manual browser inspection confirmed the new art displays in the mobile food bar without application console errors.

The pre-existing game/PWA changes were included in the GitHub push at the user's explicit request. The initial React-port observations in [PARITY.md](../PARITY.md) are historical; this update intentionally uses the expanded current game.
