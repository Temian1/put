/* Market Match: a match-3 board of market ingredients.
   Pure logic only: the board, swaps, matches, special pieces, cascades and
   shuffles. The view animates the steps this returns, following each tile
   by its id. */

export const PIECES = [
  { id: "pepper", name: "Pepper", icon: "🌶️", color: "#E53935" },
  { id: "tomato", name: "Tomato", icon: "🍅", color: "#FF7043" },
  { id: "onion", name: "Onion", icon: "🧅", color: "#AB7BD6" },
  { id: "plantain", name: "Plantain", icon: "🍌", color: "#FFC531" },
  { id: "egg", name: "Egg", icon: "🥚", color: "#F3E9D2" },
  { id: "fish", name: "Fish", icon: "🐟", color: "#4FC3F7" },
];

// Frozen food: a tile in a block of ice (1 or 2 layers). It swaps, falls
// and matches like any other tile, but each match or blast that catches
// it cracks one layer instead of clearing it.

// Special pieces, made by bigger matches:
// row / col: a line of 4 makes lightning that clears its row or column.
// pot: an L or T shape makes a pot bomb that blows up the 3x3 around it.
// ladle: a line of 5 makes a ladle that strikes every piece of one kind.
export const SPECIALS = {
  row: { name: "Pepper lightning", how: "Match 4 in a row" },
  col: { name: "Pepper lightning", how: "Match 4 in a column" },
  pot: { name: "Pot bomb", how: "Match in an L or T shape" },
  ladle: { name: "Mama's ladle", how: "Match 5 in a line" },
};

// Small seeded random generator so boards and tests repeat exactly.
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (x, y) => x + "," + y;
const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
const at = (s, x, y) => (inside(s, x, y) ? s.grid[y][x] : null);

function newCell(s, k, sp = null) {
  return { id: s.nextId++, k, sp };
}
const randomKind = (s) => Math.floor(s.rng() * s.kinds);

// A fresh board with no ready-made matches and at least one move.
// `grease` is a list of [x, y] cells with a grease stain to clean.
// `ice` is a list of [x, y, layers] tiles that start frozen.
export function createBoard({
  w = 7,
  h = 8,
  kinds = 5,
  rng = Math.random,
  grease = [],
  ice = [],
} = {}) {
  const s = { w, h, kinds, rng, nextId: 1, grid: [], grease: [] };
  for (let y = 0; y < h; y++) {
    s.grid.push([]);
    s.grease.push(new Array(w).fill(0));
  }
  grease.forEach(([x, y]) => inside(s, x, y) && (s.grease[y][x] = 1));
  fill(s);
  ice.forEach(([x, y, n]) => {
    const c = at(s, x, y);
    if (c) c.ice = n || 1;
  });
  return s;
}
const frozen = (c) => c?.ice > 0;

function fill(s) {
  for (let tries = 0; tries < 50; tries++) {
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        let k;
        do k = randomKind(s);
        while (
          (x >= 2 && s.grid[y][x - 1]?.k === k && s.grid[y][x - 2]?.k === k) ||
          (y >= 2 && s.grid[y - 1][x]?.k === k && s.grid[y - 2][x]?.k === k)
        );
        s.grid[y][x] = newCell(s, k);
      }
    if (findMove(s)) return;
  }
}

/* ---- matching ---- */

// Runs of 3+ of the same ingredient, merged into groups where a row run and
// a column run share a tile (an L or T shape).
export function findGroups(s) {
  const runs = [];
  for (let y = 0; y < s.h; y++) {
    let x = 0;
    while (x < s.w) {
      const c = at(s, x, y);
      let e = x + 1;
      while (c && at(s, e, y)?.k === c.k) e++;
      if (c && e - x >= 3)
        runs.push({ dir: "h", k: c.k, cells: range(x, e).map((i) => [i, y]) });
      x = e;
    }
  }
  for (let x = 0; x < s.w; x++) {
    let y = 0;
    while (y < s.h) {
      const c = at(s, x, y);
      let e = y + 1;
      while (c && at(s, x, e)?.k === c.k) e++;
      if (c && e - y >= 3)
        runs.push({ dir: "v", k: c.k, cells: range(y, e).map((i) => [x, i]) });
      y = e;
    }
  }
  // Merge runs that touch the same tile.
  const groups = [];
  runs.forEach((r) => {
    const keys = new Set(r.cells.map(([x, y]) => key(x, y)));
    const hit = groups.find(
      (g) => g.k === r.k && r.cells.some(([x, y]) => g.keys.has(key(x, y))),
    );
    if (hit) {
      hit.runs.push(r);
      r.cells.forEach(([x, y]) => {
        if (!hit.keys.has(key(x, y))) hit.cells.push([x, y]);
        hit.keys.add(key(x, y));
      });
    } else groups.push({ k: r.k, runs: [r], cells: [...r.cells], keys });
  });
  groups.forEach((g) => {
    const longest = Math.max(...g.runs.map((r) => r.cells.length));
    const dirs = new Set(g.runs.map((r) => r.dir));
    g.special =
      longest >= 5
        ? "ladle"
        : dirs.size > 1
          ? "pot"
          : longest === 4
            ? g.runs[0].dir === "h"
              ? "row"
              : "col"
            : null;
  });
  return groups;
}

function range(a, b) {
  const out = [];
  for (let i = a; i < b; i++) out.push(i);
  return out;
}

// Would swapping these two tiles make a match?
function swapMakesMatch(s, a, b) {
  swapCells(s, a, b);
  const ok = findGroups(s).length > 0;
  swapCells(s, a, b);
  return ok;
}
function swapCells(s, [ax, ay], [bx, by]) {
  const t = s.grid[ay][ax];
  s.grid[ay][ax] = s.grid[by][bx];
  s.grid[by][bx] = t;
}
export const adjacent = ([ax, ay], [bx, by]) =>
  Math.abs(ax - bx) + Math.abs(ay - by) === 1;

// A swap that works, or null. Two specials side by side always work.
export function findMove(s) {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++)
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        const a = [x, y],
          b = [x + dx, y + dy];
        if (!inside(s, b[0], b[1])) continue;
        const ca = at(s, x, y),
          cb = at(s, b[0], b[1]);
        if (!ca || !cb) continue;
        if (ca.sp === "ladle" || cb.sp === "ladle" || (ca.sp && cb.sp))
          return [a, b];
        if (swapMakesMatch(s, a, b)) return [a, b];
      }
  return null;
}

/* ---- clearing, gravity and cascades ---- */

// Tiles each special sweeps away when it goes off.
function blastArea(s, x, y, sp, kind) {
  const out = [];
  if (sp === "row") for (let i = 0; i < s.w; i++) out.push([i, y]);
  else if (sp === "col") for (let j = 0; j < s.h; j++) out.push([x, j]);
  else if (sp === "pot") {
    for (let j = y - 1; j <= y + 1; j++)
      for (let i = x - 1; i <= x + 1; i++)
        if (inside(s, i, j)) out.push([i, j]);
  } else if (sp === "ladle") {
    for (let j = 0; j < s.h; j++)
      for (let i = 0; i < s.w; i++)
        if (at(s, i, j)?.k === kind) out.push([i, j]);
  }
  return out;
}

// Most common ingredient on the board: what a ladle takes when it is
// caught in someone else's blast.
function commonKind(s) {
  const n = new Array(s.kinds).fill(0);
  s.grid.forEach((row) => row.forEach((c) => c && !c.sp && n[c.k]++));
  return n.indexOf(Math.max(...n));
}

// Clears tiles, setting off any specials caught in the blast.
function clearCells(s, cells, step, keep = new Set()) {
  const queue = [...cells],
    seen = new Set();
  while (queue.length) {
    const [x, y] = queue.shift();
    const k = key(x, y);
    if (seen.has(k) || keep.has(k)) continue;
    seen.add(k);
    const c = at(s, x, y);
    if (!c) continue;
    if (frozen(c)) {
      c.ice--;
      step.thawed.push({ id: c.id, x, y, ice: c.ice });
      continue;
    }
    step.cleared.push({ id: c.id, x, y, k: c.k, sp: c.sp });
    if (s.grease[y][x]) {
      s.grease[y][x] = 0;
      step.grease.push([x, y]);
    }
    s.grid[y][x] = null;
    if (c.sp) {
      // Each blast lists the tiles it hits, so the view can aim at them.
      const area = blastArea(
        s,
        x,
        y,
        c.sp,
        c.sp === "ladle" ? commonKind(s) : c.k,
      );
      step.blasts.push({ x, y, sp: c.sp, cells: area });
      queue.push(...area);
    }
  }
}

function gravity(s, step) {
  for (let x = 0; x < s.w; x++) {
    let write = s.h - 1;
    for (let y = s.h - 1; y >= 0; y--) {
      const c = s.grid[y][x];
      if (!c) continue;
      if (write !== y) {
        s.grid[write][x] = c;
        s.grid[y][x] = null;
        step.moved.push({ id: c.id, x, y: write, from: y });
      }
      write--;
    }
    // New tiles drop in from above the board.
    for (let y = write, n = 1; y >= 0; y--, n++) {
      const c = newCell(s, randomKind(s));
      s.grid[y][x] = c;
      step.spawned.push({ id: c.id, x, y, k: c.k, from: -n });
    }
  }
}

const emptyStep = () => ({
  cleared: [],
  made: [],
  blasts: [],
  grease: [],
  thawed: [],
  moved: [],
  spawned: [],
  points: 0,
});

// Clears every match on the board, drops tiles, and repeats until the board
// settles. `swapped` marks where a new special should appear.
function cascade(s, steps, swapped = []) {
  for (let chain = 0; chain < 40; chain++) {
    const groups = findGroups(s);
    if (!groups.length) break;
    const step = emptyStep();
    const keep = new Set(),
      toClear = [];
    groups.forEach((g) => {
      toClear.push(...g.cells);
      if (!g.special) return;
      // The special appears where the player moved, or mid-group, never
      // on frozen food.
      const free = g.cells.filter(([x, y]) => !frozen(at(s, x, y)));
      const spot =
        free.find(([x, y]) =>
          swapped.some(([sx, sy]) => sx === x && sy === y),
        ) || free[Math.floor(free.length / 2)];
      if (!spot) return;
      const c = at(s, spot[0], spot[1]);
      if (c.sp) return; // an existing special goes off instead
      keep.add(key(spot[0], spot[1]));
      step.made.push({
        id: c.id,
        x: spot[0],
        y: spot[1],
        k: c.k,
        sp: g.special,
      });
    });
    clearCells(s, toClear, step, keep);
    step.made.forEach((m) => {
      const c = at(s, m.x, m.y);
      if (c && c.id === m.id) c.sp = m.sp;
      // Clean grease under the tile that became special.
      if (s.grease[m.y][m.x]) {
        s.grease[m.y][m.x] = 0;
        step.grease.push([m.x, m.y]);
      }
    });
    step.points =
      (step.cleared.length + step.thawed.length) * 20 * (chain + 1) +
      step.made.length * 60;
    step.chain = chain + 1;
    gravity(s, step);
    steps.push(step);
    swapped = [];
  }
  if (!findMove(s)) steps.push({ ...emptyStep(), shuffle: shuffle(s) });
  return steps;
}

// Two specials swapped together make a bigger blast.
function comboArea(s, a, b, ca, cb) {
  const [x, y] = b;
  const sps = [ca.sp, cb.sp].sort().join("+");
  if (sps === "ladle+ladle") return allCells(s);
  if (ca.sp === "ladle" || cb.sp === "ladle") {
    const other = ca.sp === "ladle" ? cb : ca;
    const kind = other.k;
    if (!other.sp) return blastArea(s, x, y, "ladle", kind);
    // Every piece of that ingredient becomes the other special, then goes off.
    const cells = blastArea(s, x, y, "ladle", kind);
    cells.forEach(([i, j]) => {
      const c = at(s, i, j);
      if (c && !c.sp && !frozen(c))
        c.sp = other.sp === "pot" ? "pot" : (i + j) % 2 ? "row" : "col";
    });
    return cells;
  }
  if (ca.sp === "pot" && cb.sp === "pot") {
    const out = [];
    for (let j = y - 2; j <= y + 2; j++)
      for (let i = x - 2; i <= x + 2; i++)
        if (inside(s, i, j)) out.push([i, j]);
    return out;
  }
  if (ca.sp === "pot" || cb.sp === "pot") {
    const out = [];
    for (let d = -1; d <= 1; d++) {
      out.push(...blastArea(s, x, y + d, "row"));
      out.push(...blastArea(s, x + d, y, "col"));
    }
    return out.filter(([i, j]) => inside(s, i, j));
  }
  // Two blasts: a cross through the tile.
  return [...blastArea(s, x, y, "row"), ...blastArea(s, x, y, "col")];
}
function allCells(s) {
  const out = [];
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) out.push([i, j]);
  return out;
}

// The player's move. Returns { ok, steps }: a step for each cascade, so
// the view can animate them in order. A swap that matches nothing is not
// a move.
export function trySwap(s, a, b) {
  if (!inside(s, a[0], a[1]) || !inside(s, b[0], b[1]) || !adjacent(a, b))
    return { ok: false, steps: [] };
  const ca = at(s, a[0], a[1]),
    cb = at(s, b[0], b[1]);
  if (!ca || !cb) return { ok: false, steps: [] };
  const steps = [];
  if (ca.sp === "ladle" || cb.sp === "ladle" || (ca.sp && cb.sp)) {
    swapCells(s, a, b);
    const step = emptyStep();
    step.swap = [a, b];
    step.combo = [ca.sp, cb.sp].filter(Boolean).sort().join("+");
    const area = comboArea(s, a, b, ca, cb);
    step.blasts.push({
      x: b[0],
      y: b[1],
      sp: "combo",
      combo: step.combo,
      cells: area,
    });
    // The pair itself goes in the blast without setting itself off twice.
    const pair = [b, a];
    [ca, cb].forEach((c) => (c.sp = null));
    clearCells(s, [...pair, ...area], step);
    step.points = (step.cleared.length + step.thawed.length) * 30;
    step.chain = 1;
    gravity(s, step);
    steps.push(step);
    cascade(s, steps);
    return { ok: true, steps };
  }
  swapCells(s, a, b);
  if (!findGroups(s).length) {
    swapCells(s, a, b);
    return { ok: false, steps: [] };
  }
  cascade(s, steps, [a, b]);
  if (steps[0]) steps[0].swap = [a, b];
  return { ok: true, steps };
}

/* ---- tools (power-ups bought with naira) ---- */

// Wooden spoon: smash one tile. Specials go off.
export function smash(s, x, y) {
  const step = emptyStep();
  if (!at(s, x, y)) return { ok: false, steps: [] };
  clearCells(s, [[x, y]], step);
  step.points = (step.cleared.length + step.thawed.length) * 20;
  step.chain = 1;
  gravity(s, step);
  const steps = [step];
  cascade(s, steps);
  return { ok: true, steps };
}

// Stir the pot: mix every tile into new places, keeping specials, until
// the board has no ready-made matches and at least one move.
export function shuffle(s) {
  const cells = [];
  s.grid.forEach((row) => row.forEach((c) => c && cells.push(c)));
  for (let tries = 0; tries < 200; tries++) {
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(s.rng() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    let n = 0;
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) s.grid[y][x] = cells[n++];
    if (!findGroups(s).length && findMove(s)) break;
    // A board that will not settle gets a few fresh ingredients.
    if (tries > 100)
      cells.forEach((c) => !c.sp && s.rng() < 0.3 && (c.k = randomKind(s)));
  }
  const moved = [];
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) moved.push({ id: s.grid[y][x].id, x, y });
  return moved;
}

// Hot start booster: two random tiles become blasts before the first move.
export function addSpecials(s, n, sp = null) {
  const made = [];
  for (let tries = 0; made.length < n && tries < 100; tries++) {
    const x = Math.floor(s.rng() * s.w),
      y = Math.floor(s.rng() * s.h),
      c = at(s, x, y);
    if (!c || c.sp || frozen(c)) continue;
    c.sp = sp || (s.rng() < 0.5 ? "row" : "col");
    made.push({ id: c.id, x, y, k: c.k, sp: c.sp });
  }
  return made;
}

export const iceLeft = (s) =>
  s.grid.reduce((n, row) => n + row.reduce((a, c) => a + (c?.ice || 0), 0), 0);

export const greaseLeft = (s) =>
  s.grease.reduce((n, row) => n + row.reduce((a, b) => a + b, 0), 0);

/* ---- levels ---- */

// Puzzle levels get harder slowly: more ingredients and bigger
// collection goals, with a third ingredient to collect from level 4.
// From level 6 every other level has frozen food to break, with
// thicker ice on some tiles from level 15.
export function levelSpec(n) {
  const kinds = n < 3 ? 4 : n < 9 ? 5 : 6;
  const moves = 20 + (n % 4) * 2 + (n >= 10 ? 2 : 0);
  const want = Math.min(40, 10 + Math.round(n * 1.6));
  const a = (n * 2) % kinds,
    b = (n * 2 + 3) % kinds,
    c = (n * 2 + 1) % kinds;
  const goals = [{ type: "collect", k: a, n: want }];
  if (n >= 2) goals.push({ type: "collect", k: b, n: Math.round(want * 0.7) });
  const ice = [];
  if (n >= 6 && n % 2 === 0) {
    const rng = seeded(n * 97);
    const count = Math.min(16, 4 + Math.floor(n / 2));
    const set = new Set();
    while (set.size < count)
      set.add(Math.floor(rng() * 7) + "," + (3 + Math.floor(rng() * 5)));
    [...set].forEach((p) => {
      const [x, y] = p.split(",").map(Number);
      ice.push([x, y, n >= 15 && rng() < 0.35 ? 2 : 1]);
    });
    goals.length = Math.min(goals.length, 2);
    goals.push({ type: "ice", n: ice.reduce((a, t) => a + t[2], 0) });
  } else if (n >= 4 && n % 3 !== 1)
    goals.push({ type: "collect", k: c, n: Math.round(want * 0.5) });
  return { n, kinds, moves, goals, grease: [], ice, w: 7, h: 8 };
}

// Progress on each goal after the steps of a move.
export function applyGoals(goals, progress, steps) {
  steps.forEach((st) => {
    st.cleared.forEach((c) => {
      goals.forEach((g, i) => {
        if (g.type === "collect" && g.k === c.k) progress[i]++;
      });
    });
    goals.forEach((g, i) => {
      if (g.type === "grease") progress[i] += st.grease.length;
      if (g.type === "ice") progress[i] += st.thawed.length;
    });
  });
  return progress;
}
export const goalsMet = (goals, progress) =>
  goals.every((g, i) => progress[i] >= g.n);

// One star for clearing, more for moves left over.
export const starsFor = (movesLeft, total) =>
  1 + (movesLeft >= total * 0.2 ? 1 : 0) + (movesLeft >= total * 0.4 ? 1 : 0);
