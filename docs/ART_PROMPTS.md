# Character, delivery and place art prompts for ChatGPT

These images go on the staff cards, the order cards and the Grow screen. Food icons have their own prompts in [FOOD_ART_PROMPTS.md](FOOD_ART_PROMPTS.md). Anything you do not generate keeps its current icon, so add them in any order.

## How to use

1. Start a new ChatGPT conversation and paste the **style block**.
2. Send one prompt per message, e.g. `Image 1: Emeka, dispatch rider`.
3. If the background is not transparent, ask: *"Same image, fully transparent background, PNG."*
4. Ask again if you get text, logos, number plates, real brands or a real person's likeness.

### Style block (send first)

```text
You are making a matching set of character and object images for a cheerful mobile cooking game set at a Lagos "mama put" food spot. They must match a set of food icons already made in this style:

- Stylised 3D cartoon render, soft and chunky like modern casual mobile games (clay/Pixar-like), friendly faces, not photoreal.
- Nigerian characters with warm brown skin tones and Nigerian clothing (ankara prints, aso-ebi, kaftan, gele, fila, kufi).
- One subject, centred, filling about 80% of the frame, 3/4 front view, soft warm light from the top-left.
- Saturated colours and a clear silhouette that stays readable at 56 pixels.
- Square 1024x1024 PNG with a fully transparent background.
- No text, no numbers, no logos, no brand names, no number plates, no real people.

Reply "Ready" and wait for my first image.
```

## Prompts

The **key** is what you write in `public/ui/manifest.json`.

### Staff portraits (Shop → Staff)

| # | Key | Prompt |
| --- | --- | --- |
| 1 | `staff:chidi` | Chidi, a cheerful young apprentice server in his late teens, teal-and-gold ankara shirt, white apron, holding a plate of jollof rice, head-and-shoulders portrait. |
| 2 | `staff:bisi` | Aunty Bisi, a kind middle-aged woman who cleans tables, red-and-cream ankara wrapper and matching gele headtie, holding a stack of clean white plates and a dishcloth, head-and-shoulders portrait. |
| 3 | `staff:basira` | Iya Basira, a confident older woman cook, purple-and-gold ankara with gele, stirring a big black pot with a wooden spoon, steam rising, head-and-shoulders portrait. |
| 4 | `staff:tunde` | Tunde, an experienced head server in his thirties, blue ankara shirt and blue cap, carrying two plates with a big smile, head-and-shoulders portrait. |
| 5 | `staff:emeka` | Emeka, a dispatch rider in his twenties, red helmet with visor up, green reflective vest over a red shirt, thumbs up, a red delivery box strapped behind him, head-and-shoulders portrait. |
| 6 | `staff:musa` | Musa, an express dispatch rider, green helmet, cream jacket, leaning forward on a motorcycle handlebar ready to go, head-and-shoulders portrait. |
| 7 | `staff:ngozi` | Ngozi, a young woman on a market errand, orange-and-teal ankara with a small gele, carrying a woven basket of tomatoes, peppers, onions and a crate of drinks, head-and-shoulders portrait. |

### Delivery and packing (order cards)

| # | Key | Prompt |
| --- | --- | --- |
| 8 | `online` | A smartphone showing a simple food order screen with a plate icon and a green tick (no readable text), small motorcycle icon beside it. |
| 9 | `rider` | A full-body Lagos dispatch rider on a small red motorcycle (okada) with a red insulated food delivery box on the back, helmet on, riding to the right, generic bike with no brand or plate. |
| 10 | `pack` | A white styrofoam takeaway food pack, lid half open showing jollof rice, chicken and dodo inside, with a small sachet of pure water beside it. |
| 11 | `cooler` | A big blue party food cooler (warmer) with a lid, the kind used for Nigerian party jollof, a serving spoon resting on top. |

### Catering events (event order cards)

| # | Key | Prompt |
| --- | --- | --- |
| 12 | `event:birthday` | A small birthday party table: a colourful cake with candles, balloons and a tray of jollof rice and chicken. |
| 13 | `event:naming` | A Nigerian naming ceremony table: a small bowl each of honey, kola nut, bitter kola, salt and a calabash of water, a baby's white shawl folded beside them. |
| 14 | `event:dedication` | A child dedication celebration: a baby in a white lace outfit in a basket with white and gold ribbons and a small tray of fried rice. |
| 15 | `event:wedding` | An Owambe wedding: a tiered white cake, gold aso-ebi fabric, a gele and a big cooler of party jollof. |
| 16 | `event:burial` | A respectful Nigerian burial reception: a white canopy tent, white flowers and rows of covered food coolers, calm colours. |
| 17 | `event:housewarming` | A house warming: a small colourful house with an open door, a pot of pepper soup and drinks on a table in front. |
| 18 | `event:chieftaincy` | A chieftaincy celebration: a red chief's cap, beads and a carved walking stick beside a tray of pounded yam and egusi. |

### Branches (Grow screen)

| # | Key | Prompt |
| --- | --- | --- |
| 19 | `place:ojuelegba` | A small roadside mama put buka with a zinc roof, wooden bench and pots on a table, busy Lagos street corner behind it. |
| 20 | `place:yaba` | A busy junction food spot in Yaba with a bright orange awning, plastic chairs and a yellow danfo bus passing. |
| 21 | `place:mushin` | A lively amala spot in Mushin with a red awning, clay pots of soup and a crowd of happy customers. |
| 22 | `place:ikeja` | A neat catering kitchen and shop front in Ikeja GRA with purple and gold decorations and party coolers lined up. |
| 23 | `place:lekki` | A modern mama put restaurant in Lekki Phase 1 with glass front, teal sign shape (no text), fairy lights and potted palms. |
| 24 | `place:abuja` | A big food stall at Wuse Market, Abuja, with green-and-white canopies, stacked yams and a busy market behind. |

### Customers (optional, for a future customer guide)

| # | Key | Prompt |
| --- | --- | --- |
| 25 | `customer:odogwu` | An "Odogwu": a flashy, generous big man in a rich maroon agbada with gold embroidery, gold chain and red fila cap, holding out a fan of green banknotes with no readable numbers, laughing. |
| 26 | `customer:okada` | An okada rider customer in an orange reflective vest and yellow helmet, holding a takeaway pack. |
| 27 | `customer:conductor` | A danfo bus conductor in a yellow shirt and black cap, hanging off a yellow bus door and waving. |
| 28 | `customer:schoolkid` | A happy Nigerian schoolchild in a blue school uniform with a backpack, holding a sachet of pure water. |
| 29 | `customer:alhaji` | A calm, dignified Alhaji in a white kaftan and white kufi cap with gold trim, holding prayer beads. |

## Install the images

1. Shrink each to **256x256**, e.g. `magick emeka.png -resize 256x256 -quality 85 emeka.webp`. Keep the 1024px masters outside `public/`, as the food masters are in `art/`.
2. Copy the small files into [`public/ui/`](../public/ui/).
3. List them in [`public/ui/manifest.json`](../public/ui/manifest.json):

   ```json
   {
     "staff:emeka": "emeka.webp",
     "online": "online.webp",
     "event:burial": "burial.webp",
     "place:yaba": "yaba.webp"
   }
   ```

4. Reload the game.

Where the game uses each key:

- **`staff:*`:** portraits on the staff cards.
- **`online` and `event:*`:** icons on the order cards above the food buttons.
- **`place:*`:** pictures on the Grow screen.

The `rider`, `pack`, `cooler` and `customer:*` images are not shown anywhere yet. The 3D rider, okada and customers in the scene stay procedural.
