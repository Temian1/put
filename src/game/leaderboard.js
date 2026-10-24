import { seeded, hashStr } from "./utils.js";

// Local leaderboard: you against rival bukas across Nigeria. Rival numbers
// drift a little each day so the table feels alive. A global online board
// would need a server; these rivals are part of the game.
const RIVALS = [
  {
    name: "Mama Titi's Buka",
    where: "Yaba",
    sales: 8e6,
    stars: 148,
    endless: 420000,
  },
  {
    name: "Iya Oyo Amala Spot",
    where: "Mushin",
    sales: 5.2e6,
    stars: 139,
    endless: 310000,
  },
  {
    name: "Chop Life Kitchen",
    where: "Ikeja",
    sales: 3.3e6,
    stars: 122,
    endless: 240000,
  },
  {
    name: "Mama Nkechi Pot",
    where: "Festac",
    sales: 2.1e6,
    stars: 104,
    endless: 180000,
  },
  {
    name: "Baba Sule Rice House",
    where: "Wuse, Abuja",
    sales: 1.25e6,
    stars: 86,
    endless: 130000,
  },
  {
    name: "Aunty Ronke Food Corner",
    where: "Surulere",
    sales: 760000,
    stars: 66,
    endless: 90000,
  },
  {
    name: "Mama Ebere Canteen",
    where: "Ajah",
    sales: 450000,
    stars: 48,
    endless: 60000,
  },
  {
    name: "Iya Femi Buka",
    where: "Oshodi",
    sales: 240000,
    stars: 31,
    endless: 38000,
  },
  {
    name: "Mallam Garba Chop House",
    where: "Kano",
    sales: 120000,
    stars: 18,
    endless: 21000,
  },
  {
    name: "Sisi Ada Kitchen",
    where: "Enugu",
    sales: 55000,
    stars: 9,
    endless: 11000,
  },
  {
    name: "Mama Bisi Roadside",
    where: "Ibadan",
    sales: 20000,
    stars: 4,
    endless: 5000,
  },
];

export const BOARDS = [
  { id: "sales", label: "Top Bukas", unit: "naira" },
  { id: "stars", label: "Stars", unit: "stars" },
  { id: "endless", label: "Endless", unit: "naira" },
];

const playerValue = (d, id) =>
  id === "sales"
    ? d.stats?.earn || 0
    : id === "stars"
      ? Object.values(d.stars || {}).reduce((a, b) => a + b, 0)
      : d.endlessBest || 0;

// Returns ranked rows for one board, with the player's row marked `you`.
export function ranking(d, id, key, playerName = "Your Mama Put") {
  const rng = seeded(hashStr("board" + id + key));
  const rows = RIVALS.map((r) => {
    const drift = id === "stars" ? 0 : 1 + (rng() - 0.5) * 0.06;
    return {
      name: r.name,
      where: r.where,
      value: id === "stars" ? r[id] : Math.round((r[id] * drift) / 1000) * 1000,
    };
  });
  rows.push({
    name: playerName,
    where: "You",
    value: playerValue(d, id),
    you: true,
  });
  rows.sort((a, b) => b.value - a.value || (a.you ? -1 : 1));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export const playerRank = (d, id, key) =>
  ranking(d, id, key).find((r) => r.you).rank;
