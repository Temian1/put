import { today, seeded, hashStr } from "./utils.js";

// Prices are naira per portion at a working-class Lagos mainland buka (2026).
// A typical rice + protein + side order lands in the ₦1,500–₦2,500 plate range.
// kind drives order assembly: mains are dished first, soups follow swallows,
// proteins and sides go on top, drinks can be served at any time.
const FOODS = {
  jollof: {
    name: "Jollof Rice",
    short: "Jollof",
    price: 900,
    color: "#FF6B2C",
    station: "pot",
    kind: "main",
  },
  friedrice: {
    name: "Fried Rice",
    short: "Fried Rice",
    price: 1000,
    color: "#E9B323",
    station: "pot",
    kind: "main",
  },
  whiterice: {
    name: "Rice & Stew",
    short: "Rice & Stew",
    price: 800,
    color: "#D8402A",
    station: "pot",
    kind: "main",
  },
  beans: {
    name: "Ewa Agoyin",
    short: "Beans",
    price: 700,
    color: "#A0522D",
    station: "pot",
    kind: "main",
  },
  eba: {
    name: "Eba",
    short: "Eba",
    price: 400,
    color: "#E8C15A",
    station: "basin",
    kind: "main",
    swallow: true,
  },
  amala: {
    name: "Amala",
    short: "Amala",
    price: 500,
    color: "#7A5A48",
    station: "basin",
    kind: "main",
    swallow: true,
  },
  poundedyam: {
    name: "Pounded Yam",
    short: "Iyan",
    price: 800,
    color: "#BFA97A",
    station: "mortar",
    kind: "main",
    swallow: true,
  },
  peppersoup: {
    name: "Goat Pepper Soup",
    short: "Pepper Soup",
    price: 2500,
    color: "#B5461F",
    station: "pot",
    kind: "main",
  },
  egusi: {
    name: "Egusi Soup",
    short: "Egusi",
    price: 700,
    color: "#C9A12A",
    station: "pot",
    kind: "soup",
  },
  efo: {
    name: "Efo Riro",
    short: "Efo Riro",
    price: 800,
    color: "#2E7D32",
    station: "pot",
    kind: "soup",
  },
  ewedu: {
    name: "Ewedu & Gbegiri",
    short: "Abula",
    price: 500,
    color: "#5E9E3A",
    station: "pot",
    kind: "soup",
  },
  beef: {
    name: "Beef",
    short: "Beef",
    price: 600,
    color: "#8E3E19",
    station: "pot",
    kind: "protein",
  },
  chicken: {
    name: "Fried Chicken",
    short: "Chicken",
    price: 2500,
    color: "#C8812F",
    station: "pan",
    kind: "protein",
    cook: { time: 3.6, hold: Infinity, batch: 3, verb: "Fry" },
  },
  fish: {
    name: "Fried Fish",
    short: "Fish",
    price: 1200,
    color: "#7B8A99",
    station: "grill",
    kind: "protein",
    cook: { time: 3.2, hold: Infinity, batch: 3, verb: "Fry" },
  },
  egg: {
    name: "Boiled Egg",
    short: "Egg",
    price: 300,
    color: "#F2C14E",
    station: "pot",
    kind: "protein",
  },
  plantain: {
    name: "Dodo",
    short: "Dodo",
    price: 500,
    color: "#FFAA1F",
    station: "pan",
    kind: "side",
    cook: { time: 2.4, hold: Infinity, batch: 4, verb: "Fry" },
  },
  moimoi: {
    name: "Moi Moi",
    short: "Moi Moi",
    price: 700,
    color: "#E0683A",
    station: "basin",
    kind: "side",
  },
  water: {
    name: "Pure Water",
    short: "Pure Water",
    price: 100,
    color: "#3FA9F5",
    station: "cooler",
    kind: "drink",
  },
  zobo: {
    name: "Zobo",
    short: "Zobo",
    price: 500,
    color: "#C2185B",
    station: "cooler",
    kind: "drink",
  },
  mineral: {
    name: "Mineral",
    short: "Mineral",
    price: 700,
    color: "#E53935",
    station: "cooler",
    kind: "drink",
  },
  malt: {
    name: "Malt",
    short: "Malt",
    price: 800,
    color: "#5D3A1A",
    station: "cooler",
    kind: "drink",
  },
};
const CHAPTERS = [
  {
    name: "Roadside Buka",
    foods: ["jollof", "beef", "plantain", "water"],
    items: [1, 2],
    boss: "First Lunch Rush",
    color: "#FF7A1A",
    intro: "Jollof, beef, dodo and pure water. Learn the ropes!",
  },
  {
    name: "Junction Food Spot",
    foods: ["whiterice", "beans", "beef", "egg", "plantain", "moimoi", "zobo"],
    items: [2, 2],
    boss: "Busy Junction Rush",
    color: "#12A99F",
    intro: "Rice and stew, ewa agoyin and moi moi. Clear your tables!",
  },
  {
    name: "Swallow Joint",
    foods: ["eba", "amala", "egusi", "ewedu", "beef", "fish", "water"],
    items: [2, 3],
    boss: "Friday Evening Rush",
    color: "#FF5A5F",
    vip: 0.15,
    intro: "Every swallow needs its soup. VIP customers tip double.",
  },
  {
    name: "Owambe Catering",
    foods: ["jollof", "friedrice", "chicken", "moimoi", "plantain", "mineral"],
    items: [2, 3],
    boss: "Owambe Wedding Rush",
    color: "#7B2E8E",
    vip: 0.15,
    guests: true,
    intro: "Party jollof, fried rice and chicken for guests in aso-ebi.",
  },
  {
    name: "Mama Put Empire",
    foods: [
      "poundedyam",
      "efo",
      "egusi",
      "peppersoup",
      "chicken",
      "fish",
      "malt",
    ],
    items: [2, 4],
    boss: "Grand Opening Mega Rush",
    color: "#0F4C5C",
    vip: 0.25,
    fast: true,
    intro:
      "Iyan, efo riro and goat pepper soup for the fastest crowd in Lagos.",
  },
  // Levels 51-100: the business outgrows one buka. theme picks the 3D
  // environment, sign writes the chapter's own signboard.
  {
    name: "Ikeja City Restaurant",
    foods: [
      "jollof",
      "friedrice",
      "whiterice",
      "chicken",
      "fish",
      "plantain",
      "moimoi",
      "mineral",
    ],
    items: [2, 4],
    boss: "Ikeja Office Lunch Stampede",
    color: "#B7472A",
    vip: 0.25,
    fast: true,
    theme: 3,
    sign: ["IKEJA CITY RESTAURANT", "Mama Put • Since the roadside days"],
    intro: "Office workers on lunch break. Tables, taxes and inspectors now.",
  },
  {
    name: "Port Harcourt Branch",
    foods: [
      "eba",
      "poundedyam",
      "egusi",
      "efo",
      "peppersoup",
      "fish",
      "beef",
      "malt",
    ],
    items: [2, 4],
    boss: "Garden City Rush",
    color: "#1D6E8C",
    vip: 0.25,
    fast: true,
    theme: 2,
    sign: ["PORT HARCOURT BRANCH", "Mama Put • Garden City"],
    intro: "Swallow and pepper soup for the Garden City crowd.",
  },
  {
    name: "Abuja Food Court",
    foods: [
      "amala",
      "ewedu",
      "eba",
      "egusi",
      "beans",
      "plantain",
      "egg",
      "zobo",
      "water",
    ],
    items: [2, 4],
    boss: "Central Area Mega Lunch",
    color: "#2F7D3A",
    vip: 0.3,
    fast: true,
    theme: 4,
    sign: ["ABUJA FOOD COURT", "Mama Put • Wuse"],
    intro: "Nine dishes, three lanes and the busiest food court in Abuja.",
  },
  {
    name: "Catering Company",
    foods: [
      "jollof",
      "friedrice",
      "chicken",
      "moimoi",
      "plantain",
      "beef",
      "peppersoup",
      "mineral",
      "malt",
    ],
    items: [2, 4],
    boss: "Society Wedding of the Year",
    color: "#7B2E8E",
    vip: 0.3,
    guests: true,
    fast: true,
    theme: 3,
    sign: ["MAMA PUT CATERING", "Weddings • Burials • Naming"],
    intro: "Events every few levels. A bus and riders make the difference.",
  },
  {
    name: "Food Empire HQ",
    foods: [
      "jollof",
      "whiterice",
      "eba",
      "poundedyam",
      "egusi",
      "efo",
      "chicken",
      "fish",
      "malt",
    ],
    items: [3, 4],
    boss: "The Empire Grand Finale",
    color: "#0F4C5C",
    vip: 0.35,
    fast: true,
    theme: 4,
    sign: ["MAMA PUT EMPIRE HQ", "From Roadside Buka to Food Empire"],
    intro: "The final chapter: every dish, every customer, every bill.",
  },
];
// 10 chapters of 10 levels.
const MAX_LEVEL = CHAPTERS.length * 10;
const UPGRADES = [
  {
    id: "fast",
    name: "Sharp Sharp Hands",
    desc: "Serve and fry faster",
    icon: "⚡",
    bg: "#FFE3B0",
    costs: [2500, 5500, 10000, 16000, 25000],
  },
  {
    id: "patience",
    name: "Sweet Mouth",
    desc: "Customers wait 10% longer per level",
    icon: "😊",
    bg: "#C9F2EE",
    costs: [3000, 6500, 11000, 17500, 27500],
  },
  {
    id: "tips",
    name: "Big Tips",
    desc: "+10% naira on every order",
    icon: "💵",
    bg: "#FFF1A8",
    costs: [3750, 7500, 13000, 20000, 30000],
  },
  {
    id: "time",
    name: "Generator",
    desc: "+6 seconds on every level clock",
    icon: "🔌",
    bg: "#FFD1D2",
    costs: [2500, 5500, 10000, 16000, 25000],
  },
];
// Staff are hired once and paid a salary (wage) after every shift they work.
// Unpaid three shifts in a row, they quit; they can also be sacked to save money.
const STAFF = [
  {
    id: "chidi",
    name: "Chidi",
    role: "server",
    title: "Apprentice server",
    desc: "Dishes one item for the most urgent customer every few seconds",
    cost: 20000,
    wage: 500,
    interval: 5,
    a: "#12A99F",
    b: "#FFC531",
    skin: 2,
  },
  {
    id: "bisi",
    name: "Aunty Bisi",
    role: "cleaner",
    title: "Table cleaner",
    desc: "Clears dirty tables and washes plates for you",
    cost: 30000,
    wage: 700,
    interval: 1.4,
    a: "#FF5A5F",
    b: "#FFF4DE",
    skin: 0,
    hat: "gele",
  },
  {
    id: "basira",
    name: "Iya Basira",
    role: "cook",
    title: "Cook",
    desc: "Cooks a fresh pot or pan when food finishes",
    cost: 45000,
    wage: 1000,
    interval: 1.1,
    a: "#6B2D8C",
    b: "#FFC531",
    skin: 4,
    hat: "gele",
  },
  {
    id: "tunde",
    name: "Tunde",
    role: "server",
    title: "Head server",
    desc: "Experienced server. Dishes items faster than Chidi",
    cost: 80000,
    wage: 1500,
    interval: 3.6,
    a: "#1E5AA8",
    b: "#FFC531",
    skin: 1,
    hat: "cap",
  },
  {
    id: "emeka",
    name: "Emeka",
    role: "rider",
    title: "Dispatch rider",
    desc: "Packs finished online orders and delivers them on his okada. No call-out fee",
    cost: 25000,
    wage: 600,
    interval: 1.2,
    trip: 9,
    a: "#E53935",
    b: "#FFC531",
    skin: 3,
    hat: "helmet",
  },
  {
    id: "musa",
    name: "Musa",
    role: "rider",
    title: "Express rider",
    desc: "Faster dispatch rider for busy online days and event deliveries",
    cost: 55000,
    wage: 900,
    interval: 0.9,
    trip: 6,
    a: "#2FA34F",
    b: "#FFF4DE",
    skin: 5,
    hat: "helmet",
  },
  {
    id: "ngozi",
    name: "Ngozi",
    role: "errand",
    title: "Market errand",
    desc: "Restocks drinks and buys ingredients at the market 20% cheaper",
    cost: 18000,
    wage: 400,
    interval: 1.3,
    a: "#F39A1E",
    b: "#12A99F",
    skin: 2,
    hat: "gele",
  },
];
// Shown on every customer's bubble. VIPs and some kinds add a title.
const NAMES = [
  "Adaeze",
  "Chinedu",
  "Tunde",
  "Bisola",
  "Ifeanyi",
  "Ngozi",
  "Musa",
  "Aisha",
  "Emeka",
  "Funmi",
  "Yusuf",
  "Amaka",
  "Segun",
  "Halima",
  "Obinna",
  "Kemi",
  "Sani",
  "Chioma",
  "Babatunde",
  "Zainab",
  "Uche",
  "Folake",
  "Ibrahim",
  "Nneka",
  "Dapo",
  "Hauwa",
  "Kelechi",
  "Yetunde",
  "Bello",
  "Ebere",
  "Tobi",
  "Fatima",
  "Ikenna",
  "Shade",
  "Garba",
  "Onyinye",
  "Wale",
  "Maryam",
  "Chukwuma",
  "Titi",
  "Efosa",
  "Ese",
  "Ofon",
  "Tamuno",
  "Idris",
  "Kunle",
  "Ijeoma",
  "Bukola",
];
const AREAS = [
  "Yaba",
  "Surulere",
  "Ikeja",
  "Lekki",
  "Ajah",
  "Ikorodu",
  "Festac",
  "Gbagada",
  "Ogba",
  "Maryland",
  "Obalende",
  "Oshodi",
  "Agege",
  "Ojota",
];
// Station stock: every pot, basin and cooler holds a batch that runs out and
// must be cooked again. Fried food (FOODS[...].cook) starts empty each day.
const STOCK = {
  pot: { time: 4.5, hold: Infinity, batch: 8, verb: "Cook" },
  basin: { time: 2.6, hold: Infinity, batch: 6, verb: "Make" },
  mortar: { time: 3.6, hold: Infinity, batch: 5, verb: "Pound" },
  cooler: { time: 3, hold: Infinity, batch: 10, verb: "Restock" },
};
// Ingredients cost this share of the menu price when a batch is cooked.
const FOOD_COST = 0.3;
// Bulk catering orders. size is the total number of portions to pack.
const EVENTS = {
  birthday: {
    name: "Birthday party",
    icon: "🎂",
    size: 8,
    menu: ["jollof", "friedrice", "chicken", "plantain", "moimoi", "mineral"],
  },
  naming: {
    name: "Naming ceremony",
    icon: "👶",
    size: 10,
    menu: ["jollof", "friedrice", "moimoi", "chicken", "malt"],
  },
  wedding: {
    name: "Owambe wedding",
    icon: "💍",
    size: 14,
    menu: ["jollof", "friedrice", "chicken", "plantain", "moimoi", "mineral"],
  },
  dedication: {
    name: "Child dedication",
    icon: "🙏",
    size: 10,
    menu: ["friedrice", "jollof", "chicken", "moimoi", "zobo"],
  },
  burial: {
    name: "Burial reception",
    icon: "🕊️",
    size: 14,
    menu: ["poundedyam", "egusi", "efo", "jollof", "chicken", "fish", "malt"],
  },
  housewarming: {
    name: "House warming",
    icon: "🏠",
    size: 9,
    menu: ["jollof", "peppersoup", "chicken", "malt", "mineral"],
  },
  chieftaincy: {
    name: "Chieftaincy title",
    icon: "👑",
    size: 16,
    menu: ["poundedyam", "egusi", "peppersoup", "chicken", "fish", "malt"],
  },
};
const EVENT_LEVELS = {
  27: "birthday",
  32: "naming",
  35: "wedding",
  38: "dedication",
  42: "burial",
  45: "housewarming",
  48: "chieftaincy",
  53: "birthday",
  57: "naming",
  63: "burial",
  66: "dedication",
  72: "wedding",
  75: "housewarming",
  78: "birthday",
  82: "wedding",
  84: "burial",
  86: "naming",
  88: "chieftaincy",
  93: "wedding",
  96: "burial",
  98: "chieftaincy",
};
// Growth: lifetime sales and reputation decide how big the business is.
const TIERS = [
  { name: "Roadside Buka", earn: 0, rep: 0 },
  { name: "Busy Buka", earn: 250000, rep: 48 },
  { name: "Popular Joint", earn: 1200000, rep: 56 },
  { name: "Catering Business", earn: 4000000, rep: 64 },
  { name: "Food Empire", earn: 12000000, rep: 72 },
];
// Every chapter is a restaurant. Beating the chapter before it lets you open
// it, but only by paying the opening cost (rent, fitting out, permits).
// Restaurants you have opened keep earning after every shift and can be
// visited or replayed at any time.
const OPENING = [
  { area: "Ojuelegba, Surulere", cost: 0, income: 0 },
  { area: "Yaba, Lagos", cost: 50000, income: 1500 },
  { area: "Mushin, Lagos", cost: 120000, income: 3000 },
  { area: "Ikeja GRA, Lagos", cost: 250000, income: 5000 },
  { area: "Victoria Island, Lagos", cost: 450000, income: 7500 },
  { area: "Allen Avenue, Ikeja", cost: 700000, income: 10000 },
  { area: "GRA, Port Harcourt", cost: 1000000, income: 13000 },
  { area: "Wuse II, Abuja", cost: 1400000, income: 17000 },
  { area: "Lekki Phase 1, Lagos", cost: 1900000, income: 22000 },
  { area: "Ikoyi, Lagos", cost: 2500000, income: 28000 },
];
const PLACES = CHAPTERS.map((ch, i) => ({
  id: "ch" + i,
  chapter: i,
  name: ch.name,
  ci: ch.theme ?? i,
  sign: ch.sign || null,
  firstLevel: i * 10 + 1,
  ...OPENING[i],
}));
// Branch ids used before restaurants were tied to chapters.
const LEGACY_PLACES = {
  ojuelegba: "ch0",
  yaba: "ch1",
  mushin: "ch2",
  ikeja: "ch3",
  lekki: "ch4",
  abuja: "ch7",
};
const BOOSTERS = [
  {
    id: "freeze",
    name: "Freeze Time",
    desc: "Stops the clock and every customer's patience for 8 seconds",
    icon: "❄️",
    bg: "#CDEBFF",
    cost: 2500,
    duration: 8,
  },
  {
    id: "auto",
    name: "Auto-Serve",
    desc: "Instantly completes the most urgent customer's whole order",
    icon: "🛎️",
    bg: "#FFE3B0",
    cost: 3500,
  },
  {
    id: "calm",
    name: "Patience Boost",
    desc: "Refills the patience of everyone waiting",
    icon: "💛",
    bg: "#FFF1A8",
    cost: 2000,
  },
];
// Customer kinds change looks, patience, tipping and what they like to order.
const CUSTOMER_TYPES = {
  regular: { name: "Customer", patience: 1, tip: 1, weight: 5, minCi: 0 },
  schoolkid: {
    name: "Schoolkid",
    patience: 0.85,
    tip: 0.5,
    weight: 2,
    minCi: 0,
    minLevel: 3,
    scale: 0.72,
    maxItems: 2,
    body: "#2E6FD8",
    accent: "#FFFFFF",
    hat: "afro",
    likes: ["jollof", "plantain", "water", "zobo", "egg", "moimoi", "beans"],
  },
  okada: {
    name: "Okada rider",
    patience: 0.75,
    tip: 1.3,
    weight: 2,
    minCi: 1,
    body: "#FF8F00",
    accent: "#FFE082",
    hat: "helmet",
    likes: ["beans", "whiterice", "eba", "beef", "water", "malt"],
  },
  conductor: {
    name: "Danfo conductor",
    patience: 0.85,
    tip: 1,
    weight: 2,
    minCi: 1,
    extraItem: true,
    body: "#F5C518",
    accent: "#1A1A1A",
    hat: "cap",
    likes: ["whiterice", "beans", "plantain", "beef", "zobo", "mineral"],
  },
  alhaji: {
    name: "Alhaji",
    patience: 1.35,
    tip: 1.6,
    weight: 1,
    minCi: 2,
    body: "#F4F1E8",
    accent: "#C9A227",
    hat: "kufi",
    scale: 1.06,
    likes: ["amala", "poundedyam", "egusi", "peppersoup", "chicken", "malt"],
  },
  // Buys something small and pays far more than the bill: "Keep the change!"
  odogwu: {
    name: "Odogwu",
    patience: 1.1,
    tip: 1,
    bigTip: [2000, 5000],
    weight: 0.7,
    minCi: 0,
    minLevel: 8,
    maxItems: 1,
    body: "#7A1E1E",
    accent: "#FFC531",
    hat: "fila",
    scale: 1.08,
    likes: ["water", "plantain", "egg", "zobo", "moimoi", "eba", "beef"],
  },
};
const MOODS = {
  calm: { e: "😌", label: "Calm", patience: 1.2, tip: 1, wrong: 1 },
  hungry: { e: "🤤", label: "Hungry", patience: 0.85, tip: 1.1, wrong: 1 },
  generous: { e: "💸", label: "Generous", patience: 1, tip: 1.6, wrong: 1 },
  grumpy: { e: "😤", label: "Grumpy", patience: 0.95, tip: 0.8, wrong: 2 },
};
const OUTFITS = [
  {
    id: "classic",
    name: "Classic Ankara",
    cost: 0,
    a: "#FF7A1A",
    b: "#12A99F",
  },
  { id: "teal", name: "Lagos Teal", cost: 9000, a: "#12A99F", b: "#FFC531" },
  {
    id: "royal",
    name: "Royal Purple",
    cost: 20000,
    a: "#6B2D8C",
    b: "#FFC531",
  },
  { id: "gold", name: "Owambe Gold", cost: 37500, a: "#E3A21A", b: "#FF5A5F" },
];
const DECOR = [
  {
    id: "plants",
    name: "Potted Plants",
    desc: "Green plants at the counter",
    icon: "🪴",
    bg: "#D3F5DA",
    cost: 6000,
  },
  {
    id: "bunting",
    name: "Party Bunting",
    desc: "Ankara flags over the street",
    icon: "🎏",
    bg: "#FFE3B0",
    cost: 7500,
  },
  {
    id: "lights",
    name: "Fairy Lights",
    desc: "Warm lights for evening rush",
    icon: "✨",
    bg: "#FFF1A8",
    cost: 15000,
  },
];
const LINES = {
  arrive: [
    "Madam, sharp sharp!",
    "I dey hungry o!",
    "Abeg serve me quick!",
    "Mama, wetin dey?",
    "Na your food I wan chop!",
    "Aunty, how far?",
  ],
  jollof: ["Aunty, my jollof abeg!", "Jollof wey get party taste!"],
  whiterice: ["Rice and stew, put plenty stew!"],
  beans: ["Ewa agoyin with bread!", "Beans wey sweet like this!"],
  plantain: ["Add dodo for me!", "Dodo plenty o!"],
  beef: ["Abeg add meat!", "Two meat, make e big!"],
  chicken: ["Give me the big chicken!"],
  fish: ["Fish wey dry well well!"],
  water: ["Add one pure water!"],
  zobo: ["Abeg add cold zobo!"],
  mineral: ["Cold mineral abeg!"],
  amala: ["Amala, gbegiri, ewedu!"],
  eba: ["Eba and egusi, my favourite!"],
  peppersoup: ["Goat meat pepper soup, make e hot!"],
  guest: [
    "Owambe don start!",
    "Where my party jollof?",
    "Mama, bring the chicken!",
  ],
  vip: ["Chief don land!", "Big man dey here o!"],
  schoolkid: [
    "Aunty, I wan buy food!",
    "Break time don nearly finish!",
    "Mummy give me money for food!",
  ],
  okada: [
    "Oya quick, I get passenger!",
    "Madam, I dey rush o!",
    "Make I chop go back road!",
  ],
  conductor: [
    "Obalende! CMS! Mama, my food!",
    "Enter with your change o!",
    "Owa! Serve me quick!",
  ],
  alhaji: [
    "Salam alaikum, Mama.",
    "Take your time, make e sweet.",
    "Alhaji don come!",
  ],
  odogwu: [
    "Odogwu don land!",
    "Mama, small food. Big money!",
    "Na me be the odogwu!",
  ],
  change: ["Keep the change!", "No wahala, keep am!", "Use am buy pure water!"],
  complain: [
    "Mama, the food don finish?!",
    "Abeg cook am quick o!",
    "Wetin? E don finish again?",
  ],
  happy: [
    "Omo, this food sweet!",
    "Ah! Na correct food be this!",
    "You sabi cook!",
    "God bless your hand!",
    "E choke!",
    "Mama Put no dey disappoint!",
  ],
  wrong: ["No be this one o!", "Ehn? I no order am!", "Check am well, Aunty!"],
  angry: ["Madam, sharp sharp!", "Wetin dey delay?", "Hunger wan kill me o!"],
  leave: ["I don tire!", "Next time sha…", "Ah, I go find food!"],
};

function chapterOf(n) {
  return Math.min(CHAPTERS.length - 1, Math.floor((n - 1) / 10));
}
// Mechanics unlock gradually: plates are assembled from level 3, pans need
// frying from level 4 and dirty tables appear from chapter two.
// Every pot runs out from level 6, online orders arrive from level 15 and
// bulk event orders (parties, burials, naming ceremonies) from level 27.
const UNLOCKS = {
  assembly: 3,
  cooking: 4,
  stock: 6,
  dishes: 11,
  online: 15,
  inspect: 20,
  events: 27,
  haggle: 8,
};
function levelCfg(n) {
  const ci = chapterOf(n),
    ch = CHAPTERS[ci],
    local = (n - 1) % 10,
    boss = local === 9;
  const lanes = ci === 0 ? 1 : ci === 1 ? 2 : ci === 2 && local < 2 ? 2 : 3;
  let imin = ch.items[0],
    imax = ch.items[1];
  const p2 = ci === 0 ? Math.min(0.8, 0.3 + local * 0.06) : 0.5;
  const foods = ch.foods.slice();
  const goal =
    (ci === 0 ? 5 + Math.floor(local * 0.7) : 6 + local + ci * 2) +
    (boss ? 4 : 0);
  const patience = Math.max(8.5, 24 - ci * 2.2 - local * 0.55 - (boss ? 2 : 0));
  const avgItems = imax - imin === 1 ? imin + p2 : (imin + imax) / 2;
  const cycle = 3.2 + avgItems * 1.3 + 1;
  const assembly = n >= UNLOCKS.assembly,
    cooking = n >= UNLOCKS.cooking && foods.some((f) => FOODS[f].cook),
    dishes = n >= UNLOCKS.dishes,
    stock = n >= UNLOCKS.stock,
    haggle = n >= UNLOCKS.haggle,
    inspect = n >= UNLOCKS.inspect,
    online = n >= UNLOCKS.online,
    event = EVENT_LEVELS[n] || "";
  // Frying, restocking, table clearing and deliveries add work, so the clock grows.
  const extra =
    goal *
      ((cooking ? 0.9 : 0) +
        (dishes ? 1.1 : 0) +
        (stock ? 0.5 : 0) +
        (online ? 0.6 : 0)) +
    (event ? 35 : 0);
  const duration = Math.round(
    ((goal * cycle) / lanes) * (1.35 - ci * 0.04 - local * 0.01) + 20 + extra,
  );
  const gap = boss ? [0.5, 1.3] : [1 - ci * 0.1, 2.6 - ci * 0.25];
  const avgPrice = foods.reduce((s, f) => s + FOODS[f].price, 0) / foods.length;
  const base = goal * avgPrice * avgItems * (1 + (ch.vip || 0));
  const stars = [base * 0.6, base * 1.05, base * 1.35].map(
    (v) => Math.round(v / 100) * 100,
  );
  let challenge = "",
    teach = "";
  if (boss) challenge = "Rush hour: customers come back to back";
  else if (n === UNLOCKS.assembly) {
    challenge = "New: dish the rice before the meat and dodo";
    teach = "assembly";
  } else if (n === UNLOCKS.cooking) {
    challenge = "New: fry the dodo before you serve it";
    teach = "cooking";
  } else if (n === UNLOCKS.stock) {
    challenge = "New: pots finish. Cook again before customers vex";
    teach = "stock";
  } else if (n === UNLOCKS.haggle) {
    challenge = "New: customers may argue the price";
    teach = "haggle";
  } else if (n === UNLOCKS.inspect) {
    challenge = "New: health inspectors can visit. Keep it clean!";
    teach = "inspect";
  } else if (n === UNLOCKS.dishes) {
    challenge = "New: clear dirty tables and wash plates";
    teach = "dishes";
  } else if (n === UNLOCKS.online) {
    challenge = "New: online orders. Pack them and send a rider";
    teach = "online";
  } else if (event) {
    challenge = `Catering: ${EVENTS[event].name} order today`;
    teach = n === UNLOCKS.events ? "events" : "";
  } else if (ci === 2 && local === 0) {
    challenge = "New: every swallow comes with soup";
    teach = "swallow";
  } else if (ci === 2 && local === 2)
    challenge = "New: three lanes and VIP customers";
  else if (ci === 3 && local === 0) challenge = "Wedding guests in aso-ebi";
  else if (ci === 4 && local === 0) challenge = "Fast customers. Move quick!";
  return {
    mode: "level",
    n,
    ci,
    local,
    boss,
    title: boss ? ch.boss : ch.name,
    lanes,
    imin,
    imax,
    p2,
    foods,
    goal,
    patience,
    duration,
    gap,
    vip: ch.vip || 0,
    guests: !!ch.guests,
    fast: !!ch.fast,
    stars,
    coinMult: 1,
    challenge,
    teach,
    assembly,
    cooking,
    dishes,
    stock,
    online,
    event,
    haggle,
    inspect,
    theme: ch.theme ?? ci,
    sign: ch.sign || null,
    tutorial: n <= 2,
  };
}
const DAILY_MODS = [
  {
    id: "hungry",
    e: "😤",
    name: "Hungry Crowd",
    desc: "Customers have 20% less patience",
    apply: (c) => {
      c.patience *= 0.8;
    },
  },
  {
    id: "tips",
    e: "💸",
    name: "Double Tips",
    desc: "Every order pays double naira",
    apply: (c) => {
      c.coinMult *= 2;
    },
  },
  {
    id: "big",
    e: "🍽️",
    name: "Big Belle Orders",
    desc: "Orders have one extra item",
    apply: (c) => {
      c.imin = Math.min(c.imin + 1, c.foods.length);
      c.imax = Math.min(c.imax + 1, c.foods.length);
    },
  },
  {
    id: "vip",
    e: "👑",
    name: "Big Man Day",
    desc: "Lots of VIP customers",
    apply: (c) => {
      c.vip = 0.45;
    },
  },
  {
    id: "nepa",
    e: "💡",
    name: "NEPA Don Take Light",
    desc: "15% less time on the clock",
    apply: (c) => {
      c.duration = Math.round(c.duration * 0.85);
    },
  },
  {
    id: "crowd",
    e: "👥",
    name: "Market Day",
    desc: "Four more customers to serve",
    apply: (c) => {
      c.goal += 4;
      c.duration += 18;
    },
  },
];
function dailyCfg(unlocked = 1, key = today()) {
  const rng = seeded(hashStr(key));
  const maxN = Math.max(1, Math.min(MAX_LEVEL, unlocked));
  const n = 1 + Math.floor(rng() * maxN);
  const c = levelCfg(n);
  const pool = DAILY_MODS.slice(),
    mods = [];
  for (let i = 0; i < 2; i++) {
    mods.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  mods.forEach((m) => m.apply(c));
  c.mode = "daily";
  c.mods = mods;
  c.title = "Daily Challenge";
  c.tutorial = false;
  c.teach = "";
  c.boss = false;
  c.challenge = mods.map((m) => m.name).join(" + ");
  c.stars = c.stars.map(
    (v) => Math.round((v * (c.goal / levelCfg(n).goal)) / 100) * 100,
  );
  return c;
}
function endlessCfg() {
  return {
    mode: "endless",
    n: 0,
    ci: 4,
    title: "Endless Rush",
    lanes: 2,
    imin: 1,
    imax: 2,
    p2: 0.5,
    foods: [
      "jollof",
      "whiterice",
      "eba",
      "egusi",
      "beef",
      "chicken",
      "plantain",
      "water",
    ],
    goal: Infinity,
    patience: 22,
    duration: Infinity,
    gap: [0.8, 2],
    vip: 0.15,
    guests: false,
    fast: false,
    stars: [0, 0, 0],
    coinMult: 1,
    challenge: "Serve as many as you can!",
    teach: "",
    assembly: true,
    cooking: true,
    dishes: true,
    stock: true,
    online: true,
    event: "random",
    haggle: true,
    inspect: true,
    theme: 4,
    sign: null,
    tutorial: false,
  };
}

export {
  FOODS,
  CHAPTERS,
  UPGRADES,
  STAFF,
  BOOSTERS,
  CUSTOMER_TYPES,
  MOODS,
  OUTFITS,
  DECOR,
  LINES,
  UNLOCKS,
  MAX_LEVEL,
  NAMES,
  AREAS,
  STOCK,
  FOOD_COST,
  EVENTS,
  EVENT_LEVELS,
  TIERS,
  PLACES,
  LEGACY_PLACES,
  chapterOf,
  levelCfg,
  DAILY_MODS,
  dailyCfg,
  endlessCfg,
};
