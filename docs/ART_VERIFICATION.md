# UI art verification

All 29 prompts from [ART_PROMPTS.md](ART_PROMPTS.md) have selected artwork.
See the [gallery](ART_GALLERY.md) and [exact generation records](../art/ui/generation.json).

## Asset checks

- Manifest covers exactly 29 unique prompt keys: 7 staff, 4 delivery/packing, 7 events, 6 branches and 5 customers.
- All 29 selected PNG masters are 1024 x 1024 RGBA with genuine transparency.
- All 29 selected runtime WebPs are 256 x 256 RGBA with genuine transparency.
- All selected exports have fully transparent corners; subject extent is approximately 80% of the frame.
- Master SHA-256 hashes and runtime byte sizes match the generation records.
- Selected runtime images total 556,224 bytes (about 543 KiB).
- Dedication v2 corrects the fried-rice colour; wedding v2 uses folded aso-ebi and a gele without an extra character. Earlier versions remain preserved.

## Build and browser checks

`npm.cmd run build` passed on 2026-10-24.

A focused Playwright check in installed Chrome against the production preview confirmed:

- The UI manifest loads and all 29 image URLs decode at 256 x 256.
- All 7 staff cards render their portraits.
- All 6 Grow cards render their branch images.
- No browser page errors occurred.

Event and online-order assets were checked for decoding and their existing manifest keys were confirmed in the renderer. This focused check did not create every event order. Rider, pack, cooler and optional customer artwork is registered for future use; the scene still uses procedural characters and bikes.
