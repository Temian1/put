import { today, seeded, hashStr } from "./utils.js";

const FOODS = {
  jollof: { name: "Jollof", price: 30, color: "#FF6B2C", station: "pot" },
  plantain: { name: "Dodo", price: 20, color: "#FFAA1F", station: "pan" },
  drink: { name: "Zobo", price: 15, color: "#C2185B", station: "cooler" },
  friedrice: {
    name: "Fried Rice",
    price: 35,
    color: "#E9B323",
    station: "pot",
  },
  puffpuff: { name: "Puff-Puff", price: 20, color: "#C8812F", station: "pan" },
  amala: { name: "Amala", price: 40, color: "#7A5A48", station: "pot" },
  suya: { name: "Suya", price: 45, color: "#B5461F", station: "grill" },
  partyjollof: {
    name: "Party Jollof",
    price: 50,
    color: "#E2401A",
    station: "pot",
  },
  smallchops: {
    name: "Small Chops",
    price: 40,
    color: "#E39A2A",
    station: "pan",
  },
  egusi: { name: "Egusi", price: 55, color: "#C9A12A", station: "pot" },
  poundedyam: {
    name: "Pounded Yam",
    price: 45,
    color: "#BFA97A",
    station: "mortar",
  },
};
const CHAPTERS = [
  {
    name: "Roadside Buka",
    foods: ["jollof", "plantain", "drink"],
    items: [1, 2],
    boss: "First Lunch Rush",
    color: "#FF7A1A",
    intro: "Jollof, dodo and cold zobo. Learn the ropes!",
  },
  {
    name: "Junction Food Spot",
    foods: ["jollof", "friedrice", "plantain", "puffpuff", "drink"],
    items: [2, 2],
    boss: "Busy Junction Rush",
    color: "#12A99F",
    intro: "Two customers at once. Fried rice and puff-puff join the menu.",
  },
  {
    name: "Lagos Food Court",
    foods: ["jollof", "friedrice", "amala", "suya", "plantain", "drink"],
    items: [2, 3],
    boss: "Friday Evening Rush",
    color: "#FF5A5F",
    vip: 0.15,
    intro: "Three lanes, amala and suya, and VIP customers who tip double.",
  },
  {
    name: "Owambe Catering",
    foods: [
      "partyjollof",
      "friedrice",
      "smallchops",
      "plantain",
      "puffpuff",
      "drink",
    ],
    items: [2, 3],
    boss: "Owambe Wedding Rush",
    color: "#7B2E8E",
    vip: 0.15,
    guests: true,
    intro: "Party jollof, small chops and hungry wedding guests in aso-ebi.",
  },
  {
    name: "Mama Put Empire",
    foods: ["egusi", "poundedyam", "partyjollof", "suya", "plantain", "drink"],
    items: [2, 4],
    boss: "Grand Opening Mega Rush",
    color: "#0F4C5C",
    vip: 0.25,
    fast: true,
    intro: "Egusi, pounded yam and the fastest customers in Lagos.",
  },
];
const UPGRADES = [
  {
    id: "fast",
    name: "Sharp Sharp Hands",
    desc: "Food is ready to serve faster",
    icon: "⚡",
    bg: "#FFE3B0",
    costs: [100, 220, 400, 650, 1000],
  },
  {
    id: "patience",
    name: "Sweet Mouth",
    desc: "Customers wait 10% longer per level",
    icon: "😊",
    bg: "#C9F2EE",
    costs: [120, 260, 450, 700, 1100],
  },
  {
    id: "tips",
    name: "Big Tips",
    desc: "+10% coins on every order",
    icon: "💰",
    bg: "#FFF1A8",
    costs: [150, 300, 520, 800, 1200],
  },
  {
    id: "time",
    name: "Generator",
    desc: "+6 seconds on every level clock",
    icon: "🔌",
    bg: "#FFD1D2",
    costs: [100, 220, 400, 650, 1000],
  },
];
const OUTFITS = [
  {
    id: "classic",
    name: "Classic Ankara",
    cost: 0,
    a: "#FF7A1A",
    b: "#12A99F",
  },
  { id: "teal", name: "Lagos Teal", cost: 350, a: "#12A99F", b: "#FFC531" },
  { id: "royal", name: "Royal Purple", cost: 800, a: "#6B2D8C", b: "#FFC531" },
  { id: "gold", name: "Owambe Gold", cost: 1500, a: "#E3A21A", b: "#FF5A5F" },
];
const DECOR = [
  {
    id: "plants",
    name: "Potted Plants",
    desc: "Green plants at the counter",
    icon: "🪴",
    bg: "#D3F5DA",
    cost: 250,
  },
  {
    id: "bunting",
    name: "Party Bunting",
    desc: "Ankara flags over the street",
    icon: "🎏",
    bg: "#FFE3B0",
    cost: 300,
  },
  {
    id: "lights",
    name: "Fairy Lights",
    desc: "Warm lights for evening rush",
    icon: "✨",
    bg: "#FFF1A8",
    cost: 600,
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
  plantain: ["Add plantain for me!", "Dodo plenty o!"],
  drink: ["Abeg add cold zobo!"],
  suya: ["Suya with extra yaji!"],
  amala: ["Amala, gbegiri, ewedu!"],
  guest: [
    "Owambe don start!",
    "Where my party jollof?",
    "I come for the small chops!",
  ],
  vip: ["Chief don land!", "Big man dey here o!"],
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
  return Math.min(4, Math.floor((n - 1) / 10));
}
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
  const duration = Math.round(
    ((goal * cycle) / lanes) * (1.35 - ci * 0.04 - local * 0.01) + 20,
  );
  const gap = boss ? [0.5, 1.3] : [1 - ci * 0.1, 2.6 - ci * 0.25];
  const avgPrice = foods.reduce((s, f) => s + FOODS[f].price, 0) / foods.length;
  const base = goal * avgPrice * avgItems * (1 + (ch.vip || 0));
  const stars = [base * 0.6, base * 1.05, base * 1.35].map(
    (v) => Math.round(v / 10) * 10,
  );
  let challenge = "";
  if (boss) challenge = "Rush hour: customers come back to back";
  else if (ci === 2 && local === 2)
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
    desc: "Every order pays double coins",
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
    name: "NEPA Dey Come",
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
  const maxN = Math.max(1, Math.min(50, unlocked));
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
  c.boss = false;
  c.challenge = mods.map((m) => m.name).join(" + ");
  c.stars = c.stars.map(
    (v) => Math.round((v * (c.goal / levelCfg(n).goal)) / 10) * 10,
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
      "friedrice",
      "plantain",
      "drink",
      "suya",
      "amala",
      "egusi",
      "poundedyam",
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
    tutorial: false,
  };
}

export {
  FOODS,
  CHAPTERS,
  UPGRADES,
  OUTFITS,
  DECOR,
  LINES,
  chapterOf,
  levelCfg,
  DAILY_MODS,
  dailyCfg,
  endlessCfg,
};
