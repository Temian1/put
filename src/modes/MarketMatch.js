/* Market Match: the match-3 screen. Tiles are plain DOM elements followed
   by id; every move plays back the steps from game/match3.js as
   animations: swap, pop, blast, drop and refill. */
import {
  PIECES,
  SPECIALS,
  createBoard,
  trySwap,
  smash,
  shuffle,
  findMove,
  addSpecials,
  levelSpec,
  applyGoals,
  goalsMet,
  starsFor,
  adjacent,
} from "../game/match3.js";
import {
  TOOLS,
  RECIPES,
  sideSave,
  claimMatch,
  buyItem,
  matchReward,
  canPay,
} from "../game/sidegames.js";
import { INGREDIENTS } from "../game/market.js";

const CHEERS = [
  "Correct!",
  "E sweet!",
  "Chop life!",
  "Na wa!",
  "Oya!",
  "Mama approves!",
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SVGNS = "http://www.w3.org/2000/svg";
const FIRE = ["#FFF3B0", "#FFD23F", "#FF9800", "#FF5722", "#E53935"];

export function createMarketMatch(ctx) {
  const { $, on, listen, UI, Save, Sound, Haptics, fmt, today } = ctx;
  let board = null,
    spec = null,
    progress = [],
    moves = 0,
    score = 0,
    busy = false,
    over = false,
    active = false,
    pick = 1,
    hot = false,
    mode = "",
    selected = null,
    hintT = null,
    size = 40,
    startedAt = 0;
  const tiles = new Map();
  const boardEl = () => $("#m3Board");

  /* ---- drawing ---- */
  function measure() {
    const el = boardEl();
    const wrap = el.parentElement.getBoundingClientRect();
    size = Math.floor(
      Math.min(wrap.width / spec.w, (wrap.height || 9999) / spec.h, 64),
    );
    el.style.setProperty("--t", size + "px");
    el.style.width = size * spec.w + "px";
    el.style.height = size * spec.h + "px";
  }
  const place = (el, x, y) =>
    (el.style.transform = `translate(${x * size}px, ${y * size}px)`);

  function tileEl(c, x, y) {
    const el = document.createElement("div");
    el.className = "m3t";
    el.dataset.id = c.id;
    paint(el, c);
    place(el, x, y);
    boardEl().appendChild(el);
    tiles.set(c.id, el);
    return el;
  }
  function paint(el, c) {
    const p = PIECES[c.k];
    el.style.setProperty("--c", p.color);
    el.className = "m3t" + (c.sp ? " sp " + c.sp : "");
    el.innerHTML = `<span>${p.icon}</span><b class="m3Ice"></b>`;
    frost(el, c.ice);
    if (c.sp) el.title = SPECIALS[c.sp].name;
  }

  // Frozen food wears a block of ice over the tile; thick ice is frostier.
  function frost(el, ice = 0) {
    el.classList.toggle("ice", ice > 0);
    el.classList.toggle("ice2", ice > 1);
  }

  function drawBoard() {
    const el = boardEl();
    el.innerHTML = "";
    tiles.clear();
    measure();
    for (let y = 0; y < spec.h; y++)
      for (let x = 0; x < spec.w; x++) {
        const g = document.createElement("i");
        g.className = "m3cell" + (board.grease[y][x] ? " grease" : "");
        g.dataset.cell = x + "," + y;
        g.style.transform = `translate(${x * size}px, ${y * size}px)`;
        el.appendChild(g);
      }
    board.grid.forEach((row, y) =>
      row.forEach((c, x) => {
        const t = tileEl(c, x, y);
        // Tiles tumble in at the start, column by column.
        t.animate(
          [
            { transform: `translate(${x * size}px, ${(y - spec.h) * size}px)` },
            { transform: `translate(${x * size}px, ${y * size}px)` },
          ],
          {
            duration: 420,
            delay: x * 35 + (spec.h - y) * 20,
            easing: "cubic-bezier(.3,1.4,.6,1)",
            fill: "backwards",
          },
        );
      }),
    );
  }

  const goalIcon = (g) => (g.type === "ice" ? "🧊" : PIECES[g.k].icon);
  function drawGoals() {
    $("#m3Goals").innerHTML = spec.goals
      .map((g, i) => {
        const left = Math.max(0, g.n - progress[i]);
        const icon = goalIcon(g);
        return `<div class="m3Goal${left ? "" : " done"}" data-goal="${i}">
          <span>${icon}</span><b>${left ? left : "✓"}</b></div>`;
      })
      .join("");
    $("#m3Moves").textContent = moves;
    $("#m3Moves").parentElement.classList.toggle("low", moves <= 5);
    $("#m3Score").textContent = score.toLocaleString();
    const tools = sideSave(Save.d).match.tools;
    [
      ["#m3Spoon", "spoon"],
      ["#m3Stir", "stir"],
      ["#m3MoreMoves", "moves"],
    ].forEach(([sel, id]) => {
      const b = $(sel);
      b.querySelector("b").textContent = tools[id] || "+";
      b.classList.toggle("armed", mode === id);
    });
  }

  function cheer(text, big) {
    const el = $("#m3Cheer");
    el.textContent = text;
    el.className = "m3Cheer show" + (big ? " big" : "");
    clearTimeout(cheer.t);
    cheer.t = setTimeout(() => (el.className = "m3Cheer"), 900);
  }

  function floatAt(x, y, text) {
    const f = document.createElement("div");
    f.className = "m3Float";
    f.textContent = text;
    f.style.left = (x + 0.5) * size + "px";
    f.style.top = (y + 0.5) * size + "px";
    boardEl().appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  function burst(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const s = document.createElement("i");
      s.className = "m3Spark";
      s.style.background = color;
      s.style.left = (x + 0.5) * size + "px";
      s.style.top = (y + 0.5) * size + "px";
      const a = (i / 6) * Math.PI * 2 + Math.random();
      const d = size * (0.6 + Math.random() * 0.5);
      s.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`,
            opacity: 0,
          },
        ],
        { duration: 420, easing: "cubic-bezier(.2,.7,.4,1)" },
      );
      boardEl().appendChild(s);
      setTimeout(() => s.remove(), 440);
    }
  }

  /* ---- lightning and explosions ---- */
  // One SVG layer over the board for the bolts of a step.
  function fxLayer() {
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "m3Fx");
    svg.setAttribute("width", spec.w * size);
    svg.setAttribute("height", spec.h * size);
    boardEl().appendChild(svg);
    setTimeout(() => svg.remove(), 1400);
    return svg;
  }
  // A jagged lightning bolt between two tiles (board units, tile centres),
  // drawn as a wide glow under a white-hot core, flickering out.
  function bolt(svg, x1, y1, x2, y2, delay = 0, color = "#FFE45C") {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const n = Math.max(3, Math.round(len * 2.2));
    const nx = -(y2 - y1) / len,
      ny = (x2 - x1) / len;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 0.6;
      pts.push(
        ((x1 + (x2 - x1) * t + nx * j + 0.5) * size).toFixed(1) +
          "," +
          ((y1 + (y2 - y1) * t + ny * j + 0.5) * size).toFixed(1),
      );
    }
    const d = "M" + pts.join("L");
    [
      [color, size * 0.34, 0.45],
      [color, size * 0.14, 0.9],
      ["#FFFFFF", size * 0.06, 1],
    ].forEach(([c, w, o]) => {
      const path = document.createElementNS(SVGNS, "path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", c);
      path.setAttribute("stroke-width", w);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.style.opacity = 0;
      svg.appendChild(path);
      path.animate(
        [
          { opacity: 0 },
          { opacity: o, offset: 0.08 },
          { opacity: o * 0.25, offset: 0.3 },
          { opacity: o, offset: 0.45 },
          { opacity: 0 },
        ],
        { duration: 420, delay, fill: "both" },
      );
    });
  }
  function flash(strength = 0.6, color = "#FFFFFF") {
    const f = document.createElement("div");
    f.className = "m3Flash";
    f.style.background = color;
    boardEl().appendChild(f);
    f.animate([{ opacity: strength }, { opacity: 0 }], {
      duration: 260,
      easing: "ease-out",
    });
    setTimeout(() => f.remove(), 280);
  }
  function shakeBoard(big) {
    const el = boardEl();
    el.classList.remove("shake", "boom");
    void el.offsetWidth;
    el.classList.add(big ? "boom" : "shake");
  }
  // The pot bomb: a fireball, a shockwave ring, flying embers and smoke.
  function explode(x, y, r = 1.5) {
    const el = boardEl();
    const cx = (x + 0.5) * size,
      cy = (y + 0.5) * size;
    const at = (n, cls) => {
      n.className = cls;
      n.style.left = cx + "px";
      n.style.top = cy + "px";
      el.appendChild(n);
      return n;
    };
    const ball = at(document.createElement("div"), "m3Boom");
    ball.style.width = ball.style.height = r * 2 * size + "px";
    ball.animate(
      [
        { transform: "translate(-50%,-50%) scale(.1)", opacity: 1 },
        {
          transform: "translate(-50%,-50%) scale(1)",
          opacity: 1,
          offset: 0.3,
        },
        { transform: "translate(-50%,-50%) scale(1.3)", opacity: 0 },
      ],
      { duration: 560, easing: "ease-out", fill: "forwards" },
    );
    const ring = at(document.createElement("div"), "m3Shock");
    ring.style.width = ring.style.height = r * 2 * size + "px";
    ring.animate(
      [
        { transform: "translate(-50%,-50%) scale(.2)", opacity: 1 },
        { transform: "translate(-50%,-50%) scale(2)", opacity: 0 },
      ],
      { duration: 600, easing: "cubic-bezier(.1,.7,.3,1)", fill: "forwards" },
    );
    for (let i = 0; i < 16; i++) {
      const e = at(document.createElement("i"), "m3Ember");
      e.style.background = FIRE[i % FIRE.length];
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const d = size * r * (1 + Math.random() * 0.9);
      e.animate(
        [
          { transform: "translate(-50%,-50%) scale(1.2)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + size * 0.4}px)) scale(.2)`,
            opacity: 0,
          },
        ],
        {
          duration: 520 + Math.random() * 260,
          easing: "cubic-bezier(.15,.8,.4,1)",
          fill: "forwards",
        },
      );
    }
    for (let i = 0; i < 5; i++) {
      const sm = at(document.createElement("i"), "m3Smoke");
      const dx = (Math.random() - 0.5) * size * r;
      sm.animate(
        [
          { transform: "translate(-50%,-50%) scale(.4)", opacity: 0.7 },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${size * (1 + Math.random())}px)) scale(1.8)`,
            opacity: 0,
          },
        ],
        {
          duration: 900,
          delay: 120 + i * 40,
          easing: "ease-out",
          fill: "both",
        },
      );
    }
    flash(0.55, "#FFE9B0");
    setTimeout(
      () =>
        el
          .querySelectorAll(".m3Boom,.m3Shock,.m3Ember,.m3Smoke")
          .forEach((n) => n.remove()),
      1150,
    );
  }
  // Lightning from a tile to each of its targets, one after another.
  function strikeAll(svg, b, color, max = 30) {
    (b.cells || [])
      .filter(([i, j]) => i !== b.x || j !== b.y)
      .slice(0, max)
      .forEach(([i, j], n) => {
        bolt(svg, b.x, b.y, i, j, n * 22, color);
        setTimeout(() => burst(i, j, color), n * 22 + 60);
      });
  }
  // How loud a step is: the sound and shake of its biggest blast.
  function blastFx(st) {
    if (!st.blasts.length && !st.made.length) return;
    const svg = fxLayer();
    let boom = false,
      thunder = false;
    st.blasts.forEach((b) => {
      const sp = b.sp === "combo" ? b.combo : b.sp;
      if (
        sp === "row" ||
        sp === "col" ||
        sp === "col+row" ||
        sp === "col+col" ||
        sp === "row+row"
      ) {
        if (sp !== "col") {
          bolt(svg, -0.5, b.y, spec.w - 0.5, b.y);
          bolt(svg, -0.5, b.y, spec.w - 0.5, b.y, 90, "#FFFFFF");
        }
        if (sp !== "row") {
          bolt(svg, b.x, -0.5, b.x, spec.h - 0.5);
          bolt(svg, b.x, -0.5, b.x, spec.h - 0.5, 90, "#FFFFFF");
        }
        if (b.sp === "combo") thunder = true;
      } else if (sp.includes("ladle")) {
        thunder = true;
        if (sp === "ladle+ladle") {
          flash(0.8);
          for (let i = 0; i < 6; i++)
            bolt(
              svg,
              Math.random() * spec.w - 0.5,
              -0.5,
              Math.random() * spec.w - 0.5,
              spec.h - 0.5,
              i * 60,
            );
        }
        strikeAll(svg, b, "#B388FF");
        if (sp.includes("pot")) boom = true;
      } else if (sp.includes("pot")) {
        boom = true;
        if (sp === "pot+pot") explode(b.x, b.y, 2.6);
        else if (sp === "pot") explode(b.x, b.y, 1.5);
        else {
          // Pot with lightning: three rows and three columns at once.
          explode(b.x, b.y, 1.5);
          for (let d = -1; d <= 1; d++) {
            bolt(svg, -0.5, b.y + d, spec.w - 0.5, b.y + d, 40 * (d + 1));
            bolt(svg, b.x + d, -0.5, b.x + d, spec.h - 0.5, 40 * (d + 1));
          }
        }
      }
    });
    // A big match calls down thunder onto the new special piece.
    st.made.forEach((m, n) => {
      thunder = true;
      bolt(
        svg,
        m.x + (Math.random() - 0.5) * 2,
        -0.6,
        m.x,
        m.y,
        n * 80,
        "#FFF59D",
      );
    });
    if (st.made.length) flash(0.45);
    if (boom) Sound.play("boom");
    if (thunder) Sound.play("thunder");
    if (!boom && !thunder && st.blasts.length) Sound.play("zap");
    if (st.blasts.length) {
      Haptics.play(boom ? "wrong" : "serve");
      shakeBoard(boom || thunder);
    }
  }

  /* ---- playing back a move ---- */
  async function play(steps) {
    for (const st of steps) {
      if (st.shuffle) {
        cheer("No moves. Stirring the pot!");
        st.shuffle.forEach(({ id, x, y }) => {
          const el = tiles.get(id);
          if (el) place(el, x, y);
        });
        await wait(420);
        continue;
      }
      blastFx(st);
      if (!st.blasts.length) Sound.play(st.chain > 1 ? "coin" : "serve");
      // Long cascades light up the whole board.
      if (st.chain >= 3 && !st.blasts.length) flash(0.25, "#FFF59D");
      st.cleared.forEach((c) => {
        const el = tiles.get(c.id);
        if (!el) return;
        el.classList.add("pop");
        burst(c.x, c.y, PIECES[c.k].color);
      });
      st.grease.forEach(([x, y]) => {
        const g = boardEl().querySelector(`[data-cell="${x},${y}"]`);
        if (g) g.classList.remove("grease");
      });
      st.thawed.forEach((t) => {
        const el = tiles.get(t.id);
        if (!el) return;
        frost(el, t.ice);
        el.classList.remove("crack");
        void el.offsetWidth;
        el.classList.add("crack");
        burst(t.x, t.y, "#CDEFFF");
      });
      if (st.thawed.length) Sound.play("zap");
      st.made.forEach((m) => {
        const el = tiles.get(m.id);
        if (!el) return;
        paint(el, m);
        el.classList.add("born");
        cheer(SPECIALS[m.sp].name + "!", true);
      });
      if (st.cleared[0])
        floatAt(st.cleared[0].x, st.cleared[0].y, "+" + st.points);
      if (st.chain >= 2)
        cheer(CHEERS[Math.min(st.chain - 2, CHEERS.length - 1)]);
      score += st.points;
      progress = applyGoals(spec.goals, progress, [st]);
      drawGoals();
      await wait(230);
      st.cleared.forEach((c) => {
        tiles.get(c.id)?.remove();
        tiles.delete(c.id);
      });
      st.moved.forEach((m) => {
        const el = tiles.get(m.id);
        if (!el) return;
        el.style.transitionDuration = 120 + (m.y - m.from) * 45 + "ms";
        place(el, m.x, m.y);
      });
      st.spawned.forEach((n) => {
        const el = tileEl({ id: n.id, k: n.k, sp: null }, n.x, n.from);
        el.style.transitionDuration = 160 + (n.y - n.from) * 45 + "ms";
        void el.offsetWidth;
        place(el, n.x, n.y);
      });
      await wait(260 + 30 * spec.h);
      tiles.forEach((el) => (el.style.transitionDuration = ""));
    }
  }

  async function doSwap(a, b) {
    if (busy || over) return;
    clearHint();
    busy = true;
    const ca = board.grid[a[1]][a[0]],
      cb = board.grid[b[1]][b[0]];
    const ea = tiles.get(ca.id),
      eb = tiles.get(cb.id);
    place(ea, b[0], b[1]);
    place(eb, a[0], a[1]);
    Sound.play("tap");
    await wait(170);
    const res = trySwap(board, a, b);
    if (!res.ok) {
      place(ea, a[0], a[1]);
      place(eb, b[0], b[1]);
      ea.classList.add("nope");
      eb.classList.add("nope");
      Sound.play("wrong");
      await wait(260);
      ea.classList.remove("nope");
      eb.classList.remove("nope");
      busy = false;
      return;
    }
    if (res.steps[0]?.combo)
      cheer("Combo! " + res.steps[0].combo.replace("+", " + "), true);
    moves--;
    drawGoals();
    await play(res.steps);
    busy = false;
    afterMove();
  }

  function afterMove() {
    if (goalsMet(spec.goals, progress)) return finish(true);
    if (moves <= 0) return outOfMoves();
    scheduleHint();
  }

  /* ---- input: swipe a tile, or tap two neighbours ---- */
  function cellAt(e) {
    const r = boardEl().getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / size),
      y = Math.floor((e.clientY - r.top) / size);
    return x >= 0 && y >= 0 && x < spec.w && y < spec.h ? [x, y] : null;
  }
  let drag = null;
  function down(e) {
    if (!active || busy || over) return;
    const c = cellAt(e);
    if (!c) return;
    if (mode === "spoon") return spoonAt(c);
    drag = { c, x: e.clientX, y: e.clientY };
  }
  function move(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < size * 0.35) return;
    const d =
      Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
    const a = drag.c,
      b = [a[0] + d[0], a[1] + d[1]];
    drag = null;
    select(null);
    if (b[0] >= 0 && b[1] >= 0 && b[0] < spec.w && b[1] < spec.h) doSwap(a, b);
  }
  function up() {
    if (!drag) return;
    const c = drag.c;
    drag = null;
    if (selected && adjacent(selected, c)) {
      const a = selected;
      select(null);
      doSwap(a, c);
    } else
      select(
        selected && selected[0] === c[0] && selected[1] === c[1] ? null : c,
      );
  }
  function select(c) {
    if (selected) {
      const s = board.grid[selected[1]][selected[0]];
      tiles.get(s?.id)?.classList.remove("sel");
    }
    selected = c;
    if (c) tiles.get(board.grid[c[1]][c[0]].id)?.classList.add("sel");
  }

  /* ---- hints ---- */
  function clearHint() {
    clearTimeout(hintT);
    boardEl()
      .querySelectorAll(".hint")
      .forEach((el) => el.classList.remove("hint"));
  }
  function scheduleHint() {
    clearHint();
    hintT = setTimeout(() => {
      const m = board && !busy && !over && findMove(board);
      if (!m) return;
      m.forEach(([x, y]) =>
        tiles.get(board.grid[y][x].id)?.classList.add("hint"),
      );
    }, 5000);
  }

  /* ---- tools ---- */
  function useTool(id) {
    if (busy || over) return;
    const s = sideSave(Save.d);
    if (!(s.match.tools[id] > 0)) {
      if (buyItem(Save.d, "tool", id)) {
        Save.save();
        UI.coins();
        UI.toast(`Bought ${TOOLS[id].name} for ${fmt(TOOLS[id].price)}`);
        Sound.play("buy");
      } else {
        Sound.play("wrong");
        UI.toast(`${TOOLS[id].name} costs ${fmt(TOOLS[id].price)}`);
        return;
      }
    }
    if (id === "spoon") {
      mode = mode === "spoon" ? "" : "spoon";
      if (mode) cheer("Tap a tile to smash it");
      drawGoals();
      return;
    }
    s.match.tools[id]--;
    Save.save();
    if (id === "moves") {
      moves += 5;
      cheer("+5 moves!", true);
      Sound.play("star");
      drawGoals();
    } else if (id === "stir") {
      busy = true;
      const moved = shuffle(board);
      Sound.play("combo");
      play([{ shuffle: moved }]).then(() => {
        busy = false;
        drawGoals();
        scheduleHint();
      });
    }
  }
  async function spoonAt(c) {
    mode = "";
    const s = sideSave(Save.d);
    s.match.tools.spoon--;
    Save.save();
    busy = true;
    clearHint();
    const el = tiles.get(board.grid[c[1]][c[0]].id);
    el?.classList.add("smash");
    Sound.play("place");
    await wait(160);
    const res = smash(board, c[0], c[1]);
    await play(res.steps);
    busy = false;
    drawGoals();
    afterMove();
  }

  /* ---- level start and end ---- */
  function prizeText(n) {
    const s = sideSave(Save.d);
    const first = !s.match.stars[n];
    const r = matchReward(n, first);
    const bits = [];
    if (r.recipe) {
      const rec = RECIPES.find((x) => x.id === r.recipe);
      bits.push(`${rec.icon} New recipe: ${rec.name}`);
    }
    if (r.cash) bits.push(fmt(r.cash));
    for (const [g, q] of Object.entries(r.pantry))
      bits.push(`${INGREDIENTS[g].icon} ${q} ${INGREDIENTS[g].unit}`);
    if (!first && !canPay(Save.d, "match", today()))
      return "Daily rewards used up. Play on for stars!";
    return (first ? "First clear: " : "Replay: ") + bits.join(" · ");
  }
  function goalChips(g) {
    return g
      .map(
        (x) =>
          `<span class="m3Goal"><span>${goalIcon(x)}</span><b>${x.n}</b><small>${x.type === "ice" ? "ice to break" : PIECES[x.k].name}</small></span>`,
      )
      .join("");
  }
  function showStart() {
    const s = sideSave(Save.d);
    pick = Math.max(1, Math.min(pick, s.match.level));
    const sp = levelSpec(pick);
    $("#m3StartLevel").textContent = "Level " + pick;
    $("#m3StartStars").innerHTML = starRow(s.match.stars[pick] || 0);
    $("#m3StartGoals").innerHTML = goalChips(sp.goals);
    $("#m3StartPrize").textContent = prizeText(pick);
    $("#m3Prev").disabled = pick <= 1;
    $("#m3Next").disabled = pick >= s.match.level;
    const tools = s.match.tools;
    $("#m3Shop").innerHTML = Object.entries(TOOLS)
      .map(
        ([id, t]) =>
          `<button class="shopChip${id === "hot" && hot ? " on" : ""}" data-tool="${id}">
            <span>${t.icon}</span><b>${t.name}</b>
            <small>${tools[id] ? "You have " + tools[id] : fmt(t.price)}</small></button>`,
      )
      .join("");
    UI.open("ovMatchStart");
  }
  const starRow = (n) =>
    [0, 1, 2].map((i) => `<i class="${i < n ? "on" : ""}">★</i>`).join("");

  function startLevel() {
    UI.close("ovMatchStart");
    UI.close("ovMatchEnd");
    spec = levelSpec(pick);
    board = createBoard({
      w: spec.w,
      h: spec.h,
      kinds: spec.kinds,
      grease: spec.grease,
      ice: spec.ice,
    });
    progress = spec.goals.map(() => 0);
    moves = spec.moves;
    score = 0;
    startedAt = performance.now();
    over = false;
    busy = false;
    mode = "";
    selected = null;
    $("#m3Level").textContent = "Level " + pick;
    const s = sideSave(Save.d);
    let made = [];
    if (hot && s.match.tools.hot > 0) {
      s.match.tools.hot--;
      made = addSpecials(board, 2);
      Save.save();
    }
    hot = false;
    // Wait a frame so the board has its size on screen.
    requestAnimationFrame(() => {
      drawBoard();
      drawGoals();
      if (made.length) cheer("Hot start!", true);
      if (spec.ice.length)
        UI.toast(
          "🧊 Frozen food: match it to crack the ice. Thick ice takes two hits.",
        );
      Sound.play("go");
      scheduleHint();
    });
  }

  function outOfMoves() {
    over = true;
    const tools = sideSave(Save.d).match.tools;
    finish(false, tools.moves > 0);
  }

  // Each finished level is reported to the server like a shift.
  function report(won, stars, cash) {
    ctx.report?.({
      mode: "match",
      level: pick,
      won,
      served: progress.reduce((a, b) => a + b, 0) % 1000,
      lost: 0,
      sales: cash,
      cash,
      stars,
      duration: Math.min(
        7200,
        Math.round((performance.now() - startedAt) / 1000),
      ),
    });
  }

  function finish(won, canExtend) {
    over = true;
    clearHint();
    const total = spec.moves;
    $("#m3EndStars").innerHTML = won ? starRow(starsFor(moves, total)) : "";
    const rows = [];
    if (won) {
      const stars = starsFor(moves, total);
      const r = claimMatch(Save.d, pick, stars, today());
      Save.save();
      report(true, stars, r.cash);
      UI.coins();
      $("#m3EndTitle").textContent =
        stars === 3 ? "Perfect market run!" : "Level complete!";
      $("#m3EndSub").textContent =
        `Score ${score.toLocaleString()} · ${moves} moves to spare`;
      if (r.recipe) {
        const rec = RECIPES.find((x) => x.id === r.recipe);
        rows.push(
          `<div class="rewardRow recipe"><span>${rec.icon}</span><b>New recipe: ${rec.name}</b><small>Guests can now order it as an owner special in your restaurant.</small></div>`,
        );
      }
      if (r.cash)
        rows.push(
          `<div class="rewardRow"><span>💵</span><b>${fmt(r.cash)}</b></div>`,
        );
      else if (!r.first)
        rows.push(
          `<div class="rewardRow"><span>🗓️</span><b>Daily rewards used up</b><small>Come back tomorrow</small></div>`,
        );
      for (const [g, q] of Object.entries(r.pantry))
        rows.push(
          `<div class="rewardRow"><span>${INGREDIENTS[g].icon}</span><b>${q} ${INGREDIENTS[g].unit} of ${INGREDIENTS[g].name}</b><small>Added to your pantry</small></div>`,
        );
      for (const b of Object.keys(r.boosters))
        rows.push(
          `<div class="rewardRow"><span>🎁</span><b>+1 ${b} booster</b><small>For restaurant levels</small></div>`,
        );
      for (const t of Object.keys(r.tools))
        rows.push(
          `<div class="rewardRow"><span>${TOOLS[t].icon}</span><b>+1 ${TOOLS[t].name}</b></div>`,
        );
      $("#m3EndNext .buttonLabel").textContent = "Next";
      pick++;
      Sound.play("win");
      Haptics.play("win");
    } else {
      $("#m3EndTitle").textContent = "Out of moves";
      $("#m3EndSub").textContent = canExtend
        ? "Use +5 moves and keep going?"
        : "So close! Try again.";
      $("#m3EndNext .buttonLabel").textContent = canExtend
        ? "+5 moves"
        : "Retry";
      report(false, 0, 0);
      Sound.play("fail");
    }
    $("#m3EndRewards").innerHTML = rows.join("");
    $("#ovMatchEnd").dataset.extend = !won && canExtend ? "1" : "";
    setTimeout(() => UI.open("ovMatchEnd"), won ? 500 : 200);
  }

  /* ---- wiring ---- */
  function open() {
    active = true;
    sideSave(Save.d);
    pick = sideSave(Save.d).match.level;
    UI.show("scrMatch");
    showStart();
  }
  function close() {
    active = false;
    clearHint();
    ["ovMatchStart", "ovMatchEnd"].forEach((id) => UI.close(id));
    ctx.onExit();
  }

  on("#m3Prev", () => {
    pick--;
    showStart();
  });
  on("#m3Next", () => {
    pick++;
    showStart();
  });
  on("#m3Play", () => startLevel());
  on("#m3StartClose", () => close());
  on("#m3Back", () => {
    if (busy) return;
    showStart();
  });
  on("#m3EndMenu", () => close());
  on("#m3EndNext", () => {
    if ($("#ovMatchEnd").dataset.extend) {
      UI.close("ovMatchEnd");
      over = false;
      useTool("moves");
      scheduleHint();
      return;
    }
    showStart();
    UI.close("ovMatchEnd");
  });
  on("#m3Spoon", () => useTool("spoon"));
  on("#m3Stir", () => useTool("stir"));
  on("#m3MoreMoves", () => useTool("moves"));
  listen(document, "click", (e) => {
    const chip = e.target.closest?.("#m3Shop [data-tool]");
    if (!chip) return;
    const id = chip.dataset.tool;
    const tools = sideSave(Save.d).match.tools;
    if (id === "hot") {
      if (!tools.hot && !buyItem(Save.d, "tool", "hot")) {
        Sound.play("wrong");
        return UI.toast("Not enough naira for Hot start");
      }
      hot = !hot || !tools.hot;
    } else if (!buyItem(Save.d, "tool", id)) {
      Sound.play("wrong");
      return UI.toast(`Not enough naira for ${TOOLS[id].name}`);
    } else UI.toast(`Bought ${TOOLS[id].name}`);
    Sound.play("buy");
    Save.save();
    UI.coins();
    showStart();
  });
  const host = () => boardEl();
  listen(window, "pointerdown", (e) => host()?.contains(e.target) && down(e));
  listen(window, "pointermove", (e) => drag && move(e));
  listen(window, "pointerup", () => up());
  listen(window, "resize", () => {
    if (!active || !board) return;
    measure();
    board.grid.forEach((row, y) =>
      row.forEach((c, x) => {
        const el = tiles.get(c.id);
        if (el) place(el, x, y);
      }),
    );
    boardEl()
      .querySelectorAll(".m3cell")
      .forEach((g) => {
        const [x, y] = g.dataset.cell.split(",").map(Number);
        g.style.transform = `translate(${x * size}px, ${y * size}px)`;
      });
  });

  return {
    open,
    close,
    active: () => active,
    // For tests: the live board and a way to make a move.
    debug: () => ({ board, spec, moves, progress, busy, over }),
    swap: (a, b) => doSwap(a, b),
    hint: () => board && findMove(board),
  };
}
