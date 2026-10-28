/* Okada Rush: the delivery runner. Draws game/runner.js state with the
   game's own WebGL renderer in a separate scene, so phones never hold a
   second 3D context. Controls are swipes (or arrow keys), with no buttons
   on screen. */
import {
  createRun,
  step,
  act,
  tierFor,
  runStars,
  runSettlement,
  nextDrop,
  POWERS,
  HAZARDS,
  MAX_PACKS,
  RUN_UNLOCK,
} from "../game/runner.js";
import {
  GEAR,
  sideSave,
  claimRun,
  buyItem,
  canPay,
} from "../game/sidegames.js";

const LANE_W = 2.3,
  ROAD_W = LANE_W * 3 + 0.8,
  ROAD_LEN = 230,
  ROAD_TILE = 8,
  LOT = 11,
  LOTS = 20;
const WALLS = [
  "#FFF4DE",
  "#F7C6A3",
  "#BFE3D0",
  "#FFE08A",
  "#CFE3FF",
  "#F4B6C2",
  "#E8D5B5",
];
const ROOFS = [
  "#C8553D",
  "#3E7CB1",
  "#8E5B3E",
  "#2F8F6B",
  "#B5473A",
  "#6D6875",
];
const SIGNS = [
  ["MAMA PUT", "#E53935", "#FFF"],
  ["PURE WATER", "#1E88E5", "#FFF"],
  ["SUYA SPOT", "#4A1F0C", "#FFC531"],
  ["BUKA", "#2FA34F", "#FFF"],
  ["PHONE REPAIRS", "#FFC531", "#4A1F0C"],
  ["POS · TRANSFERS", "#7B1FA2", "#FFF"],
  ["CHEMIST", "#00897B", "#FFF"],
  ["BARBING SALON", "#3949AB", "#FFF"],
];
const CONFETTI = [
  "#FFC531",
  "#2FA34F",
  "#E53935",
  "#12A99F",
  "#FFFFFF",
  "#7A5BD6",
];
const TIPS = {
  1: "Swipe left or right into the green lane to deliver!",
  2: "Potholes ahead. Swipe up to jump them!",
  3: "Checkpoint poles: swipe down to duck under!",
  4: "Endless! Three crashes and the night is over.",
};

export function createOkadaRush(ctx) {
  const {
    T3,
    renderer,
    $,
    on,
    listen,
    UI,
    Save,
    Sound,
    Haptics,
    fmt,
    today,
    person,
  } = ctx;
  const M = (c, o = {}) =>
    new T3.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
  const box = (w, h, d) => new T3.BoxGeometry(w, h, d);
  const mesh = (g, m, x = 0, y = 0, z = 0) => {
    const o = new T3.Mesh(g, m);
    o.position.set(x, y, z);
    return o;
  };

  let scene = null,
    camera = null,
    run = null,
    active = false,
    paused = true,
    level = 1,
    countdown = 0,
    shake = 0,
    T = 0,
    rider = null,
    roadTex = [],
    lots = [],
    doneT = 0,
    swiped = false,
    startedAt = 0;
  const objs = new Map();
  const fading = [];
  const bits = [];
  const owned = { geos: new Set(), mats: new Set(), tex: new Set() };
  const hudCache = {};

  /* ---- textures drawn once on a canvas ---- */
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T3.CanvasTexture(c);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;
    if (repeat) {
      t.wrapS = t.wrapT = T3.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    owned.tex.add(t);
    return t;
  }
  function specks(g, w, h, n, colors) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[i % colors.length];
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }
  // Asphalt with white edge lines and dashed lane lines, tiling along the road.
  function asphalt(night) {
    return canvasTex(
      256,
      256,
      (g, w, h) => {
        g.fillStyle = night ? "#34373F" : "#55595F";
        g.fillRect(0, 0, w, h);
        specks(
          g,
          w,
          h,
          900,
          night ? ["#2C2F36", "#3E424A"] : ["#4C5056", "#62666D", "#5A5E64"],
        );
        const u = (x) => (x / ROAD_W + 0.5) * w;
        g.fillStyle = "#F2F2F2";
        g.fillRect(u(-ROAD_W / 2 + 0.25), 0, 5, h);
        g.fillRect(u(ROAD_W / 2 - 0.25) - 5, 0, 5, h);
        g.fillStyle = night ? "#E8E8E8" : "#FFFFFF";
        [-LANE_W / 2, LANE_W / 2].forEach((x) =>
          g.fillRect(u(x) - 3, 40, 6, 130),
        );
      },
      [1, ROAD_LEN / ROAD_TILE],
    );
  }
  function pavers(night) {
    return canvasTex(
      128,
      128,
      (g, w, h) => {
        g.fillStyle = night ? "#77705F" : "#D8CDB2";
        g.fillRect(0, 0, w, h);
        g.strokeStyle = night ? "#5E5848" : "#B9AC8D";
        g.lineWidth = 3;
        for (let y = 0; y < h; y += 32)
          for (let x = (y / 32) % 2 ? -16 : 0; x < w; x += 32)
            g.strokeRect(x, y, 32, 32);
      },
      [2, ROAD_LEN / 4],
    );
  }
  function kerb() {
    return canvasTex(
      32,
      128,
      (g, w, h) => {
        for (let y = 0; y < h; y += 32) {
          g.fillStyle = (y / 32) % 2 ? "#1E1E1E" : "#FFC531";
          g.fillRect(0, y, w, 32);
        }
      },
      [1, ROAD_LEN / 2],
    );
  }
  function signTex([text, bg, fg]) {
    return canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(255,255,255,.7)";
      g.lineWidth = 4;
      g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = fg;
      g.font = "bold 30px Arial Rounded MT Bold, Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, w / 2, h / 2 + 2);
    });
  }
  function skyTex(night) {
    return canvasTex(4, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, night ? "#0B1030" : "#3FA2F0");
      gr.addColorStop(0.65, night ? "#2B2F6B" : "#9ED4FA");
      gr.addColorStop(1, night ? "#5B4A7A" : "#E8F6FF");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
  }
  let shadowTex = null;
  function blob(w, d, o = 0.35) {
    if (!shadowTex)
      shadowTex = canvasTex(64, 64, (g) => {
        const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
        gr.addColorStop(0, "rgba(0,0,0,1)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
      });
    const s = mesh(
      new T3.PlaneGeometry(w, d),
      new T3.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: o,
        depthWrite: false,
      }),
      0,
      0.02,
      0,
    );
    s.rotation.x = -Math.PI / 2;
    return s;
  }
  // A name pin over a waiting customer, readable from far down the road.
  function pinTex(text, done) {
    return canvasTex(256, 96, (g, w, h) => {
      g.fillStyle = done ? "#FFC531" : "#2FA34F";
      if (g.roundRect) {
        g.beginPath();
        g.roundRect(4, 4, w - 8, h - 30, 22);
        g.fill();
      } else g.fillRect(4, 4, w - 8, h - 30);
      g.beginPath();
      g.moveTo(w / 2 - 14, h - 27);
      g.lineTo(w / 2, h - 4);
      g.lineTo(w / 2 + 14, h - 27);
      g.fill();
      g.fillStyle = done ? "#4A1F0C" : "#FFFFFF";
      g.font = "bold 30px Arial Rounded MT Bold, Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, w / 2, (h - 26) / 2 + 4);
    });
  }

  /* ---- the world ---- */
  // Remembers geometry and materials built here, to free them on exit.
  // People come from the main game's shared caches and are skipped.
  function track(o) {
    const walk = (c) => {
      if (c.userData.shared) return;
      if (c.geometry) owned.geos.add(c.geometry);
      if (c.material) owned.mats.add(c.material);
      c.children.forEach(walk);
    };
    walk(o);
    return o;
  }

  function strip(tex, w, x, y, night, mat) {
    const m = mat || M("#FFFFFF", { map: tex, roughness: 0.95 });
    const p = mesh(
      new T3.PlaneGeometry(w, ROAD_LEN),
      m,
      x,
      y,
      -ROAD_LEN / 2 + 25,
    );
    p.rotation.x = -Math.PI / 2;
    if (tex) roadTex.push({ tex, per: tex.repeat.y / ROAD_LEN });
    scene.add(track(p));
    return p;
  }

  function buildScene(tier) {
    scene = new T3.Scene();
    roadTex = [];
    const night = !!tier.night;
    scene.background = skyTex(night);
    scene.fog = new T3.Fog(night ? "#2B2F6B" : "#CFEAFB", 45, 150);
    scene.add(
      new T3.HemisphereLight(
        night ? 0x8a96ff : 0xeaf6ff,
        night ? 0x1c1c2c : 0x8fc46e,
        night ? 0.6 : 1.05,
      ),
    );
    const sun = new T3.DirectionalLight(
      night ? 0xb0bcff : 0xfff1d6,
      night ? 0.45 : 1.15,
    );
    sun.position.set(-8, 16, 6);
    scene.add(sun);
    camera = new T3.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 220);
    camera.position.set(0, 4.7, 7.6);

    // Ground, road, kerbs and pavements: long strips whose textures scroll.
    strip(
      null,
      160,
      0,
      -0.08,
      night,
      M(night ? "#24402A" : "#76C062", { roughness: 1 }),
    );
    strip(asphalt(night), ROAD_W, 0, 0, night);
    [-1, 1].forEach((s) => {
      strip(kerb(), 0.35, s * (ROAD_W / 2 + 0.17), 0.06, night);
      strip(pavers(night), 3.4, s * (ROAD_W / 2 + 2.05), 0.05, night);
      strip(
        null,
        0.5,
        s * (ROAD_W / 2 + 4),
        0.02,
        night,
        M("#3B3B3B", { roughness: 1 }),
      );
    });

    // Roadside lots that loop past: houses, shops, palms, kiosks and lamps.
    lots = [];
    const signs = SIGNS.map(signTex);
    for (let i = 0; i < LOTS * 2; i++) {
      const side = i % 2 ? 1 : -1;
      const g = new T3.Group();
      const kind = [
        "house",
        "shop",
        "palm",
        "house",
        "kiosk",
        "shop",
        "tall",
        "palm",
      ][i % 8];
      buildLot(g, kind, side, i, night, signs);
      // A street lamp at the kerb every other lot.
      if (i % 4 < 2) g.add(lamp(side, night));
      g.userData = {
        side,
        z: Math.floor(i / 2) * LOT + (side > 0 ? LOT / 2 : 0),
      };
      scene.add(track(g));
      lots.push(g);
    }
    rider = buildRider();
    scene.add(track(rider.root));
    // Confetti for deliveries, kept in a pool.
    bits.length = 0;
    const bitGeo = new T3.PlaneGeometry(0.16, 0.1);
    for (let i = 0; i < 40; i++) {
      const b = mesh(
        bitGeo,
        new T3.MeshBasicMaterial({
          color: CONFETTI[i % CONFETTI.length],
          side: T3.DoubleSide,
        }),
      );
      b.visible = false;
      b.userData = { life: 0, v: new T3.Vector3() };
      scene.add(track(b));
      bits.push(b);
    }
  }

  function lamp(side, night) {
    const l = new T3.Group();
    l.add(
      mesh(
        new T3.CylinderGeometry(0.06, 0.09, 4.4, 6),
        M("#3A3A3A"),
        0,
        2.2,
        0,
      ),
    );
    l.add(mesh(box(1.1, 0.08, 0.16), M("#3A3A3A"), -side * 0.5, 4.35, 0));
    l.add(
      mesh(
        box(0.4, 0.1, 0.22),
        M("#FFF4C4", {
          emissive: night ? "#FFD86B" : "#000",
          emissiveIntensity: night ? 1.6 : 0,
        }),
        -side * 0.95,
        4.27,
        0,
      ),
    );
    l.position.set(side * (ROAD_W / 2 + 0.7), 0, 0);
    return l;
  }

  function buildLot(g, kind, side, i, night, signs) {
    const x = side * (ROAD_W / 2 + 6.2);
    const wall = WALLS[(i * 3) % WALLS.length],
      roofC = ROOFS[i % ROOFS.length];
    const glass = M(night ? "#FFE28A" : "#8FD3F0", {
      emissive: night ? "#FFB84D" : "#000",
      emissiveIntensity: night ? 0.9 : 0,
      roughness: 0.2,
    });
    // Each lot is built facing +z, then turned to face the road.
    const face = 1,
      turn = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (kind === "palm") {
      const p = new T3.Group();
      p.add(
        mesh(
          new T3.CylinderGeometry(0.14, 0.22, 4.2, 7),
          M("#9A6B3F"),
          0,
          2.1,
          0,
        ),
      );
      for (let k = 0; k < 6; k++) {
        const leaf = mesh(box(0.35, 0.06, 2.2), M("#3E9B3A"), 0, 4.2, 0);
        leaf.geometry.translate(0, 0, 1.1);
        leaf.rotation.set(-0.45, (k / 6) * Math.PI * 2, 0);
        p.add(leaf);
      }
      p.position.set(side * (ROAD_W / 2 + 4.6), 0, 0);
      g.add(p);
      // A low compound wall behind the palm.
      g.add(mesh(box(0.3, 1.3, 6), M(wall), x - side * 1.2, 0.65, 0));
      return;
    }
    if (kind === "kiosk") {
      const k = new T3.Group();
      k.add(mesh(box(1.8, 1.6, 1.4), M("#1E88E5"), 0, 0.8, 0));
      k.add(mesh(box(1.9, 0.1, 1.6), M("#FFFFFF"), 0, 1.65, 0));
      k.add(mesh(box(1.4, 0.7, 0.05), M("#FFC531"), 0, 1.15, face * 0.71));
      const umb = mesh(
        new T3.ConeGeometry(1.4, 0.6, 10),
        M(i % 3 ? "#E53935" : "#FFC531"),
        face * 1.3,
        2.4,
        0.4,
      );
      k.add(umb);
      k.add(
        mesh(
          new T3.CylinderGeometry(0.04, 0.04, 2.2, 6),
          M("#555"),
          face * 1.3,
          1.1,
          0.4,
        ),
      );
      k.position.set(side * (ROAD_W / 2 + 4.4), 0, 0);
      k.rotation.y = turn;
      g.add(k);
      g.add(mesh(box(3.6, 2.8, 3.2), M(wall), x + side * 1.6, 1.4, 0));
      return;
    }
    const tall = kind === "tall";
    const w = 4.6,
      h = tall ? 7.5 : kind === "shop" ? 3.4 : 4.6,
      d = 4.2;
    const b = new T3.Group();
    b.add(mesh(box(w, h, d), M(wall), 0, h / 2, 0));
    if (tall) {
      b.add(mesh(box(w + 0.3, 0.25, d + 0.3), M(roofC), 0, h + 0.1, 0));
      // Balconies on the upper floors.
      [3.2, 5.6].forEach((y) => {
        b.add(
          mesh(
            box(w - 0.6, 0.12, 0.7),
            M("#FFFFFF"),
            0,
            y,
            face * (d / 2 + 0.35),
          ),
        );
        b.add(
          mesh(
            box(w - 0.6, 0.6, 0.06),
            M("#B0BEC5"),
            0,
            y + 0.3,
            face * (d / 2 + 0.68),
          ),
        );
      });
    } else {
      const r = mesh(new T3.ConeGeometry(0.72, 1, 4), M(roofC), 0, h + 0.6, 0);
      r.rotation.y = Math.PI / 4;
      r.scale.set(w * 1.05, 1.2, d * 1.05);
      b.add(r);
    }
    const floors = tall ? 3 : 1;
    for (let f = 0; f < floors; f++)
      [-1.2, 1.2].forEach((wx) =>
        b.add(
          mesh(
            box(0.9, 0.8, 0.06),
            glass,
            wx,
            (tall ? 1.6 : 2.4) + f * 2.4,
            face * (d / 2 + 0.03),
          ),
        ),
      );
    if (kind === "shop") {
      // Open shopfront with an awning and a signboard.
      b.add(
        mesh(box(2.4, 1.9, 0.06), M("#3A2A1E"), 0, 0.95, face * (d / 2 + 0.03)),
      );
      for (let k = 0; k < 6; k++)
        b.add(
          mesh(
            box(w / 6, 0.08, 1.1),
            M(k % 2 ? "#FFFFFF" : ["#E53935", "#2FA34F", "#1E88E5"][i % 3]),
            -w / 2 + w / 12 + (k * w) / 6,
            2.2,
            face * (d / 2 + 0.55),
          ),
        );
      const sign = mesh(
        new T3.PlaneGeometry(3.6, 0.9),
        new T3.MeshBasicMaterial({ map: signs[i % signs.length] }),
        0,
        2.85,
        face * (d / 2 + 0.06),
      );
      b.add(sign);
    } else
      b.add(
        mesh(box(0.9, 1.7, 0.06), M("#7A4B2A"), 0, 0.85, face * (d / 2 + 0.03)),
      );
    b.position.set(x, 0, 0);
    b.rotation.y = turn;
    g.add(b);
  }

  // The okada and its rider, with the Mama Put delivery box on the back.
  function buildRider() {
    const root = new T3.Group(),
      lean = new T3.Group();
    root.add(lean);
    root.add(blob(1.3, 2.4, 0.4));
    const red = M("#E53935", { roughness: 0.35, metalness: 0.25 });
    lean.add(mesh(box(0.42, 0.35, 1.5), red, 0, 0.62, 0));
    lean.add(mesh(box(0.36, 0.14, 0.7), M("#222"), 0, 0.86, 0.15));
    lean.add(mesh(box(0.5, 0.22, 0.4), M("#C62828"), 0, 0.78, -0.55));
    const wheels = [];
    [-0.62, 0.62].forEach((z) => {
      const w = mesh(
        new T3.TorusGeometry(0.3, 0.1, 8, 16),
        M("#1E1E1E"),
        0,
        0.36,
        z,
      );
      w.rotation.y = Math.PI / 2;
      lean.add(w);
      wheels.push(w);
    });
    lean.add(
      mesh(
        box(0.9, 0.06, 0.06),
        M("#9E9E9E", { metalness: 0.7 }),
        0,
        1.18,
        -0.6,
      ),
    );
    lean.add(
      mesh(
        new T3.SphereGeometry(0.1, 8, 6),
        M("#FFF7C2", { emissive: "#FFE066", emissiveIntensity: 0.9 }),
        0,
        0.85,
        -0.8,
      ),
    );
    lean.add(
      mesh(
        box(0.3, 0.08, 0.04),
        M("#FF1744", { emissive: "#FF1744", emissiveIntensity: 0.8 }),
        0,
        0.72,
        0.76,
      ),
    );
    // Delivery box with the Mama Put stripe.
    const crate = new T3.Group();
    crate.add(mesh(box(0.72, 0.6, 0.62), M("#FFFFFF", { roughness: 0.45 })));
    crate.add(mesh(box(0.74, 0.16, 0.64), M("#12A99F"), 0, 0.12, 0));
    crate.add(mesh(box(0.74, 0.06, 0.64), M("#FFC531"), 0, -0.02, 0));
    crate.position.set(0, 1.25, 0.62);
    lean.add(crate);
    if (person) {
      const p = person(7);
      p.root.userData.shared = true;
      p.root.scale.setScalar(0.72);
      p.root.position.set(0, 0.62, 0.05);
      p.root.rotation.y = Math.PI;
      lean.add(p.root);
    } else lean.add(mesh(box(0.5, 0.9, 0.35), M("#2F8F6B"), 0, 1.35, 0.05));
    const helmet = mesh(
      new T3.SphereGeometry(0.27, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8),
      M("#FFC531", { roughness: 0.3 }),
      0,
      1.86,
      0.05,
    );
    helmet.visible = false;
    lean.add(helmet);
    const flame = mesh(
      new T3.ConeGeometry(0.16, 0.8, 8),
      M("#FF8A00", { emissive: "#FF5A00", emissiveIntensity: 1.4 }),
      0,
      0.55,
      1.15,
    );
    flame.rotation.x = -Math.PI / 2;
    flame.visible = false;
    lean.add(flame);
    return { root, lean, wheels, helmet, flame, crate };
  }

  /* ---- road items ---- */
  function itemMesh(it) {
    const g = new T3.Group();
    const u = g.userData;
    if (it.type === "hazard") {
      if (it.kind === "danfo") {
        g.add(blob(2.6, 5, 0.45));
        const y = M("#FFC531", { roughness: 0.4 });
        g.add(mesh(box(1.9, 1.7, 4.2), y, 0, 1.15, 0));
        g.add(mesh(box(1.8, 0.5, 4.1), y, 0, 2.2, 0.1));
        [0.55, 1.5].forEach((h) =>
          g.add(mesh(box(1.92, 0.12, 4.22), M("#1E1E1E"), 0, h, 0)),
        );
        const win = M("#2B3A4A", { roughness: 0.15, metalness: 0.3 });
        g.add(mesh(box(1.7, 0.55, 0.05), win, 0, 2.05, 2.13));
        g.add(mesh(box(1.7, 0.55, 0.05), win, 0, 2.05, -2.08));
        [-0.97, 0.97].forEach((x) =>
          g.add(mesh(box(0.05, 0.5, 3.4), win, x, 2.05, 0)),
        );
        // Bags tied on the roof rack.
        g.add(mesh(box(1.4, 0.35, 1.2), M("#6D4C41"), 0.1, 2.62, 0.6));
        g.add(mesh(box(0.9, 0.3, 0.9), M("#1565C0"), -0.3, 2.6, -0.8));
        [-0.75, 0.75].forEach((x) =>
          [-1.4, 1.4].forEach((z) => {
            const w = mesh(
              new T3.CylinderGeometry(0.33, 0.33, 0.26, 12),
              M("#1E1E1E"),
              x,
              0.33,
              z,
            );
            w.rotation.z = Math.PI / 2;
            g.add(w);
          }),
        );
        [-0.6, 0.6].forEach((x) =>
          g.add(
            mesh(
              box(0.26, 0.16, 0.05),
              M("#FF5252", { emissive: "#FF1744", emissiveIntensity: 0.8 }),
              x,
              0.85,
              2.13,
            ),
          ),
        );
      } else if (it.kind === "barrier") {
        g.add(blob(2.2, 0.8, 0.3));
        for (let k = 0; k < 4; k++)
          g.add(
            mesh(
              box(0.46, 0.34, 0.22),
              M(k % 2 ? "#FFFFFF" : "#E53935", { roughness: 0.5 }),
              -0.69 + k * 0.46,
              0.66,
              0,
            ),
          );
        [-0.75, 0.75].forEach((x) => {
          g.add(mesh(box(0.1, 0.55, 0.1), M("#555"), x, 0.28, 0));
          g.add(mesh(box(0.5, 0.06, 0.4), M("#555"), x, 0.03, 0));
        });
      } else if (it.kind === "pothole") {
        const hole = mesh(
          new T3.CircleGeometry(0.95, 20),
          M("#1A1816", { roughness: 1 }),
          0,
          0.02,
          0,
        );
        hole.rotation.x = -Math.PI / 2;
        hole.scale.y = 0.72;
        g.add(hole);
        const water = mesh(
          new T3.CircleGeometry(0.55, 16),
          M("#5D7A99", { roughness: 0.05, metalness: 0.4 }),
          0.1,
          0.03,
          0.05,
        );
        water.rotation.x = -Math.PI / 2;
        water.scale.y = 0.6;
        g.add(water);
        const cone = mesh(
          new T3.ConeGeometry(0.2, 0.6, 10),
          M("#FF6D00"),
          -1,
          0.3,
          0.5,
        );
        g.add(cone);
        g.add(
          mesh(
            new T3.CylinderGeometry(0.17, 0.17, 0.08, 10),
            M("#FFFFFF"),
            -1,
            0.3,
            0.5,
          ),
        );
      } else if (it.kind === "pole") {
        g.add(blob(2.6, 0.9, 0.3));
        [-1, 1].forEach((s) => {
          g.add(
            mesh(
              new T3.CylinderGeometry(0.28, 0.28, 0.9, 12),
              M("#1565C0"),
              s * 1.05,
              0.45,
              0,
            ),
          );
          g.add(
            mesh(
              new T3.CylinderGeometry(0.29, 0.29, 0.12, 12),
              M("#FFFFFF"),
              s * 1.05,
              0.6,
              0,
            ),
          );
          g.add(mesh(box(0.1, 0.7, 0.1), M("#333"), s * 1.05, 1.2, 0));
        });
        for (let k = 0; k < 5; k++)
          g.add(
            mesh(
              box(0.46, 0.2, 0.18),
              M(k % 2 ? "#FFFFFF" : "#E53935"),
              -0.92 + k * 0.46,
              1.45,
              0,
            ),
          );
      }
    } else if (it.type === "note") {
      const n = new T3.Group();
      n.add(
        mesh(
          box(0.62, 0.32, 0.03),
          M("#3FA34D", { emissive: "#1E6B2A", emissiveIntensity: 0.5 }),
        ),
      );
      n.add(mesh(new T3.CircleGeometry(0.09, 12), M("#E8F5E9"), 0, 0, 0.02));
      n.position.y = 0.95;
      g.add(n);
      u.spin = n;
      u.bob = 0.95;
    } else if (it.type === "pack") {
      // A takeaway bag on a glowing pickup spot.
      const p = new T3.Group();
      p.add(mesh(box(0.62, 0.46, 0.42), M("#FFFFFF", { roughness: 0.5 })));
      p.add(mesh(box(0.64, 0.12, 0.44), M("#E53935"), 0, 0.1, 0));
      const handle = mesh(
        new T3.TorusGeometry(0.14, 0.03, 6, 12, Math.PI),
        M("#E53935"),
        0,
        0.23,
        0,
      );
      p.add(handle);
      p.position.y = 1;
      g.add(p);
      u.spin = p;
      u.bob = 1;
      const spot = mesh(
        new T3.RingGeometry(0.45, 0.75, 28),
        new T3.MeshBasicMaterial({
          color: "#FFFFFF",
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        }),
        0,
        0.04,
        0,
      );
      spot.rotation.x = -Math.PI / 2;
      g.add(spot);
      u.pulse = spot;
    } else if (it.type === "power") {
      const colors = {
        magnet: "#E53935",
        cooler: "#4FC3F7",
        helmet: "#FFC531",
        turbo: "#AB47BC",
      };
      const c = colors[it.kind];
      const orb = mesh(
        new T3.IcosahedronGeometry(0.42, 1),
        M(c, { emissive: c, emissiveIntensity: 0.7, roughness: 0.3 }),
        0,
        1.1,
        0,
      );
      g.add(orb);
      const ring = mesh(
        new T3.TorusGeometry(0.62, 0.05, 6, 24),
        new T3.MeshBasicMaterial({ color: "#FFFFFF" }),
        0,
        1.1,
        0,
      );
      g.add(ring);
      g.add(blob(1, 1, 0.25));
      u.spin = orb;
      u.ring = ring;
    } else if (it.type === "guide") {
      // Chevrons painted on the road pointing into the delivery lane.
      const m = new T3.MeshBasicMaterial({
        color: "#3BE07A",
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const shape = new T3.Shape();
      shape.moveTo(-0.7, -0.35);
      shape.lineTo(0, 0.35);
      shape.lineTo(0.7, -0.35);
      shape.lineTo(0.7, -0.05);
      shape.lineTo(0, 0.65);
      shape.lineTo(-0.7, -0.05);
      shape.closePath();
      const c = mesh(new T3.ShapeGeometry(shape), m, 0, 0.04, 0);
      c.rotation.x = -Math.PI / 2;
      g.add(c);
      u.pulse = c;
    } else if (it.type === "drop") {
      const side = it.lane;
      // The delivery spot: a ring on the road and a light beam to the sky.
      const ring = mesh(
        new T3.TorusGeometry(1, 0.12, 8, 28),
        M("#3BE07A", { emissive: "#2FA34F", emissiveIntensity: 1.1 }),
        0,
        1.15,
        0,
      );
      g.add(ring);
      const beam = mesh(
        new T3.CylinderGeometry(0.75, 0.9, 14, 16, 1, true),
        new T3.MeshBasicMaterial({
          color: "#3BE07A",
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          side: T3.DoubleSide,
        }),
        0,
        7,
        0,
      );
      g.add(beam);
      const pad = mesh(
        new T3.CircleGeometry(1.05, 28),
        new T3.MeshBasicMaterial({
          color: "#3BE07A",
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
        0,
        0.03,
        0,
      );
      pad.rotation.x = -Math.PI / 2;
      g.add(pad);
      // The customer waiting at the gate.
      const gate = new T3.Group();
      [-0.75, 0.75].forEach((x) =>
        gate.add(mesh(box(0.14, 2, 0.14), M("#8A5A34"), x, 1, 0)),
      );
      gate.add(mesh(box(1.6, 0.14, 0.14), M("#8A5A34"), 0, 2, 0));
      gate.add(mesh(box(1.3, 1.3, 0.06), M("#2E7D32"), 0, 0.75, 0));
      gate.position.set(side * (ROAD_W / 2 + 3.3) - side * LANE_W, 0, 0.3);
      gate.rotation.y = Math.PI / 2;
      g.add(gate);
      if (person) {
        const cust = person(it.id);
        cust.root.userData.shared = true;
        cust.root.position.set(
          side * (ROAD_W / 2 + 1.6) - side * LANE_W,
          0.05,
          0,
        );
        cust.root.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(cust.root);
        u.cust = cust;
      }
      const pin = new T3.Sprite(
        new T3.SpriteMaterial({
          map: pinTex("📍 " + (it.name || "Customer")),
          depthWrite: false,
        }),
      );
      pin.scale.set(3.2, 1.2, 1);
      pin.position.set(0, 3.6, 0);
      g.add(pin);
      Object.assign(u, { ring, beam, pad, pin, drop: true });
    }
    g.position.x = it.lane * LANE_W;
    scene.add(track(g));
    return g;
  }

  // A delivery: the ring turns gold, confetti flies, the customer cheers.
  function celebrate(o, it) {
    const u = o.userData;
    u.happy = 1;
    if (u.ring)
      u.ring.material = M("#FFC531", {
        emissive: "#FFB300",
        emissiveIntensity: 1.2,
      });
    if (u.beam) u.beam.material.color.set("#FFC531");
    if (u.pad) u.pad.material.color.set("#FFC531");
    if (u.pin) {
      u.pin.material.map = pinTex("✓ Thank you!", true);
      u.pin.material.needsUpdate = true;
    }
    owned.mats.add(u.ring?.material);
    let n = 0;
    for (const b of bits) {
      if (b.userData.life > 0) continue;
      b.visible = true;
      b.position.set(o.position.x, 1.4, o.position.z);
      b.userData.life = 1.2;
      b.userData.v.set(
        (Math.random() - 0.5) * 6,
        4 + Math.random() * 4,
        (Math.random() - 0.5) * 4,
      );
      if (++n >= 26) break;
    }
    void it;
  }

  /* ---- HUD ---- */
  function setHtml(sel, html) {
    if (hudCache[sel] === html) return;
    hudCache[sel] = html;
    $(sel).innerHTML = html;
  }
  function setText(sel, text) {
    if (hudCache[sel] === text) return;
    hudCache[sel] = text;
    $(sel).textContent = text;
  }
  function hud() {
    const t = run.tier;
    setText(
      "#runClock",
      t.endless
        ? Math.round(run.dist) + " m"
        : Math.floor(run.timeLeft / 60) +
            ":" +
            String(Math.floor(run.timeLeft % 60)).padStart(2, "0"),
    );
    $("#runClockBox").classList.toggle("low", !t.endless && run.timeLeft < 10);
    const goal = t.endless ? Math.ceil((run.delivered + 1) / 5) * 5 : t.target;
    setText("#runDelivered", `${run.delivered} / ${goal}`);
    $("#runGoalBar").style.width =
      Math.min(100, (run.delivered / goal) * 100) + "%";
    $("#runGoalBar").parentElement.parentElement.classList.toggle(
      "done",
      !t.endless && run.delivered >= t.target,
    );
    setText("#runCash", fmt(run.cash));
    let packs = "";
    for (let i = 0; i < MAX_PACKS; i++) {
      const p = run.packs[i];
      const heat = p ? Math.round(p.heat * 10) / 10 : 0;
      packs += p
        ? `<span class="pack${heat >= 0.7 ? " hot" : heat < 0.35 ? " cold" : ""}"><i>🥡</i><em style="width:${heat * 100}%"></em></span>`
        : `<span class="pack empty"><i>🥡</i></span>`;
    }
    setHtml("#runPacks", packs);
    setHtml(
      "#runLives",
      [0, 1, 2]
        .map(
          (i) =>
            `<i class="${i < run.maxCrashes - run.crashes ? "on" : ""}">❤</i>`,
        )
        .join("") + (run.power.helmet ? `<i class="shield">⛑️</i>` : ""),
    );
    setHtml(
      "#runPowers",
      ["magnet", "cooler", "turbo"]
        .filter((k) => run.power[k] > 0)
        .map(
          (k) =>
            `<span><b>${POWERS[k].icon}</b>${Math.ceil(run.power[k])}s</span>`,
        )
        .join(""),
    );
    setText("#runCombo", run.combo >= 2 ? `🔥 x${run.combo}` : "");
    // The navigation card: where the next order goes, or find food first.
    const nav = $("#runNav");
    nav.hidden = countdown > 0;
    const next = nextDrop(run);
    if (!run.packs.length) {
      nav.className = "runNav food";
      setText("#runNavArrow", "🥡");
      setText("#runNavTitle", "Pick up food");
      setText("#runNavSub", "Ride over a takeaway bag");
    } else if (next) {
      const m = Math.max(0, Math.round(next.z - run.dist));
      const lane = Math.round(run.x);
      const ok = lane === next.lane;
      nav.className = "runNav" + (ok ? " ok" : "") + (m < 15 ? " near" : "");
      setText("#runNavArrow", ok ? "⬆" : next.lane > lane ? "➜" : "⬅");
      setText("#runNavTitle", `Deliver to ${next.name || "customer"}`);
      setText(
        "#runNavSub",
        `${m} m · ${next.lane < 0 ? "left" : "right"} lane${ok ? " ✓" : ""}`,
      );
    } else {
      nav.className = "runNav";
      setText("#runNavArrow", "⬆");
      setText("#runNavTitle", "Keep riding");
      setText("#runNavSub", "Next customer coming up");
    }
  }
  function message(text, ms = 1400) {
    const el = $("#runMsg");
    el.textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(message.t);
    message.t = setTimeout(() => el.classList.remove("show"), ms);
  }
  function float(text, cls = "") {
    const f = document.createElement("div");
    f.className = "runFloat " + cls;
    f.textContent = text;
    $("#runFloats").appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }
  function delivered(e) {
    $("#runDoneTitle").textContent =
      `Delivered to ${e.item.name || "customer"}!`;
    $("#runDoneSub").textContent =
      `+${fmt(e.pay)}${e.heat >= 0.7 ? " · still hot, big tip 🔥" : e.heat < 0.35 ? " · food was cold" : ""}`;
    const el = $("#runDone");
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    doneT = 1.8;
  }

  /* ---- events from the run ---- */
  function onEvent(e) {
    const o = e.item && objs.get(e.item.id);
    if (e.type === "deliver") {
      Sound.play("serve");
      setTimeout(() => Sound.play("coin"), 120);
      Haptics.play("serve");
      delivered(e);
      if (run.combo >= 3) float(`Streak x${run.combo}!`, "pay");
      if (o) celebrate(o, e.item);
    } else if (e.type === "note") {
      Sound.play("coin");
      if (o) fadeOut(o, 1.6);
    } else if (e.type === "pack") {
      Sound.play("place");
      float("+1 order 🥡", "pack");
      if (o) fadeOut(o, 1.6);
    } else if (e.type === "full") {
      message("Box is full. Deliver first!", 900);
    } else if (e.type === "power") {
      Sound.play("star");
      Haptics.play("tap");
      message(`${POWERS[e.kind].icon} ${POWERS[e.kind].name}`, 1100);
      float(POWERS[e.kind].desc, "pack");
      if (o) fadeOut(o, 2);
    } else if (e.type === "crash") {
      Sound.play("wrong");
      Haptics.play("wrong");
      shake = 0.5;
      message(
        `${HAZARDS[e.item.kind].name}!${e.spilled ? " Food spilled 😩" : ""}`,
        1100,
      );
      if (o) o.userData.hit = 1;
    } else if (e.type === "shield") {
      Sound.play("tap");
      shake = 0.25;
      message("Helmet saved you! ⛑️", 1000);
    } else if (e.type === "missed") {
      float(`Missed ${e.item.name || "a customer"}`, "miss");
    } else if (e.type === "empty") {
      message("No food in the box. Grab a bag 🥡", 1200);
    } else if (e.type === "jump") Sound.play("tap");
    else if (e.type === "over") finish();
  }
  function fadeOut(o, grow) {
    o.userData.fade = true;
    fading.push({ o, t: 0, grow });
  }

  /* ---- each frame ---- */
  function update(dt) {
    T += dt;
    if (!scene) return;
    if (run && !paused) {
      if (countdown > 0) {
        const before = Math.ceil(countdown);
        countdown -= dt;
        if (Math.ceil(countdown) !== before && countdown > 0) {
          message(String(Math.ceil(countdown)), 700);
          Sound.play("tick");
        }
        if (countdown <= 0) {
          message("Go!", 900);
          setTimeout(
            () => active && !swiped && message(TIPS[run?.tier.id] || "", 2400),
            900,
          );
          Sound.play("go");
        }
      } else {
        step(run, dt).forEach(onEvent);
        if (run.t > 4 && !swiped) {
          swiped = true;
          $("#runSwipe").classList.remove("show");
        }
      }
      if (active) hud();
      doneT = Math.max(0, doneT - dt);
      if (!doneT) $("#runDone").classList.remove("show");
    }
    if (!run) return;
    const dist = run.dist;
    // Items: create, move, animate.
    const seen = new Set();
    for (const it of run.items) {
      seen.add(it.id);
      let o = objs.get(it.id);
      if (!o) {
        o = itemMesh(it);
        objs.set(it.id, o);
      }
      o.position.z = -(it.z - dist);
      // Anything already passed would block the camera behind the rider.
      if (!o.userData.fade) o.visible = o.position.z < 2.2;
      o.position.x += (it.lane * LANE_W - o.position.x) * Math.min(1, dt * 10);
      const u = o.userData;
      if (u.spin) u.spin.rotation.y += dt * 3;
      if (u.bob) u.spin.position.y = u.bob + Math.sin(T * 4 + it.id) * 0.12;
      if (u.pulse)
        u.pulse.material.opacity = 0.45 + Math.sin(T * 6 + it.z) * 0.35;
      if (u.ring) {
        u.ring.rotation.y = u.drop ? T * 1.5 : T * 2;
        u.ring.scale.setScalar(
          1 + Math.sin(T * 5) * 0.06 + (u.happy ? (1 - u.happy) * 0.8 : 0),
        );
      }
      if (u.beam)
        u.beam.material.opacity = u.happy
          ? 0.22 * u.happy
          : 0.16 + Math.sin(T * 3) * 0.06;
      if (u.pin) u.pin.position.y = 3.6 + Math.sin(T * 3 + it.id) * 0.12;
      if (u.cust) {
        const arm = u.cust.armR || u.cust.armL;
        if (arm)
          arm.rotation.z = u.happy
            ? Math.sin(T * 16) * 0.8 - 2.4
            : Math.sin(T * 7) * 0.5 - 1.3;
        u.cust.root.position.y = u.happy
          ? Math.abs(Math.sin(T * 12)) * 0.45
          : 0.05;
      }
      if (u.happy) u.happy = Math.max(0.001, u.happy - dt * 0.6);
      if (u.hit) {
        u.hit = Math.max(0, u.hit - dt * 2);
        o.rotation.y = Math.sin(u.hit * 20) * 0.1 * u.hit;
      }
    }
    for (const [id, o] of objs)
      if (!seen.has(id)) {
        scene.remove(o);
        objs.delete(id);
      }
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      f.t += dt * 4;
      f.o.scale.setScalar(1 + f.t * (f.grow - 1));
      f.o.traverse((c) => {
        if (c.material && !c.material.userData.own) {
          c.material = c.material.clone();
          c.material.userData.own = true;
          c.material.transparent = true;
          owned.mats.add(c.material);
        }
        if (c.material) c.material.opacity = Math.max(0, 1 - f.t);
      });
      if (f.t >= 1) {
        f.o.visible = false;
        fading.splice(i, 1);
      }
    }
    // Confetti.
    for (const b of bits) {
      const d = b.userData;
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v.y -= 12 * dt;
      b.position.addScaledVector(d.v, dt);
      b.rotation.x += dt * 9;
      b.rotation.y += dt * 7;
      if (d.life <= 0) b.visible = false;
    }
    // The road slides under the rider; roadside lots loop past.
    roadTex.forEach((r) => (r.tex.offset.y = (dist * r.per) % 1));
    const span = LOT * LOTS;
    lots.forEach((g) => {
      const rel = ((((g.userData.z - dist) % span) + span) % span) - 20;
      g.position.z = -rel;
    });
    // The rider: steer, lean, jump, duck, blink when hurt.
    const r = rider;
    const px = run.x * LANE_W;
    const prevX = r.root.position.x;
    r.root.position.x = px;
    r.lean.position.y = run.y;
    r.root.children[1].scale.setScalar(Math.max(0.4, 1 - run.y * 0.25));
    const tilt = Math.max(
      -0.45,
      Math.min(0.45, ((prevX - px) / Math.max(dt, 0.001)) * 0.06),
    );
    r.lean.rotation.z += (tilt - r.lean.rotation.z) * Math.min(1, dt * 12);
    r.lean.rotation.x =
      run.slide > 0 ? -0.35 : run.y > 0 ? 0.18 : Math.sin(T * 9) * 0.01;
    r.lean.scale.y = run.slide > 0 ? 0.72 : 1;
    const spin = (countdown > 0 ? 0 : run.speed) * dt * 3;
    r.wheels.forEach((w) => (w.rotation.x -= spin));
    r.root.visible = run.hurt > 0 ? Math.floor(T * 16) % 2 === 0 : true;
    r.helmet.visible = !!run.power.helmet;
    r.flame.visible = run.power.turbo > 0;
    r.flame.scale.y = 1 + Math.sin(T * 40) * 0.3;
    r.crate.position.y = 1.25 + Math.sin(T * 12) * 0.02 * (run.speed / 10);
    // Camera follows from behind and above, wider in turbo, shaking on crashes.
    shake = Math.max(0, shake - dt);
    const sx = shake ? (Math.random() - 0.5) * shake : 0,
      sy = shake ? (Math.random() - 0.5) * shake : 0;
    camera.position.x += (px * 0.65 - camera.position.x) * Math.min(1, dt * 5);
    camera.position.y = 4.7 + run.y * 0.35 + sy;
    camera.position.z = 7.6;
    camera.position.x += sx;
    const fov = run.power.turbo > 0 ? 72 : 60;
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
    camera.aspect = innerWidth / innerHeight;
    // Narrow phones see more road with a wider view.
    if (camera.aspect < 0.6) camera.fov = Math.max(camera.fov, 66);
    camera.updateProjectionMatrix();
    camera.lookAt(px * 0.8, 0.6, -14);
    renderer.render(scene, camera);
  }

  /* ---- starting, ending and leaving ---- */
  function startScreen() {
    const tier = tierFor(level);
    const s = sideSave(Save.d);
    $("#runTier").innerHTML = `
      <b>${tier.name}</b><small>${tier.desc}</small>
      <div class="tierFacts">
        ${tier.endless ? `<span>Best: <b>${s.run.best}</b> delivered</span>` : `<span>Target <b>${tier.target}</b> deliveries</span><span>Time <b>${tier.time}s</b></span>`}
        <span>Pay up to <b>${fmt(Math.round(tier.pay * 1.25))}</b> a drop</span>
      </div>
      ${canPay(Save.d, "run", today()) ? "" : "<small>Daily pay used up. Ride for fun and records!</small>"}`;
    const gear = s.run.gear;
    $("#runShop").innerHTML = Object.entries(GEAR)
      .map(([id, g]) => {
        const have = g.once ? gear[id] : gear[id] || 0;
        const label = g.once
          ? have
            ? "Owned"
            : fmt(g.price)
          : have
            ? "You have " + have
            : fmt(g.price);
        return `<button class="shopChip${g.once && have ? " on" : ""}" data-gear="${id}"><span>${g.icon}</span><b>${g.name}</b><small>${label}</small></button>`;
      })
      .join("");
    UI.open("ovRunStart");
  }

  function go() {
    UI.close("ovRunStart");
    UI.close("ovRunEnd");
    const tier = tierFor(level);
    const s = sideSave(Save.d);
    const helmet = s.run.gear.helmet > 0;
    if (helmet) s.run.gear.helmet--;
    Save.save();
    dispose();
    buildScene(tier);
    run = createRun(tier, Math.random, { helmet, box: s.run.gear.box });
    countdown = 3;
    paused = false;
    swiped = false;
    startedAt = performance.now();
    for (const k in hudCache) delete hudCache[k];
    message("3", 700);
    Sound.play("tick");
    $("#scrRun").classList.toggle("night", !!tier.night);
    $("#runSwipe").classList.add("show");
  }

  function finish() {
    paused = true;
    $("#runSwipe").classList.remove("show");
    const stars = runStars(run);
    const money = runSettlement(run);
    const res = claimRun(Save.d, run, money, today());
    Save.save();
    UI.coins();
    const t = run.tier;
    const won = t.endless || run.delivered >= t.target;
    // The run goes to the server like a shift; the save follows.
    ctx.report?.({
      mode: "okada",
      level: t.id,
      won,
      served: Math.min(1000, run.delivered),
      lost: Math.min(1000, run.missed + run.crashes),
      sales: Math.max(0, Math.round(money.gross)),
      cash: Math.round(res.net),
      stars,
      duration: Math.min(
        7200,
        Math.round((performance.now() - startedAt) / 1000),
      ),
    });
    $("#runEndTitle").textContent = t.endless
      ? res.record
        ? "New record!"
        : "Night over"
      : won
        ? "Round complete!"
        : run.why === "crashes"
          ? "Too many crashes"
          : "Time up";
    $("#runEndStars").innerHTML = [0, 1, 2]
      .map((i) => `<i class="${i < stars ? "on" : ""}">★</i>`)
      .join("");
    $("#runEndSub").textContent = t.endless
      ? `${run.delivered} delivered · best ${sideSave(Save.d).run.best}`
      : `${run.delivered} of ${t.target} delivered`;
    const rows = [
      ["🥡", "Delivered", run.delivered + (run.hot ? ` (${run.hot} hot)` : "")],
      ["🔥", "Best streak", "x" + run.bestCombo],
      ["💵", "Sales and tips", fmt(money.gross)],
      ["⛽", "Fuel", "−" + fmt(money.fuel)],
    ];
    if (money.spoiled)
      rows.push(["🗑️", "Undelivered food", "−" + fmt(money.spoiled)]);
    rows.push([
      "🏦",
      res.paid ? "Paid to your till" : "Daily pay used up",
      res.paid ? fmt(res.net) : "—",
    ]);
    $("#runEndRows").innerHTML = rows
      .map(
        ([i, a, b]) =>
          `<div class="rewardRow ledger"><span>${i}</span><b>${a}</b><em>${b}</em></div>`,
      )
      .join("");
    Sound.play(won ? "win" : "fail");
    Haptics.play(won ? "win" : "lost");
    setTimeout(() => UI.open("ovRunEnd"), 500);
  }

  function dispose() {
    if (!scene) return;
    owned.geos.forEach((g) => g.dispose());
    owned.mats.forEach((m) => m?.dispose());
    owned.tex.forEach((t) => t.dispose());
    owned.geos.clear();
    owned.mats.clear();
    owned.tex.clear();
    shadowTex = null;
    objs.clear();
    fading.length = 0;
    bits.length = 0;
    scene = null;
    run = null;
  }

  function open() {
    level = Save.d.unlocked - 1 || 1;
    if (level < RUN_UNLOCK) {
      Sound.play("wrong");
      UI.toast(`Okada Rush opens at Level ${RUN_UNLOCK}`);
      return false;
    }
    active = true;
    paused = true;
    UI.show("scrRun");
    // A still street behind the start panel.
    dispose();
    buildScene(tierFor(level));
    run = createRun(tierFor(level), Math.random);
    for (const k in hudCache) delete hudCache[k];
    startScreen();
    return true;
  }
  function close() {
    active = false;
    paused = true;
    ["ovRunStart", "ovRunEnd", "ovRunPause"].forEach((id) => UI.close(id));
    $("#runSwipe").classList.remove("show");
    dispose();
    ctx.onExit();
  }

  /* ---- controls: swipes anywhere on screen, or arrow keys ---- */
  let touch = null;
  const playing = () => active && run && !paused && countdown <= 0 && !run.over;
  function control(a) {
    if (!playing()) return;
    if (!swiped) {
      swiped = true;
      $("#runSwipe").classList.remove("show");
    }
    act(run, a);
    if (a === "left" || a === "right") Sound.play("tap");
  }
  listen(window, "pointerdown", (e) => {
    if (!active || !e.target.closest?.("#scrRun") || e.target.closest("button"))
      return;
    touch = { x: e.clientX, y: e.clientY };
  });
  listen(window, "pointermove", (e) => {
    if (!touch) return;
    const dx = e.clientX - touch.x,
      dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    control(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy < 0
          ? "jump"
          : "slide",
    );
    touch = null;
  });
  listen(window, "pointerup", () => (touch = null));
  listen(window, "keydown", (e) => {
    if (!active) return;
    const k = {
      ArrowLeft: "left",
      a: "left",
      ArrowRight: "right",
      d: "right",
      ArrowUp: "jump",
      w: "jump",
      " ": "jump",
      ArrowDown: "slide",
      s: "slide",
    }[e.key];
    if (k) {
      e.preventDefault();
      control(k);
    }
  });
  on("#runGo", () => go());
  on("#runAgain", () => go());
  on("#runStartClose", () => close());
  on("#runEndMenu", () => close());
  on("#runPause", () => {
    if (!run || run.over) return;
    paused = true;
    UI.open("ovRunPause");
  });
  on("#runResume", () => {
    UI.close("ovRunPause");
    paused = false;
  });
  on("#runQuit", () => {
    UI.close("ovRunPause");
    // Quitting still settles the orders already delivered.
    if (run && !run.over) {
      run.over = true;
      run.why = "quit";
      finish();
    }
  });
  listen(document, "click", (e) => {
    const chip = e.target.closest?.("#runShop [data-gear]");
    if (!chip) return;
    const id = chip.dataset.gear;
    if (buyItem(Save.d, "gear", id)) {
      Sound.play("buy");
      Save.save();
      UI.coins();
      UI.toast(`Bought ${GEAR[id].name}`);
    } else {
      Sound.play("wrong");
      UI.toast(
        GEAR[id].once && sideSave(Save.d).run.gear[id]
          ? "You already own it"
          : `Not enough naira for ${GEAR[id].name}`,
      );
    }
    startScreen();
  });
  listen(document, "visibilitychange", () => {
    if (document.hidden && playing()) {
      paused = true;
      UI.open("ovRunPause");
    }
  });

  return {
    open,
    close,
    update,
    active: () => active,
    debug: () => run,
  };
}
