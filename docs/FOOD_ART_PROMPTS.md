# Food art prompts for ChatGPT

The game draws every food as a small procedural 3D model and renders those into the button, bubble and map icons. You can replace any icon with a painted image. Generate images with the prompts below, then install them as described at the end. Foods without an image keep their generated icon, so you can add them one at a time.

**Installed set:** all 21 food prompts below now have generated art. See the [food icon gallery](FOOD_ART_GALLERY.md), [1024px transparent PNG masters](../art/food-icons/) and [256px WebP runtime manifest](../public/food/manifest.json). Exact generation prompts are recorded in [generation.json](../art/food-icons/generation.json). The built-in image tool was used, with transparent padding normalized during export. The earlier jollof prototype is preserved; installed jollof v2 follows the peas, carrots and onion rings in this document. Optional extras remain future work.

## How to use the prompts

1. Paste the **style block** once at the start of a ChatGPT conversation.
2. Then send one **food prompt** per message, for example: `Food 1: Jollof Rice`. Keeping one conversation gives the set a consistent look.
3. If the background comes back white, ask: *"Same image with a fully transparent background, PNG."*
4. If you get text, a logo or a hand in the image, ask for it again without them.

### Style block (send first)

```text
You are making a matching set of food icons for a cheerful mobile cooking game set in a Lagos "mama put" roadside food spot.

Style for EVERY image in this set:
- Stylised 3D render, soft and chunky like modern casual mobile games (clay/Pixar-like), not photoreal.
- One single serving, centred, filling about 80% of the frame.
- Camera 3/4 view from about 35 degrees above, slightly to the front.
- Soft warm studio light from the top-left, gentle soft shadow under the plate only.
- Saturated, appetising colours with clear silhouettes that stay readable at 48 pixels.
- Plates are plain white ceramic with a thin cream rim; bowls are white ceramic unless I say otherwise.
- Square 1024x1024 PNG with a fully transparent background.
- No text, no numbers, no logos, no brand names, no hands, no cutlery, no table, no extra props.

Reply "Ready" and wait for my first food.
```

## Food prompts

The ID in brackets is the file name the game expects, e.g. `jollof.png`.

| # | Food (ID) | Prompt |
| --- | --- | --- |
| 1 | Jollof Rice (`jollof`) | Nigerian jollof rice: a domed heap of smoky orange-red long-grain parboiled rice with a few green peas and tiny diced carrots, a couple of soft sliced onion rings on top, served on a white plate. |
| 2 | Fried Rice (`friedrice`) | Nigerian fried rice: a domed heap of golden-yellow rice mixed with diced carrots, green peas, sweet corn and chopped green beans, served on a white plate. |
| 3 | Rice & Stew (`whiterice`) | Fluffy white rice on a white plate with a generous ladle of glossy red Nigerian tomato-and-pepper stew poured over the top, a thin layer of red oil shining at the edge. |
| 4 | Ewa Agoyin (`beans`) | Ewa agoyin: soft, mashed brown honey beans in a white bowl, topped with a spoonful of very dark, almost black agoyin pepper sauce with visible fried onion bits and oil. |
| 5 | Eba (`eba`) | A smooth round mound of yellow eba (garri swallow made with palm oil) on a white plate, soft, slightly glossy surface with gentle hand-shaped curves. |
| 6 | Amala (`amala`) | A smooth round mound of dark brown amala (yam flour swallow) on a white plate, soft and slightly shiny. |
| 7 | Pounded Yam (`poundedyam`) | A smooth, fluffy round mound of bright white pounded yam (iyan) on a white plate, with a second smaller wrap beside it. |
| 8 | Goat Pepper Soup (`peppersoup`) | Nigerian goat meat pepper soup in a deep dark bowl: clear reddish-brown spicy broth with chunks of goat meat, a few torn green scent leaves floating, light steam rising. |
| 9 | Egusi Soup (`egusi`) | Nigerian egusi soup in a white bowl: thick yellow-orange clumps of ground melon seed cooked in palm oil, dark green chopped bitter leaf, a chunk of beef and a piece of stockfish. |
| 10 | Efo Riro (`efo`) | Efo riro in a white bowl: rich deep-green chopped spinach stew mixed with red palm-oil pepper sauce, with two pieces of assorted meat. |
| 11 | Ewedu & Gbegiri (`ewedu`) | "Abula" soup in a white bowl split into two halves: bright green ewedu (jute leaf) on one side, smooth yellow-brown gbegiri bean soup on the other, a spoon of red stew in the centre. |
| 12 | Beef (`beef`) | Three chunks of fried Nigerian stew beef on a small white saucer, coated in glossy red stew. |
| 13 | Fried Chicken (`chicken`) | Nigerian stewed-then-fried chicken: a golden-brown drumstick and a thigh on a white plate, crisp skin with a light red pepper glaze. |
| 14 | Fried Fish (`fish`) | A whole fried croaker fish lying on a white plate, golden crispy skin, slightly curled tail, a few red pepper flakes. |
| 15 | Boiled Egg (`egg`) | Two peeled boiled eggs on a small white saucer, one whole and one cut in half showing a bright yellow yolk, a little red stew underneath. |
| 16 | Dodo (`plantain`) | Dodo: diagonally sliced fried ripe plantain pieces, caramelised golden-orange with darker edges, arranged in a loose ring on a white plate. |
| 17 | Moi Moi (`moimoi`) | Nigerian moi moi: a steamed orange-pink bean pudding sitting on an opened green uma leaf on a white plate, cut to show a slice of boiled egg inside. |
| 18 | Pure Water (`water`) | A single clear plastic 50cl "pure water" sachet of drinking water, pillow-shaped, with a generic blue and red printed band and no words, tiny cold water droplets on the plastic. |
| 19 | Zobo (`zobo`) | A small clear plastic bottle of chilled zobo (hibiscus drink), deep red-purple, with a red cap and cold condensation drops, no label text. |
| 20 | Mineral (`mineral`) | A chilled soft drink in a plain glass bottle with a red cap and a plain red-and-white label with no words or logo, cold condensation drops. |
| 21 | Malt (`malt`) | A dark brown glass bottle of malt drink with a plain shiny gold foil label and gold cap, no words or logo, cold condensation drops. |

## Optional extras

Not loaded by the game yet. Useful for store listings or later art passes.

- **App icon:** "A plate of jollof rice and dodo in the same style, centred on a flat warm orange background, rounded-square app icon, no text."
- **Dirty plate:** "An empty white plate with smears of red stew and a few rice grains, same style, transparent background."
- **Naira cash bundle:** "A small stylised bundle of green banknotes held with a rubber band, cartoon style, no readable numbers, faces or real banknote designs, transparent background."

## Install the images

1. Shrink each image to **256x256** (it is shown at 34–64 CSS pixels; 256 covers high-DPI phones). WebP keeps files small. With ImageMagick:

   ```sh
   magick jollof.png -resize 256x256 -quality 85 jollof.webp
   ```

2. Copy the files into [`public/food/`](../public/food/).
3. List them in [`public/food/manifest.json`](../public/food/manifest.json), keyed by food ID:

   ```json
   {
     "jollof": "jollof.webp",
     "plantain": "plantain.webp",
     "water": "water.webp"
   }
   ```

4. Reload the game. Listed images replace the generated icons on food buttons, customer bubbles and chapter cards. A file that fails to load falls back to the generated icon. The 3D models on the counter stay procedural.

The service worker fetches `manifest.json` fresh whenever the device is online, so new art shows up on the next visit without clearing the cache.
