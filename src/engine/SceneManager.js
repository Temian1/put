import * as T3 from "three";
import { rnd, ri, pick, clamp, lerp, today, fmtTime } from "../game/utils.js";
import {
  FOODS as FOOD_DATA,
  CHAPTERS,
  OUTFITS,
  LINES,
  chapterOf,
  levelCfg,
  dailyCfg as makeDailyCfg,
  endlessCfg,
  UPGRADES,
  DECOR,
} from "../game/data.js";
import { createSave } from "../systems/SaveManager.js";
import { createAudio } from "../systems/AudioManager.js";
import { scoreOrder } from "../game/scoring.js";
import { needsFood, fillOrder, orderComplete } from "../game/OrderSystem.js";
import { Lifetime } from "./Lifetime.js";

// Procedural geometry, scene choreography and timing are retained from the reference.
export function mountGame(canvas, host, bridge) {
  const lifetime = new Lifetime();
  const { requestAnimationFrame, setTimeout, clearTimeout } = lifetime;
  const listen = lifetime.listen.bind(lifetime);
  const $ = (s) => host.querySelector(s);
  const FOODS = Object.fromEntries(
    Object.entries(FOOD_DATA).map(([id, f]) => [id, { ...f }]),
  );
  const Save = createSave();
  Save.load();
  const Sound = createAudio(Save);
  const dailyCfg = () => makeDailyCfg(Save.d.unlocked);
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  listen(document, "pointerdown", () => Sound.init(), { capture: true });
  let cleanupScene = () => {};
  const cleanup = () => {
    lifetime.dispose();
    bridge.dispose();
    cleanupScene();
    if (Sound.ctx && Sound.ctx.state !== "closed")
      Sound.ctx.close().catch(() => {});
    host
      .querySelectorAll("*")
      .forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    if (import.meta.env.DEV) delete window.__mp;
  };
  /* ================= RENDERER / SCENE MANAGER ================= */

  let renderer;
  try {
    renderer = new T3.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (e) {
    $("#bootMsg").textContent =
      "Your browser could not start WebGL. Try another browser to play.";
    return cleanup;
  }
  const HQ = () => Save.d.quality !== "low";
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, HQ() ? 2 : 1.25),
  );
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T3.PCFSoftShadowMap;
  const retired = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
  };
  function retainResources(root) {
    root.traverse((o) => {
      if (o.geometry) retired.geometries.add(o.geometry);
      for (const m of [o.material].flat().filter(Boolean)) {
        retired.materials.add(m);
        for (const v of Object.values(m))
          if (v?.isTexture) retired.textures.add(v);
      }
    });
  }
  const scene = new T3.Scene();
  const camera = new T3.PerspectiveCamera(36, 1, 0.5, 140);
  const hemi = new T3.HemisphereLight(0xfff1d6, 0xc98a5a, 0.85);
  scene.add(hemi);
  const sun = new T3.DirectionalLight(0xfff0d8, 0.95);
  sun.position.set(6, 12, 8);
  sun.castShadow = HQ();
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 1,
    far: 40,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);
  const fillL = new T3.DirectionalLight(0xbfe8ff, 0.3);
  fillL.position.set(-6, 5, -4);
  scene.add(fillL);

  const MC = {};
  function M(color, o) {
    const k = color + (o ? JSON.stringify(o) : "");
    if (!MC[k])
      MC[k] = new T3.MeshStandardMaterial(
        Object.assign({ color, roughness: 0.62, metalness: 0 }, o || {}),
      );
    return MC[k];
  }
  const GC = {};
  function G(key, fn) {
    if (!GC[key]) GC[key] = fn();
    return GC[key];
  }
  function mesh(geo, mat, x, y, z, cast) {
    const m = new T3.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = cast !== false;
    m.receiveShadow = true;
    return m;
  }
  function rrShape(w, h, r) {
    const s = new T3.Shape(),
      x = -w / 2,
      y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function rbox(w, h, d, r) {
    r = r === undefined ? 0.08 : r;
    return G(`rb${w}|${h}|${d}|${r}`, () => {
      const rr = Math.min(r, w / 2 - 0.002, h / 2 - 0.002),
        b = Math.min(r, d / 2 - 0.002);
      const g = new T3.ExtrudeGeometry(rrShape(w, h, Math.max(0.001, rr)), {
        depth: Math.max(0.002, d - 2 * b),
        bevelEnabled: true,
        bevelThickness: b,
        bevelSize: b,
        bevelOffset: -b,
        bevelSegments: 2,
        curveSegments: 5,
      });
      g.translate(0, 0, -Math.max(0.002, d - 2 * b) / 2);
      return g;
    });
  }
  const cyl = (rt, rb, h, s) =>
    G(
      `cy${rt}|${rb}|${h}|${s || 20}`,
      () => new T3.CylinderGeometry(rt, rb, h, s || 20),
    );
  const sph = (r, w, h) =>
    G(
      `sp${r}|${w || 16}|${h || 12}`,
      () => new T3.SphereGeometry(r, w || 16, h || 12),
    );
  const dome = (r) =>
    G(
      "dm" + r,
      () => new T3.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    );
  const box = (w, h, d) =>
    G(`bx${w}|${h}|${d}`, () => new T3.BoxGeometry(w, h, d));
  const tor = (r, t, a, b, arc) =>
    G(
      `to${r}|${t}|${a}|${b}|${arc || 0}`,
      () => new T3.TorusGeometry(r, t, a, b, arc || Math.PI * 2),
    );
  const cone = (r, h, s) =>
    G(`co${r}|${h}|${s}`, () => new T3.ConeGeometry(r, h, s));
  const caps = (r, l) =>
    G(`ca${r}|${l}`, () => new T3.CapsuleGeometry(r, l, 4, 10));
  function roundRectPath(x, X, Y, w, h, r) {
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + w, Y, X + w, Y + h, r);
    x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r);
    x.arcTo(X, Y, X + w, Y, r);
    x.closePath();
  }
  const TEXC = {};
  function canvasTex(key, w, h, draw, rep) {
    if (TEXC[key]) return TEXC[key];
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T3.CanvasTexture(c);
    t.anisotropy = 4;
    if (rep) {
      t.wrapS = t.wrapT = T3.RepeatWrapping;
      t.repeat.set(rep[0], rep[1]);
    }
    TEXC[key] = t;
    return t;
  }

  /* ================= FOOD MODELS ================= */
  const WHITE = () => M("#FFFFFF", { roughness: 0.25 });
  function plate(g, r) {
    r = r || 0.34;
    g.add(mesh(cyl(r, r * 0.78, 0.06, 28), WHITE(), 0, 0.03, 0));
    const rim = mesh(
      tor(r * 0.9, 0.024, 6, 28),
      M("#F1E3CB", { roughness: 0.3 }),
      0,
      0.064,
      0,
    );
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
  }
  function bowl(g, c) {
    g.add(
      mesh(
        cyl(0.3, 0.2, 0.2, 26),
        M(c || "#FFFFFF", { roughness: 0.3 }),
        0,
        0.1,
        0,
      ),
    );
  }
  function sprinkle(g, R, base, h, colors, n, size) {
    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + 0.3,
        rr = Math.sqrt((i + 0.5) / n) * R * 0.8;
      const y = base + h * Math.sqrt(Math.max(0, 1 - (rr / R) * (rr / R)));
      const b = mesh(
        box(size || 0.045, size || 0.045, size || 0.045),
        M(colors[i % colors.length]),
        Math.cos(a) * rr,
        y,
        Math.sin(a) * rr,
        false,
      );
      b.rotation.set(i, i * 2, 0);
      g.add(b);
    }
  }
  function riceDome(g, color, R, bits) {
    R = R || 0.26;
    const d = mesh(dome(R), M(color, { roughness: 0.9 }), 0, 0.06, 0);
    d.scale.y = 0.72;
    g.add(d);
    sprinkle(g, R, 0.06, R * 0.72, bits, 8);
  }
  function drumstick(g, x, z, rot) {
    const p = new T3.Group();
    p.add(mesh(caps(0.075, 0.14), M("#A3501E", { roughness: 0.5 }), 0, 0, 0));
    const bone = mesh(cyl(0.025, 0.025, 0.12, 8), M("#F6EBDD"), 0, -0.15, 0);
    p.add(bone);
    p.add(mesh(sph(0.035, 8, 6), M("#F6EBDD"), 0, -0.22, 0));
    p.rotation.set(Math.PI / 2.4, 0, rot);
    p.position.set(x, 0.16, z);
    g.add(p);
  }
  const FOOD_BUILD = {
    jollof(g) {
      plate(g);
      riceDome(g, "#E8501F", 0.26, ["#5DBB3F", "#FFB347", "#5DBB3F"]);
    },
    friedrice(g) {
      plate(g);
      riceDome(g, "#EDC24A", 0.26, ["#4CAF50", "#FF8A3D", "#F48FB1"]);
    },
    partyjollof(g) {
      plate(g);
      riceDome(g, "#CF3D17", 0.24, ["#5DBB3F", "#FFB347"]);
      drumstick(g, 0.14, 0.1, 0.6);
      const s = mesh(sph(0.09, 10, 8), M("#F09A24"), -0.18, 0.1, 0.12);
      s.scale.set(1, 0.4, 0.6);
      g.add(s);
    },
    plantain(g) {
      plate(g);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const s = mesh(
          sph(0.1, 12, 8),
          M(i % 2 ? "#F39A1E" : "#E8811A", { roughness: 0.45 }),
          Math.cos(a) * 0.17,
          0.1,
          Math.sin(a) * 0.17,
        );
        s.scale.set(1, 0.42, 0.62);
        s.rotation.y = -a;
        g.add(s);
      }
      const c = mesh(
        sph(0.09, 12, 8),
        M("#F6A62A", { roughness: 0.45 }),
        0,
        0.12,
        0,
      );
      c.scale.set(1, 0.42, 0.62);
      g.add(c);
    },
    drink(g) {
      g.add(
        mesh(
          cyl(0.13, 0.13, 0.36, 18),
          M("#9E0F3B", { roughness: 0.15, metalness: 0.1 }),
          0,
          0.18,
          0,
        ),
      );
      g.add(mesh(cyl(0.135, 0.135, 0.13, 18), M("#FFC531"), 0, 0.18, 0));
      g.add(
        mesh(
          cyl(0.05, 0.12, 0.12, 14),
          M("#9E0F3B", { roughness: 0.15 }),
          0,
          0.42,
          0,
        ),
      );
      g.add(
        mesh(
          cyl(0.058, 0.058, 0.05, 14),
          M("#FFFFFF", { roughness: 0.3, metalness: 0.4 }),
          0,
          0.5,
          0,
        ),
      );
      const l = mesh(sph(0.03, 8, 6), M("#2FA34F"), 0, 0.2, 0.13);
      l.scale.set(1.6, 1, 0.4);
      g.add(l);
    },
    puffpuff(g) {
      bowl(g, "#D9A35F");
      [
        [0, 0],
        [0.13, 0.05],
        [-0.12, 0.07],
        [0.04, -0.13],
        [-0.06, 0.13],
        [0.11, -0.1],
      ].forEach(([x, z], i) => {
        g.add(
          mesh(
            sph(0.1, 12, 10),
            M(i % 2 ? "#C9772A" : "#B9661E", { roughness: 0.8 }),
            x,
            0.25 + (i ? 0 : 0.06),
            z,
          ),
        );
      });
      sprinkle(g, 0.18, 0.27, 0.08, ["#FFFFFF"], 6, 0.025);
    },
    amala(g) {
      plate(g);
      const d = mesh(
        sph(0.2, 18, 12),
        M("#5E4636", { roughness: 0.45 }),
        -0.06,
        0.12,
        0,
      );
      d.scale.set(1, 0.7, 1);
      g.add(d);
      g.add(mesh(cyl(0.12, 0.09, 0.09, 16), WHITE(), 0.2, 0.1, 0.12));
      g.add(
        mesh(
          cyl(0.105, 0.105, 0.02, 16),
          M("#3F8B2E", { roughness: 0.7 }),
          0.2,
          0.15,
          0.12,
        ),
      );
      g.add(mesh(sph(0.04, 8, 6), M("#D83A1C"), 0.22, 0.16, 0.1));
    },
    suya(g) {
      const p = mesh(box(0.62, 0.02, 0.42), M("#EDE2C8"), 0, 0.01, 0);
      p.rotation.y = 0.2;
      g.add(p);
      for (let k = 0; k < 2; k++) {
        const s = new T3.Group();
        s.add(mesh(cyl(0.012, 0.012, 0.64, 6), M("#E2C28A"), 0, 0, 0));
        for (let i = 0; i < 4; i++) {
          const c = mesh(
            box(0.1, 0.09, 0.09),
            M(i % 2 ? "#7B3416" : "#8E3E19", { roughness: 0.85 }),
            0,
            -0.2 + i * 0.12,
            0,
          );
          c.rotation.y = i;
          s.add(c);
        }
        s.rotation.z = Math.PI / 2;
        s.rotation.y = 0.2;
        s.position.set(0, 0.08, -0.08 + k * 0.16);
        g.add(s);
      }
      sprinkle(g, 0.25, 0.12, 0.02, ["#C62828", "#E65100"], 8, 0.02);
      const o = mesh(tor(0.05, 0.015, 6, 14), M("#E9D7F2"), 0.22, 0.04, 0.14);
      o.rotation.x = Math.PI / 2;
      g.add(o);
      g.add(mesh(cyl(0.05, 0.05, 0.02, 12), M("#E53935"), -0.22, 0.03, 0.14));
    },
    smallchops(g) {
      plate(g);
      [
        [-0.1, -0.05, 0],
        [0.06, -0.12, 0.4],
      ].forEach(([x, z, r]) => {
        const s = mesh(
          caps(0.04, 0.16),
          M("#E5A33A", { roughness: 0.6 }),
          x,
          0.1,
          z,
        );
        s.rotation.set(0, r, Math.PI / 2);
        g.add(s);
      });
      [
        [0.15, 0.08],
        [-0.15, 0.12],
      ].forEach(([x, z]) => {
        const t = mesh(cone(0.09, 0.12, 3), M("#D9922F"), x, 0.12, z);
        t.rotation.x = Math.PI;
        g.add(t);
      });
      [
        [0.02, 0.14],
        [0.18, -0.08],
      ].forEach(([x, z]) =>
        g.add(mesh(sph(0.06, 10, 8), M("#B9661E"), x, 0.11, z)),
      );
    },
    egusi(g) {
      bowl(g);
      g.add(
        mesh(
          cyl(0.28, 0.28, 0.02, 24),
          M("#D4A72C", { roughness: 0.8 }),
          0,
          0.205,
          0,
        ),
      );
      sprinkle(
        g,
        0.25,
        0.21,
        0.01,
        ["#2E7D32", "#1B5E20", "#E0451C"],
        12,
        0.035,
      );
      const m = mesh(box(0.1, 0.08, 0.09), M("#7A3B1A"), 0.06, 0.24, -0.04);
      m.rotation.y = 0.5;
      g.add(m);
    },
    poundedyam(g) {
      plate(g);
      const a = mesh(
        sph(0.2, 20, 14),
        M("#F7F2E4", { roughness: 0.3 }),
        -0.04,
        0.14,
        0,
      );
      a.scale.set(1, 0.75, 1);
      g.add(a);
      const b = mesh(
        sph(0.11, 16, 12),
        M("#F7F2E4", { roughness: 0.3 }),
        0.17,
        0.1,
        0.1,
      );
      b.scale.set(1, 0.75, 1);
      g.add(b);
    },
  };
  const FOOD_TPL = {};
  function foodModel(id) {
    if (!FOOD_TPL[id]) {
      const g = new T3.Group();
      FOOD_BUILD[id](g);
      FOOD_TPL[id] = g;
    }
    return FOOD_TPL[id].clone();
  }

  /* ================= THUMBNAILS (real 3D renders for buttons and bubbles) ================= */
  function makeThumbs() {
    let r;
    try {
      r = new T3.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch (e) {
      return;
    }
    r.setPixelRatio(1);
    r.setSize(144, 144);
    r.setClearColor(0x000000, 0);
    const s = new T3.Scene();
    s.add(new T3.HemisphereLight(0xffffff, 0xb07040, 1.05));
    const dl = new T3.DirectionalLight(0xffffff, 0.65);
    dl.position.set(2, 4, 3);
    s.add(dl);
    const cam = new T3.PerspectiveCamera(30, 1, 0.05, 20),
      bb = new T3.Box3(),
      ctr = new T3.Vector3(),
      sz = new T3.Vector3(),
      dir = new T3.Vector3(0, 0.85, 1).normalize();
    for (const id in FOODS) {
      const m = foodModel(id);
      s.add(m);
      bb.setFromObject(m);
      bb.getCenter(ctr);
      bb.getSize(sz);
      const dist = Math.max(sz.x, sz.y * 1.1, sz.z) * 2.05;
      cam.position.copy(ctr).addScaledVector(dir, dist);
      cam.lookAt(ctr);
      r.render(s, cam);
      FOODS[id].img = r.domElement.toDataURL("image/png");
      s.remove(m);
    }
    r.dispose();
    if (r.forceContextLoss) r.forceContextLoss();
  }

  /* ================= CHARACTERS ================= */
  const SKINS = [
    "#8D5524",
    "#6F3F1E",
    "#A86B3C",
    "#C68642",
    "#5C3317",
    "#7B4A2A",
  ].map((c) => M(c, { roughness: 0.55 }));
  const ANKARA = [
    ["#FF7A1A", "#12A99F", "#FFC531"],
    ["#2FA34F", "#FFC531", "#FF5A5F"],
    ["#6B2D8C", "#FFC531", "#FF7A1A"],
    ["#E0245E", "#FFF4DE", "#12A99F"],
    ["#1E5AA8", "#FFC531", "#FF7A1A"],
    ["#C2410C", "#FFF4DE", "#2FA34F"],
  ];
  function ankaraTex(p, style) {
    return canvasTex(
      "ank" + p.join() + style,
      128,
      128,
      (x) => {
        x.fillStyle = p[0];
        x.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 4; i++)
          for (let j = 0; j < 4; j++) {
            const cx = i * 32 + 16 + (j % 2 ? 16 : 0),
              cy = j * 32 + 16;
            if (style === 0) {
              x.fillStyle = p[1];
              x.beginPath();
              x.arc(cx % 128, cy, 11, 0, 7);
              x.fill();
              x.fillStyle = p[2];
              x.beginPath();
              x.arc(cx % 128, cy, 5, 0, 7);
              x.fill();
            } else if (style === 1) {
              x.fillStyle = p[1];
              x.beginPath();
              x.moveTo(cx % 128, cy - 12);
              x.lineTo((cx % 128) + 10, cy);
              x.lineTo(cx % 128, cy + 12);
              x.lineTo((cx % 128) - 10, cy);
              x.fill();
              x.fillStyle = p[2];
              x.fillRect((cx % 128) - 3, cy - 3, 6, 6);
            } else {
              x.strokeStyle = p[1];
              x.lineWidth = 5;
              x.beginPath();
              x.arc(cx % 128, cy + 2, 10, Math.PI, 0);
              x.stroke();
              x.fillStyle = p[2];
              x.beginPath();
              x.arc(cx % 128, cy + 6, 4, 0, 7);
              x.fill();
            }
          }
      },
      [2, 1],
    );
  }
  const ANKARA_MATS = [];
  ANKARA.forEach((p, i) =>
    ANKARA_MATS.push(
      new T3.MeshStandardMaterial({
        map: ankaraTex(p, i % 3),
        roughness: 0.75,
      }),
    ),
  );
  const ASO_MATS = [
    new T3.MeshStandardMaterial({
      map: ankaraTex(["#7B2E8E", "#FFC531", "#F6D36B"], 0),
      roughness: 0.5,
      metalness: 0.1,
    }),
    new T3.MeshStandardMaterial({
      map: ankaraTex(["#E3A21A", "#7B2E8E", "#FFF4DE"], 1),
      roughness: 0.45,
      metalness: 0.15,
    }),
  ];
  const TEE = [
    "#12A99F",
    "#FF5A5F",
    "#1E5AA8",
    "#2FA34F",
    "#FFC531",
    "#F4F4F4",
  ];
  let GEO = null;
  function initGeo() {
    GEO = {
      body: new T3.CapsuleGeometry(0.4, 0.5, 6, 16),
      belt: cyl(0.415, 0.415, 0.12, 22),
      head: sph(0.36, 24, 18),
      eyeW: sph(0.085, 14, 10),
      pupil: sph(0.05, 10, 8),
      hl: sph(0.02, 6, 6),
      smile: tor(0.09, 0.025, 6, 14, Math.PI),
      mouthO: tor(0.05, 0.022, 6, 14),
      brow: box(0.13, 0.03, 0.03),
      arm: caps(0.1, 0.36),
      hand: sph(0.11, 12, 10),
      foot: sph(0.14, 12, 8),
      cheek: sph(0.065, 10, 8),
      nose: sph(0.045, 10, 8),
      ear: sph(0.07, 10, 8),
      afro: G(
        "afro",
        () =>
          new T3.SphereGeometry(
            0.41,
            18,
            12,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.55,
          ),
      ),
      fila: cyl(0.27, 0.34, 0.26, 16),
      geleRing: tor(0.27, 0.11, 10, 22),
      geleFan: cone(0.34, 0.5, 7),
      bun: sph(0.17, 12, 10),
      glasses: box(0.38, 0.1, 0.04),
      chain: tor(0.3, 0.03, 8, 24),
      apron: rbox(0.6, 0.62, 0.06, 0.05),
      ring: tor(0.62, 0.06, 8, 36),
      chefHat: cyl(0.3, 0.24, 0.3, 18),
    };
  }
  const MAT_EYE = M("#FFFFFF", { roughness: 0.2 }),
    MAT_PUP = M("#1A0F0A", { roughness: 0.15 }),
    MAT_HL = new T3.MeshBasicMaterial({ color: 0xffffff }),
    MAT_MOUTH = M("#5A1A10"),
    MAT_BROW = M("#2A1408"),
    MAT_CHEEK = new T3.MeshStandardMaterial({
      color: 0xff7f7f,
      transparent: true,
      opacity: 0.4,
      roughness: 1,
    }),
    MAT_HAIR = M("#24140C", { roughness: 0.95 }),
    MAT_SHOE = M("#3B2416");
  function makePerson(o) {
    const root = new T3.Group(),
      inner = new T3.Group();
    root.add(inner);
    inner.scale.setScalar(o.scale || 1);
    const skin = o.skin,
      bm = o.bodyMat,
      acc = M(
        o.accent,
        o.accent === "#FFC531"
          ? { metalness: 0.35, roughness: 0.35 }
          : undefined,
      );
    const body = mesh(GEO.body, bm, 0, 0.76, 0);
    inner.add(body);
    inner.add(mesh(GEO.belt, acc, 0, 0.86, 0));
    [-0.17, 0.17].forEach((x) => {
      const f = mesh(GEO.foot, MAT_SHOE, x, 0.07, 0.1);
      f.scale.set(0.9, 0.55, 1.3);
      inner.add(f);
    });
    const mkArm = (side) => {
      const p = new T3.Group();
      p.position.set(side * 0.42, 1.22, 0);
      p.rotation.z = side * 0.25;
      p.add(mesh(GEO.arm, bm, 0, -0.24, 0));
      p.add(mesh(GEO.hand, skin, 0, -0.5, 0));
      inner.add(p);
      return p;
    };
    const armL = mkArm(-1),
      armR = mkArm(1);
    const head = new T3.Group();
    head.position.y = 1.74;
    inner.add(head);
    head.add(mesh(GEO.head, skin));
    [-1, 1].forEach((s) => {
      head.add(mesh(GEO.ear, skin, s * 0.35, 0, 0));
    });
    const nose = mesh(GEO.nose, skin, 0, -0.03, 0.355);
    head.add(nose);
    const eyes = [];
    [-1, 1].forEach((s) => {
      const e = new T3.Group();
      e.position.set(s * 0.13, 0.06, 0.3);
      const w = mesh(GEO.eyeW, MAT_EYE, 0, 0, 0, false);
      w.scale.set(1, 1.1, 0.6);
      e.add(w);
      e.add(mesh(GEO.pupil, MAT_PUP, 0, -0.005, 0.04, false));
      e.add(mesh(GEO.hl, MAT_HL, 0.018, 0.022, 0.08, false));
      head.add(e);
      eyes.push(e);
    });
    const brows = [-1, 1].map((s) => {
      const b = mesh(GEO.brow, MAT_BROW, s * 0.13, 0.18, 0.31, false);
      head.add(b);
      return b;
    });
    [-1, 1].forEach((s) =>
      head.add(mesh(GEO.cheek, MAT_CHEEK, s * 0.22, -0.08, 0.27, false)),
    );
    const smile = mesh(GEO.smile, MAT_MOUTH, 0, -0.11, 0.325, false);
    smile.rotation.z = Math.PI;
    head.add(smile);
    const frown = mesh(GEO.smile, MAT_MOUTH, 0, -0.2, 0.32, false);
    head.add(frown);
    frown.visible = false;
    const mouthO = mesh(GEO.mouthO, MAT_MOUTH, 0, -0.15, 0.33, false);
    head.add(mouthO);
    mouthO.visible = false;
    const hat = o.hat;
    if (hat === "gele") {
      const g = new T3.Group();
      g.position.set(0, 0.24, -0.04);
      g.rotation.x = -0.25;
      const a = mesh(GEO.geleRing, acc);
      a.rotation.x = Math.PI / 2;
      a.scale.set(1.05, 1.05, 1.3);
      g.add(a);
      const b = mesh(GEO.geleRing, bm);
      b.rotation.x = Math.PI / 2.3;
      b.position.set(0, 0.13, -0.03);
      b.scale.set(0.85, 0.85, 1.2);
      g.add(b);
      const f = mesh(GEO.geleFan, acc, 0, 0.27, -0.12);
      f.rotation.x = -0.5;
      f.scale.set(1, 1, 0.35);
      g.add(f);
      head.add(g);
    } else if (hat === "fila" || hat === "chief") {
      const f = mesh(
        GEO.fila,
        hat === "chief" ? M("#B71C1C", { roughness: 0.5 }) : acc,
        0.04,
        0.28,
        -0.02,
      );
      f.rotation.z = -0.3;
      head.add(f);
    } else if (hat === "afro") {
      const a = mesh(GEO.afro, MAT_HAIR, 0, 0.04, -0.04);
      a.rotation.x = -0.55;
      head.add(a);
    } else if (hat === "bun") {
      const a = mesh(GEO.afro, MAT_HAIR, 0, 0.02, -0.03);
      a.rotation.x = -0.6;
      a.scale.setScalar(0.95);
      head.add(a);
      head.add(mesh(GEO.bun, MAT_HAIR, 0, 0.38, -0.12));
    } else if (hat === "chef") {
      const g = new T3.Group();
      g.position.set(0, 0.2, -0.02);
      g.rotation.x = -0.2;
      const a = mesh(GEO.geleRing, acc);
      a.rotation.x = Math.PI / 2;
      a.scale.set(1.08, 1.08, 0.9);
      g.add(a);
      const top = mesh(sph(0.3, 16, 12), bm, 0, 0.1, -0.02);
      top.scale.set(1, 0.6, 1);
      g.add(top);
      [-1, 1].forEach((s) => {
        const k = mesh(sph(0.1, 10, 8), acc, s * 0.09, 0.2, 0.25);
        k.scale.set(1, 0.7, 0.7);
        g.add(k);
      });
      head.add(g);
      const ap = mesh(
        GEO.apron,
        M("#FFFFFF", { roughness: 0.5 }),
        0,
        0.78,
        0.37,
      );
      ap.rotation.x = -0.08;
      inner.add(ap);
    }
    if (o.vip) {
      const gl = mesh(
        GEO.glasses,
        M("#111111", { roughness: 0.1, metalness: 0.5 }),
        0,
        0.06,
        0.37,
        false,
      );
      head.add(gl);
      const ch = mesh(
        GEO.chain,
        M("#FFC531", { metalness: 0.8, roughness: 0.25 }),
        0,
        1.42,
        0.05,
      );
      ch.rotation.x = Math.PI / 2.2;
      inner.add(ch);
    }
    return {
      root,
      inner,
      body,
      head,
      armL,
      armR,
      smile,
      frown,
      mouthO,
      brows,
      eyes,
    };
  }
  function setFace(P, mode) {
    P.smile.visible = mode === "happy" || mode === "neutral";
    P.frown.visible = mode === "angry" || mode === "sad";
    P.mouthO.visible = mode === "wow";
    P.smile.scale.set(
      mode === "happy" ? 1.45 : 1,
      mode === "happy" ? 1.5 : 0.75,
      1,
    );
    const r = {
      neutral: [0, 0],
      happy: [0.15, -0.15],
      angry: [-0.5, 0.5],
      sad: [0.4, -0.4],
      wow: [0.2, -0.2],
    }[mode] || [0, 0];
    P.brows[0].rotation.z = r[0];
    P.brows[1].rotation.z = r[1];
    P.brows.forEach(
      (b) => (b.position.y = mode === "happy" || mode === "wow" ? 0.21 : 0.18),
    );
  }

  /* ================= KITCHEN SCENE / ENVIRONMENTS ================= */
  const THEMES = [
    {
      sky: ["#FFE2A8", "#FFB45E"],
      ground: "#E39A5B",
      floor: ["#F7E3C3", "#EBC896"],
      counter: "#B86B35",
      top: "#FFE9C7",
      trim: "#12A99F",
      tray: "#FF5A5F",
      bench: "#8B4F2A",
      sign: ["MAMA PUT", "Roadside Buka"],
      signBg: "#12A99F",
      light: [0.85, 0.95],
    },
    {
      sky: ["#BFE6FF", "#FFD7A0"],
      ground: "#C98B5A",
      floor: ["#FFF1D6", "#9FD6CF"],
      counter: "#12A99F",
      top: "#FFF4DE",
      trim: "#FF7A1A",
      tray: "#FFC531",
      bench: "#5E6B73",
      sign: ["JUNCTION SPOT", "Mama Put • Chop Better"],
      signBg: "#FF7A1A",
      light: [0.85, 0.95],
    },
    {
      sky: ["#9FDBFF", "#FFE0B0"],
      ground: "#D9CBB3",
      floor: ["#FFFFFF", "#FFD9B0"],
      counter: "#FF5A5F",
      top: "#FFF4DE",
      trim: "#FFC531",
      tray: "#12A99F",
      bench: "#4E4A57",
      sign: ["LAGOS FOOD COURT", "Mama Put Stall 12"],
      signBg: "#FF5A5F",
      light: [0.85, 0.95],
    },
    {
      sky: ["#FFD0DD", "#FFE7B8"],
      ground: "#7CC36B",
      floor: ["#FFF4DE", "#F3D9A4"],
      counter: "#6B2D8C",
      top: "#FFF4DE",
      trim: "#FFC531",
      tray: "#FFC531",
      bench: "#4B2A5E",
      sign: ["OWAMBE CATERING", "Mama Put • Party Jollof Specialist"],
      signBg: "#7B2E8E",
      light: [0.85, 0.95],
    },
    {
      sky: ["#3B2E6E", "#FF9E6B"],
      ground: "#3C4B5A",
      floor: ["#F4EFE6", "#D9D2C5"],
      counter: "#0F4C5C",
      top: "#F4EFE6",
      trim: "#FFC531",
      tray: "#FFC531",
      bench: "#1F2A36",
      sign: ["MAMA PUT EMPIRE", "From Roadside Buka to Food Empire"],
      signBg: "#0F4C5C",
      light: [0.7, 0.8],
    },
  ];
  let env = null,
    envKey = "";
  const world = new T3.Group();
  scene.add(world);
  const dyn = []; // ambient animated things in env
  function signTexture(t) {
    return canvasTex("sign" + t.sign.join(), 1024, 300, (x) => {
      x.fillStyle = t.signBg;
      roundRectPath(x, 8, 8, 1008, 284, 48);
      x.fill();
      x.fillStyle = "rgba(255,255,255,.2)";
      for (let i = 0; i < 24; i++) {
        x.beginPath();
        x.arc(40 + i * 41, 34, 9, 0, 7);
        x.fill();
        x.beginPath();
        x.arc(40 + i * 41, 266, 9, 0, 7);
        x.fill();
      }
      x.textAlign = "center";
      x.textBaseline = "middle";
      const fs = t.sign[0].length > 12 ? 100 : 126;
      x.font = fs + 'px "Lilita One", Impact, sans-serif';
      x.lineJoin = "round";
      x.lineWidth = 20;
      x.strokeStyle = "#4A1F0C";
      x.strokeText(t.sign[0], 512, 135);
      x.fillStyle = "#FFC531";
      x.fillText(t.sign[0], 512, 135);
      x.font = '800 46px "Baloo 2", sans-serif';
      x.fillStyle = "#FFF4DE";
      x.fillText(t.sign[1], 512, 226);
    });
  }
  function floorTex(t, i) {
    return canvasTex(
      "floor" + i,
      256,
      256,
      (x) => {
        const n = i === 4 ? 2 : 4,
          s = 256 / n;
        for (let a = 0; a < n; a++)
          for (let b = 0; b < n; b++) {
            x.fillStyle = (a + b) % 2 ? t.floor[0] : t.floor[1];
            x.fillRect(a * s, b * s, s, s);
          }
        if (i === 4) {
          x.strokeStyle = "rgba(150,140,125,.35)";
          x.lineWidth = 2;
          for (let k = 0; k < 8; k++) {
            x.beginPath();
            x.moveTo(Math.random() * 256, 0);
            x.bezierCurveTo(
              Math.random() * 256,
              80,
              Math.random() * 256,
              170,
              Math.random() * 256,
              256,
            );
            x.stroke();
          }
        }
        x.strokeStyle = "rgba(0,0,0,.06)";
        x.lineWidth = 3;
        for (let k = 0; k <= n; k++) {
          x.beginPath();
          x.moveTo(k * s, 0);
          x.lineTo(k * s, 256);
          x.stroke();
          x.beginPath();
          x.moveTo(0, k * s);
          x.lineTo(256, k * s);
          x.stroke();
        }
      },
      [4, 2],
    );
  }
  function skyTex(t, i) {
    return canvasTex("sky" + i, 4, 256, (x) => {
      const g = x.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, t.sky[0]);
      g.addColorStop(1, t.sky[1]);
      x.fillStyle = g;
      x.fillRect(0, 0, 4, 256);
    });
  }
  function zincTex() {
    return canvasTex(
      "zinc",
      128,
      64,
      (x) => {
        for (let i = 0; i < 16; i++) {
          x.fillStyle = i % 2 ? "#9FB3BF" : "#C5D3DB";
          x.fillRect(i * 8, 0, 8, 64);
        }
        x.fillStyle = "rgba(176,92,40,.35)";
        for (let i = 0; i < 14; i++) {
          x.beginPath();
          x.arc(
            Math.random() * 128,
            40 + Math.random() * 24,
            4 + Math.random() * 7,
            0,
            7,
          );
          x.fill();
        }
      },
      [3, 1],
    );
  }

  function palm(g, x, z, h) {
    const t = new T3.Group();
    t.position.set(x, 0, z);
    let y = 0;
    for (let i = 0; i < 6; i++) {
      const s = mesh(
        cyl(0.13 - i * 0.008, 0.16 - i * 0.008, h / 6, 8),
        M(i % 2 ? "#8B5A2B" : "#7A4C22"),
        Math.sin(i * 0.5) * 0.12,
        y + h / 12,
        0,
      );
      t.add(s);
      y += h / 6;
    }
    for (let i = 0; i < 8; i++) {
      const l = new T3.Group();
      l.position.set(0.3, y, 0);
      l.rotation.y = (i / 8) * Math.PI * 2;
      const lf = mesh(
        rbox(0.36, 0.05, 1.7, 0.02),
        M(i % 2 ? "#2E9E4F" : "#258A43"),
        0,
        0,
        0.8,
      );
      lf.rotation.x = 0.45;
      l.add(lf);
      t.add(l);
    }
    [
      [0.12, 0.1],
      [-0.1, 0.12],
      [0, -0.12],
    ].forEach(([a, b]) =>
      t.add(mesh(sph(0.12, 8, 6), M("#5D4021"), 0.3 + a, y - 0.15, b)),
    );
    g.add(t);
  }
  function parasol(g, x, z, c1, c2) {
    const p = new T3.Group();
    p.position.set(x, 0, z);
    p.add(mesh(cyl(0.04, 0.04, 2.4, 8), M("#EEEEEE"), 0, 1.2, 0));
    for (let i = 0; i < 8; i++) {
      const s = mesh(
        G(
          "para",
          () => new T3.ConeGeometry(1.25, 0.5, 8, 1, true, 0, Math.PI / 4),
        ),
        M(i % 2 ? c1 : c2, { side: T3.DoubleSide }),
        0,
        2.4,
        0,
      );
      s.rotation.y = (i * Math.PI) / 4;
      p.add(s);
    }
    p.add(mesh(sph(0.08, 8, 6), M("#FFFFFF"), 0, 2.66, 0));
    p.add(mesh(cyl(0.45, 0.45, 0.05, 20), M("#F4F4F4"), 0, 0.78, 0));
    p.add(mesh(cyl(0.05, 0.05, 0.78, 8), M("#DDDDDD"), 0, 0.39, 0));
    g.add(p);
    [-0.75, 0.75].forEach((dx) => {
      const c = chair(c1);
      c.position.set(dx, 0, 0.2);
      c.rotation.y = dx > 0 ? -1.2 : 1.2;
      p.add(c);
    });
  }
  function chair(c) {
    const g = new T3.Group();
    g.add(mesh(rbox(0.45, 0.06, 0.45, 0.03), M(c), 0, 0.45, 0));
    g.add(mesh(rbox(0.45, 0.5, 0.06, 0.03), M(c), 0, 0.72, -0.2));
    [
      [-0.18, -0.18],
      [0.18, -0.18],
      [-0.18, 0.18],
      [0.18, 0.18],
    ].forEach(([x, z]) =>
      g.add(mesh(cyl(0.025, 0.025, 0.45, 6), M(c), x, 0.22, z)),
    );
    return g;
  }
  function building(g, x, z, w, h, d, c, win, roof) {
    const b = new T3.Group();
    b.position.set(x, 0, z);
    b.add(mesh(rbox(w, h, d, 0.06), M(c), 0, h / 2, 0));
    const cols = Math.max(1, Math.floor(w / 0.9)),
      rows = Math.max(1, Math.floor((h - 1) / 1.1));
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        b.add(
          mesh(
            rbox(0.5, 0.6, 0.06, 0.04),
            M(win || "#7FC8E8", { roughness: 0.2 }),
            -w / 2 + ((i + 0.5) * w) / cols,
            1.3 + j * 1.1,
            d / 2 + 0.02,
            false,
          ),
        );
      }
    if (roof)
      b.add(mesh(rbox(w + 0.3, 0.18, d + 0.3, 0.05), M(roof), 0, h + 0.05, 0));
    g.add(b);
    return b;
  }
  function keke(g) {
    const k = new T3.Group();
    k.add(mesh(rbox(1.5, 0.9, 1, 0.2), M("#FFC531"), 0, 0.75, 0));
    k.add(mesh(rbox(1.6, 0.08, 1.1, 0.03), M("#2FA34F"), 0, 1.25, 0));
    k.add(mesh(rbox(1.5, 0.1, 1.05, 0.04), M("#2FA34F"), 0, 0.36, 0));
    k.add(
      mesh(
        rbox(0.06, 0.5, 0.9, 0.02),
        M("#222222", { roughness: 0.2 }),
        0.7,
        0.95,
        0,
      ),
    );
    [
      [-0.5, -0.5],
      [-0.5, 0.5],
      [0.65, 0],
    ].forEach(([x, z]) => {
      const w = mesh(tor(0.17, 0.08, 8, 14), M("#1E1E1E"), x, 0.22, z);
      k.add(w);
    });
    g.add(k);
    return k;
  }
  function danfo(g) {
    const k = new T3.Group();
    k.add(mesh(rbox(3.2, 1.3, 1.4, 0.22), M("#FFC531"), 0, 1.05, 0));
    [0.6, 1.2].forEach((y) =>
      k.add(mesh(rbox(3.22, 0.08, 1.42, 0.03), M("#1E1E1E"), 0, y, 0)),
    );
    for (let i = 0; i < 4; i++)
      k.add(
        mesh(
          rbox(0.55, 0.4, 1.44, 0.05),
          M("#2A3A44", { roughness: 0.15 }),
          -1.1 + i * 0.72,
          1.38,
          0,
        ),
      );
    [
      [-1, -0.65],
      [-1, 0.65],
      [1, -0.65],
      [1, 0.65],
    ].forEach(([x, z]) => {
      const w = mesh(tor(0.2, 0.1, 8, 14), M("#1E1E1E"), x, 0.3, z);
      k.add(w);
    });
    g.add(k);
    return k;
  }
  function stringLights(g, x1, x2, y, z, sag, colors) {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = lerp(x1, x2, t),
        yy = y - Math.sin(t * Math.PI) * sag;
      g.add(
        mesh(
          sph(0.07, 8, 6),
          new T3.MeshStandardMaterial({
            color: colors[i % colors.length],
            emissive: colors[i % colors.length],
            emissiveIntensity: 0.9,
          }),
          x,
          yy,
          z,
          false,
        ),
      );
    }
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(
        new T3.Vector3(
          lerp(x1, x2, t),
          y - Math.sin(t * Math.PI) * sag + 0.06,
          z,
        ),
      );
    }
    g.add(
      new T3.Line(
        new T3.BufferGeometry().setFromPoints(pts),
        new T3.LineBasicMaterial({ color: 0x333333 }),
      ),
    );
  }
  function bunting(g, x1, x2, y, z, sag) {
    const n = 12;
    const cols = ["#FF7A1A", "#12A99F", "#FFC531", "#FF5A5F", "#2FA34F"];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        x = lerp(x1, x2, t),
        yy = y - Math.sin(t * Math.PI) * sag;
      const f = mesh(
        G("flag", () => {
          const s = new T3.Shape();
          s.moveTo(-0.18, 0);
          s.lineTo(0.18, 0);
          s.lineTo(0, -0.38);
          s.closePath();
          return new T3.ShapeGeometry(s);
        }),
        M(cols[i % 5], { side: T3.DoubleSide }),
        x,
        yy,
        z,
        false,
      );
      g.add(f);
      dyn.push({ o: f, type: "flag", ph: i });
    }
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(
        new T3.Vector3(lerp(x1, x2, t), y - Math.sin(t * Math.PI) * sag, z),
      );
    }
    g.add(
      new T3.Line(
        new T3.BufferGeometry().setFromPoints(pts),
        new T3.LineBasicMaterial({ color: 0x4a1f0c }),
      ),
    );
  }
  function balloon(g, x, y, z, c) {
    const b = mesh(
      sph(0.28, 14, 12),
      M(c, { roughness: 0.25, metalness: 0.1 }),
      x,
      y,
      z,
    );
    b.scale.y = 1.2;
    g.add(b);
    g.add(mesh(cyl(0.006, 0.006, 1.2, 4), M("#FFFFFF"), x, y - 0.9, z, false));
    dyn.push({ o: b, type: "bob", ph: Math.random() * 6, y });
  }
  function plant(g, x, z, s) {
    const p = new T3.Group();
    p.position.set(x, 0, z);
    p.scale.setScalar(s || 1);
    p.add(mesh(cyl(0.26, 0.2, 0.45, 14), M("#C8642E"), 0, 0.22, 0));
    [
      [0, 0.75, 0, 0.32],
      [0.18, 0.6, 0.08, 0.24],
      [-0.16, 0.62, -0.06, 0.25],
      [0.02, 0.55, -0.18, 0.22],
    ].forEach(([a, b, c, r]) =>
      p.add(mesh(sph(r, 10, 8), M("#2E9E4F", { roughness: 0.8 }), a, b, c)),
    );
    g.add(p);
  }
  function roundTable(g, x, z, cloth) {
    const t = new T3.Group();
    t.position.set(x, 0, z);
    t.add(
      mesh(cyl(0.7, 0.75, 0.78, 20), M(cloth, { roughness: 0.5 }), 0, 0.39, 0),
    );
    t.add(mesh(cyl(0.72, 0.72, 0.04, 20), M("#FFFFFF"), 0, 0.8, 0));
    t.add(
      mesh(
        cyl(0.06, 0.08, 0.3, 8),
        M("#E3A21A", { metalness: 0.6, roughness: 0.3 }),
        0,
        0.97,
        0,
      ),
    );
    t.add(mesh(sph(0.14, 10, 8), M("#FF5A9A"), 0, 1.15, 0));
    for (let i = 0; i < 4; i++) {
      const c = chair("#E3A21A");
      const a = (i / 4) * Math.PI * 2 + 0.4;
      c.position.set(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05);
      c.rotation.y = -a - Math.PI / 2;
      t.add(c);
    }
    g.add(t);
  }
  function lamp(g, x, z, c) {
    g.add(
      mesh(
        cyl(0.06, 0.08, 3.2, 8),
        M("#3B3F46", { metalness: 0.5, roughness: 0.4 }),
        x,
        1.6,
        z,
      ),
    );
    g.add(mesh(rbox(0.5, 0.15, 0.3, 0.05), M("#3B3F46"), x + 0.2, 3.2, z));
    g.add(
      mesh(
        sph(0.12, 8, 6),
        new T3.MeshStandardMaterial({
          color: c || "#FFE9A8",
          emissive: c || "#FFD36B",
          emissiveIntensity: 1,
        }),
        x + 0.3,
        3.1,
        z,
        false,
      ),
    );
  }

  function buildEnv(ci) {
    const decorKey = ci + "|" + Save.d.decor.slice().sort().join();
    if (env && envKey === decorKey) return;
    envKey = decorKey;
    if (env) {
      retainResources(env);
      scene.remove(env);
    }
    dyn.length = 0;
    env = new T3.Group();
    scene.add(env);
    const t = THEMES[ci];
    scene.background = skyTex(t, ci);
    scene.fog = new T3.Fog(new T3.Color(t.sky[1]), 34, 70);
    hemi.intensity = t.light[0];
    sun.intensity = t.light[1];
    sun.color.set(ci === 4 ? "#FFC59A" : "#FFF0D8");
    const ground = mesh(
      G("ground", () => new T3.PlaneGeometry(120, 120)),
      M(t.ground, { roughness: 1 }),
      0,
      0,
      0,
      false,
    );
    ground.rotation.x = -Math.PI / 2;
    env.add(ground);
    // kitchen floor
    const kf = new T3.Mesh(
      G("kfloor", () => new T3.PlaneGeometry(8.4, 3.4)),
      new T3.MeshStandardMaterial({ map: floorTex(t, ci), roughness: 0.6 }),
    );
    kf.rotation.x = -Math.PI / 2;
    kf.position.set(0, 0.012, 1.7);
    kf.receiveShadow = true;
    env.add(kf);
    // customer pavement
    const pv = mesh(
      rbox(9.6, 0.08, 1.8, 0.04),
      M(ci === 3 ? "#EEDDB6" : ci === 4 ? "#D8CCB8" : "#E8D3B0", {
        roughness: 0.9,
      }),
      0,
      0.04,
      -0.85,
      false,
    );
    env.add(pv);
    // counter
    env.add(mesh(rbox(7, 0.95, 0.9, 0.1), M(t.counter), 0, 0.5, 0.55));
    env.add(
      mesh(
        rbox(7.4, 0.12, 1.06, 0.06),
        M(t.top, { roughness: 0.4 }),
        0,
        1.0,
        0.55,
      ),
    );
    env.add(mesh(rbox(7.42, 0.07, 0.08, 0.03), M(t.trim), 0, 1.04, 0.04));
    env.add(mesh(rbox(7.42, 0.07, 0.08, 0.03), M(t.trim), 0, 1.04, 1.06));
    for (let i = 0; i < 7; i++)
      env.add(
        mesh(
          rbox(0.7, 0.5, 0.04, 0.05),
          M(i % 2 ? t.trim : "#FFC531"),
          -3 + i,
          0.55,
          1.02,
          false,
        ),
      );
    // bench (stations sit on it)
    env.add(mesh(rbox(7.4, 0.78, 1.05, 0.1), M(t.bench), 0, 0.4, 2.3));
    env.add(
      mesh(
        rbox(7.6, 0.08, 1.15, 0.04),
        M(ci === 4 ? "#F4EFE6" : "#D9A066", { roughness: 0.5 }),
        0,
        0.82,
        2.3,
      ),
    );
    // backdrop per theme
    if (ci === 0) {
      const wall = new T3.Mesh(
        G("zw", () => new T3.PlaneGeometry(16, 3.4)),
        new T3.MeshStandardMaterial({
          map: zincTex(),
          roughness: 0.5,
          metalness: 0.3,
        }),
      );
      wall.position.set(0, 1.7, -4.4);
      env.add(wall);
      env.add(
        mesh(
          rbox(16.4, 0.2, 1.6, 0.05),
          M("#8FA3AF", { metalness: 0.4, roughness: 0.4 }),
          0,
          3.45,
          -3.8,
        ),
      );
      palm(env, -6.2, -3, 4.6);
      palm(env, 6.5, -3.4, 5.2);
      palm(env, -9, -6, 5);
      parasol(env, 5.2, -2.6, "#FF5A5F", "#FFFFFF");
      parasol(env, -5.4, -2.6, "#12A99F", "#FFC531");
      for (let i = 0; i < 3; i++) {
        const c = chair("#E53935");
        c.position.set(-7.5 + i * 0.6, 0, -1.2);
        env.add(c);
      }
    } else if (ci === 1) {
      const road = mesh(
        G("road", () => new T3.PlaneGeometry(60, 3.2)),
        M("#4A4E57", { roughness: 0.95 }),
        0,
        0.02,
        -4,
        false,
      );
      road.rotation.x = -Math.PI / 2;
      env.add(road);
      for (let i = 0; i < 14; i++) {
        const d = mesh(
          box(1, 0.01, 0.14),
          M("#FFD54F"),
          -26 + i * 4,
          0.03,
          -4,
          false,
        );
        env.add(d);
      }
      [
        ["#FF7A1A", -5.6],
        ["#12A99F", -1.8],
        ["#FFC531", 2],
        ["#FF5A5F", 5.8],
      ].forEach(([c, x], i) =>
        building(
          env,
          x,
          -7.2,
          3.6,
          4 + (i % 2) * 1.2,
          2,
          c,
          "#BFE6FF",
          "#4A1F0C",
        ),
      );
      lamp(env, -4.4, -2.3);
      lamp(env, 4.4, -2.3);
      palm(env, -7.6, -2.8, 4.4);
      parasol(env, 6.4, -2.2, "#FFC531", "#12A99F");
      const k = keke(env);
      dyn.push({ o: k, type: "drive", z: -4.6, speed: 3.2, x: -14 });
    } else if (ci === 2) {
      const road = mesh(
        G("road2", () => new T3.PlaneGeometry(60, 3.2)),
        M("#4A4E57", { roughness: 0.95 }),
        0,
        0.02,
        -8.6,
        false,
      );
      road.rotation.x = -Math.PI / 2;
      env.add(road);
      [
        ["#12A99F", -5.2],
        ["#FFC531", -1.8],
        ["#2FA34F", 1.8],
        ["#FF7A1A", 5.2],
      ].forEach(([c, x]) => {
        const s = new T3.Group();
        s.position.set(x, 0, -5.4);
        s.add(mesh(rbox(3, 2.2, 1.6, 0.08), M("#FFF4DE"), 0, 1.1, 0));
        s.add(mesh(rbox(3.3, 0.3, 0.9, 0.06), M(c), 0, 2.35, 0.85));
        s.add(
          mesh(
            rbox(2.6, 0.9, 0.08, 0.04),
            M("#3B2A20", { roughness: 0.3 }),
            0,
            1.3,
            0.82,
            false,
          ),
        );
        env.add(s);
      });
      stringLights(env, -6, 6, 3.6, -3.6, 0.6, [
        "#FFC531",
        "#FF5A5F",
        "#12A99F",
        "#FFFFFF",
      ]);
      parasol(env, -6.6, -2.4, "#FF5A5F", "#FFF4DE");
      parasol(env, 6.6, -2.4, "#12A99F", "#FFF4DE");
      plant(env, -4, -3.2);
      plant(env, 4, -3.2);
      const d = danfo(env);
      dyn.push({ o: d, type: "drive", z: -8.6, speed: 4, x: 16, dir: -1 });
    } else if (ci === 3) {
      const tent = new T3.Group();
      tent.position.set(0, 0, -5);
      [-6, -2, 2, 6].forEach((x) => {
        tent.add(mesh(cyl(0.08, 0.08, 4, 8), M("#FFFFFF"), x, 2, -0.8));
      });
      for (let i = 0; i < 6; i++) {
        const d = mesh(
          rbox(2.2, 0.35, 3, 0.15),
          M(i % 2 ? "#FFFFFF" : "#FFC531", { roughness: 0.4 }),
          -5.5 + i * 2.2,
          4.1,
          -0.8,
        );
        d.rotation.x = 0.12;
        tent.add(d);
      }
      for (let i = 0; i < 5; i++) {
        const dr = mesh(
          rbox(0.9, 2.6, 0.05, 0.04),
          M(i % 2 ? "#7B2E8E" : "#FFC531", { roughness: 0.4 }),
          -6 + i * 3,
          2.6,
          -2.2,
          false,
        );
        tent.add(dr);
      }
      env.add(tent);
      roundTable(env, -4.6, -3.6, "#7B2E8E");
      roundTable(env, 4.6, -3.6, "#7B2E8E");
      roundTable(env, 0, -6.2, "#FFC531");
      [
        [-6.4, 2.4, -2.2, "#FFC531"],
        [-6, 2.1, -1.6, "#7B2E8E"],
        [6.4, 2.4, -2.2, "#FFC531"],
        [6, 2.1, -1.6, "#FF5A9A"],
        [-6.8, 2.6, -1.2, "#FFFFFF"],
        [6.8, 2.6, -1.2, "#7B2E8E"],
      ].forEach((b) => balloon(env, ...b));
      stringLights(env, -6, 6, 3.8, -2.6, 0.5, ["#FFFFFF", "#FFE9A8"]);
    } else {
      const fac = new T3.Group();
      fac.position.set(0, 0, -5.6);
      fac.add(mesh(rbox(16, 5, 1, 0.1), M("#173B49"), 0, 2.5, 0));
      for (let i = 0; i < 7; i++) {
        fac.add(
          mesh(
            rbox(1.3, 2.4, 0.08, 0.08),
            M("#FFD58A", { emissive: "#FFB347", emissiveIntensity: 0.55 }),
            -6.3 + i * 2.1,
            1.5,
            0.52,
            false,
          ),
        );
        fac.add(
          mesh(
            rbox(0.12, 5, 0.2, 0.04),
            M("#FFC531", { metalness: 0.7, roughness: 0.3 }),
            -7.35 + i * 2.1,
            2.5,
            0.55,
            false,
          ),
        );
      }
      env.add(fac);
      plant(env, -5.6, -2.6, 1.4);
      plant(env, 5.6, -2.6, 1.4);
      [-4.4, 0, 4.4].forEach((x) => {
        const l = new T3.Group();
        l.position.set(x, 4.6, -3.8);
        l.add(mesh(cyl(0.01, 0.01, 1, 4), M("#FFC531"), 0, 0.5, 0, false));
        l.add(
          mesh(
            sph(0.28, 12, 10),
            new T3.MeshStandardMaterial({
              color: "#FFE6A8",
              emissive: "#FFB347",
              emissiveIntensity: 1,
            }),
            0,
            0,
            0,
            false,
          ),
        );
        l.add(
          mesh(
            tor(0.32, 0.03, 6, 18),
            M("#FFC531", { metalness: 0.8, roughness: 0.25 }),
            0,
            0,
            0,
            false,
          ),
        );
        env.add(l);
        dyn.push({ o: l, type: "sway", ph: x });
      });
      const pl = new T3.PointLight(0xffb36b, 0.6, 14);
      pl.position.set(0, 4, -2);
      env.add(pl);
    }
    // signboard behind customers
    const sb = new T3.Group();
    sb.position.set(
      0,
      ci === 4 ? 3.75 : 3.25,
      ci === 0 ? -4.3 : ci === 4 ? -5.0 : -3.4,
    );
    sb.add(mesh(rbox(5.4, 1.66, 0.16, 0.12), M("#4A1F0C"), 0, 0, 0));
    const sp = new T3.Mesh(
      G("signPlane", () => new T3.PlaneGeometry(5.2, 1.52)),
      new T3.MeshBasicMaterial({ map: signTexture(t), toneMapped: false }),
    );
    sp.position.z = 0.09;
    sb.add(sp);
    if (ci !== 4 && ci !== 0)
      [-2.2, 2.2].forEach((x) =>
        sb.add(mesh(cyl(0.06, 0.06, 3.3, 8), M("#4A1F0C"), x, -1.7, -0.1)),
      );
    if (ci === 0)
      [-2.2, 2.2].forEach((x) =>
        sb.add(mesh(cyl(0.05, 0.05, 0.4, 6), M("#4A1F0C"), x, 1, -0.1)),
      );
    env.add(sb);
    // owned decor
    if (Save.d.decor.includes("plants")) {
      plant(env, -3.95, 0.55, 0.9);
      plant(env, 3.95, 0.55, 0.9);
    }
    if (Save.d.decor.includes("bunting"))
      bunting(env, -5.5, 5.5, 4.4, -1.9, 0.5);
    if (Save.d.decor.includes("lights"))
      stringLights(env, -5.5, 5.5, 4.0, -1.6, 0.45, [
        "#FFC531",
        "#FF5A5F",
        "#12A99F",
        "#7DF09A",
      ]);
    // trays
    trays.length = 0;
    for (let i = 0; i < 3; i++) {
      const tr = new T3.Group();
      tr.add(
        mesh(
          rbox(1.3, 0.06, 0.62, 0.05),
          M(t.tray, { roughness: 0.35 }),
          0,
          0,
          0,
        ),
      );
      tr.position.set(0, 1.1, 0.42);
      tr.userData.items = [];
      env.add(tr);
      trays.push(tr);
    }
  }
  const trays = [];

  /* ================= STATIONS (interactive 3D food stations) ================= */
  let stationGroup = new T3.Group();
  world.add(stationGroup);
  const stations = {};
  function buildStation(id) {
    const f = FOODS[id],
      g = new T3.Group(),
      col = f.color;
    let steam = [];
    const t = f.station;
    if (t === "pot") {
      g.add(
        mesh(
          cyl(0.4, 0.34, 0.52, 22),
          M(id === "partyjollof" ? "#C99A2E" : "#3B3F46", {
            metalness: 0.55,
            roughness: 0.35,
          }),
          0,
          0.26,
          0,
        ),
      );
      const rim = mesh(
        tor(0.4, 0.04, 8, 24),
        M("#5A6069", { metalness: 0.6, roughness: 0.3 }),
        0,
        0.52,
        0,
      );
      rim.rotation.x = Math.PI / 2;
      g.add(rim);
      [-1, 1].forEach((s) => {
        const h = mesh(tor(0.08, 0.025, 6, 12), M("#2B2E33"), s * 0.44, 0.4, 0);
        h.rotation.y = Math.PI / 2;
        g.add(h);
      });
      g.add(
        mesh(cyl(0.37, 0.37, 0.03, 22), M(col, { roughness: 0.9 }), 0, 0.5, 0),
      );
      steam = [[0, 0.55, 0]];
    } else if (t === "pan") {
      g.add(
        mesh(
          cyl(0.44, 0.36, 0.14, 22),
          M("#2F3237", { metalness: 0.5, roughness: 0.35 }),
          0,
          0.18,
          0,
        ),
      );
      g.add(
        mesh(
          cyl(0.4, 0.4, 0.02, 22),
          M("#E0A43A", { roughness: 0.3, metalness: 0.2 }),
          0,
          0.25,
          0,
        ),
      );
      g.add(mesh(rbox(0.5, 0.05, 0.08, 0.02), M("#2B1A10"), 0.65, 0.2, 0));
      g.add(mesh(cyl(0.2, 0.24, 0.1, 12), M("#3B3F46"), 0, 0.05, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = mesh(
          sph(0.09, 10, 8),
          M(col, { roughness: 0.6 }),
          Math.cos(a) * 0.2,
          0.28,
          Math.sin(a) * 0.2,
        );
        p.scale.y = id === "plantain" ? 0.45 : 0.8;
        g.add(p);
      }
      steam = [[0, 0.32, 0]];
    } else if (t === "cooler") {
      g.add(
        mesh(
          rbox(0.86, 0.56, 0.58, 0.1),
          M("#1E88E5", { roughness: 0.35 }),
          0,
          0.28,
          0,
        ),
      );
      g.add(
        mesh(
          rbox(0.9, 0.1, 0.62, 0.05),
          M("#FFFFFF", { roughness: 0.3 }),
          0,
          0.6,
          0,
        ),
      );
      for (let i = 0; i < 3; i++) {
        g.add(
          mesh(
            cyl(0.06, 0.06, 0.3, 10),
            M(i === 1 ? "#FF7A1A" : "#9E0F3B", { roughness: 0.15 }),
            -0.22 + i * 0.22,
            0.78,
            0,
          ),
        );
        g.add(
          mesh(
            cyl(0.035, 0.035, 0.06, 8),
            M("#FFFFFF", { metalness: 0.4 }),
            -0.22 + i * 0.22,
            0.96,
            0,
          ),
        );
      }
    } else if (t === "grill") {
      g.add(
        mesh(
          rbox(0.95, 0.32, 0.55, 0.05),
          M("#2B2B2B", { metalness: 0.4, roughness: 0.5 }),
          0,
          0.3,
          0,
        ),
      );
      g.add(
        mesh(
          rbox(0.86, 0.04, 0.46, 0.02),
          new T3.MeshStandardMaterial({
            color: "#FF6A00",
            emissive: "#FF4500",
            emissiveIntensity: 0.9,
          }),
          0,
          0.44,
          0,
          false,
        ),
      );
      for (let i = 0; i < 5; i++)
        g.add(
          mesh(
            box(0.86, 0.02, 0.02),
            M("#888888", { metalness: 0.8 }),
            0,
            0.48,
            -0.18 + i * 0.09,
            false,
          ),
        );
      for (let k = 0; k < 3; k++) {
        for (let i = 0; i < 3; i++)
          g.add(
            mesh(
              box(0.09, 0.08, 0.08),
              M("#7B3416"),
              -0.2 + i * 0.14,
              0.54,
              -0.12 + k * 0.12,
            ),
          );
      }
      steam = [[0, 0.55, 0]];
    } else if (t === "mortar") {
      g.add(
        mesh(
          cyl(0.32, 0.25, 0.55, 16),
          M("#A0612E", { roughness: 0.7 }),
          0,
          0.28,
          0,
        ),
      );
      g.add(mesh(cyl(0.27, 0.27, 0.02, 16), M("#F7F2E4"), 0, 0.55, 0));
      const p = mesh(cyl(0.06, 0.07, 1, 10), M("#C48A52"), 0.08, 0.85, 0);
      p.rotation.z = -0.25;
      g.add(p);
    }
    const dish = foodModel(id);
    dish.position.set(0, 0, 0.48);
    dish.scale.setScalar(0.95);
    g.add(dish);
    g.userData.pick = { type: "station", id };
    g.userData.steam = steam;
    g.userData.dish = dish;
    return g;
  }
  function setupStations(foods) {
    retainResources(stationGroup);
    world.remove(stationGroup);
    stationGroup = new T3.Group();
    world.add(stationGroup);
    for (const k in stations) delete stations[k];
    const n = foods.length,
      spacing = Math.min(1.12, 6.6 / n),
      sc = n > 6 ? 0.78 : n > 5 ? 0.92 : 1;
    foods.forEach((id, i) => {
      const s = buildStation(id);
      s.position.set((i - (n - 1) / 2) * spacing, 0.86, 2.12);
      s.scale.setScalar(sc);
      stationGroup.add(s);
      stations[id] = s;
      s.userData.bounce = 0;
    });
  }

  /* ================= PARTICLES / STEAM / FLYERS ================= */
  const pPool = [];
  const pGeo = new T3.IcosahedronGeometry(0.07, 0);
  const pMats = [
    "#FFC531",
    "#FF7A1A",
    "#FFFFFF",
    "#12A99F",
    "#FF5A5F",
    "#7DF09A",
  ].map((c) => new T3.MeshBasicMaterial({ color: c }));
  for (let i = 0; i < 70; i++) {
    const m = new T3.Mesh(pGeo, pMats[i % pMats.length]);
    m.visible = false;
    scene.add(m);
    pPool.push({ m, life: 0, v: new T3.Vector3() });
  }
  function burst(pos, n, spread, colors) {
    let c = 0;
    for (const p of pPool) {
      if (p.life > 0) continue;
      p.life = rnd(0.5, 0.9);
      p.max = p.life;
      p.m.visible = true;
      p.m.position.copy(pos);
      if (colors) p.m.material = pMats[colors[c % colors.length]];
      p.v.set(rnd(-1, 1) * spread, rnd(1.5, 3.5), rnd(-1, 1) * spread);
      if (++c >= n) break;
    }
  }
  function updateParticles(dt) {
    for (const p of pPool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= 9 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += dt * 8;
      p.m.rotation.z += dt * 6;
      p.m.scale.setScalar(Math.max(0.01, p.life / p.max));
      if (p.life <= 0) p.m.visible = false;
    }
  }
  const steam = [];
  const steamGeo = new T3.SphereGeometry(0.12, 8, 6);
  for (let i = 0; i < 22; i++) {
    const m = new T3.Mesh(
      steamGeo,
      new T3.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    scene.add(m);
    steam.push({ m, life: 0 });
  }
  let steamT = 0;
  const _v = new T3.Vector3();
  function updateSteam(dt) {
    steamT -= dt;
    const emitters = [];
    for (const id in stations) {
      const s = stations[id];
      (s.userData.steam || []).forEach((e) => emitters.push([s, e]));
    }
    if (steamT <= 0 && emitters.length) {
      steamT = 0.16;
      const p = steam.find((q) => q.life <= 0);
      if (p) {
        const [s, e] = pick(emitters);
        _v.set(e[0] + rnd(-0.15, 0.15), e[1], e[2] + rnd(-0.15, 0.15));
        s.localToWorld(_v);
        p.m.position.copy(_v);
        p.life = p.max = rnd(1.2, 1.8);
      }
    }
    for (const p of steam) {
      if (p.life <= 0) {
        p.m.material.opacity = 0;
        continue;
      }
      p.life -= dt;
      const k = 1 - p.life / p.max;
      p.m.position.y += dt * 0.6;
      p.m.position.x += Math.sin(k * 6 + p.max * 10) * dt * 0.1;
      p.m.scale.setScalar(0.6 + k * 1.6);
      p.m.material.opacity = Math.sin(k * Math.PI) * 0.38;
    }
  }
  const flyers = [];
  function fly(obj, from, to, dur, arc, done) {
    obj.position.copy(from);
    world.add(obj);
    flyers.push({
      obj,
      from: from.clone(),
      to: to.clone(),
      t: 0,
      dur,
      arc,
      done,
      s0: obj.scale.x,
    });
  }
  function updateFlyers(dt) {
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.t += dt / f.dur;
      const k = Math.min(1, f.t);
      f.obj.position.lerpVectors(f.from, f.to, k);
      f.obj.position.y += Math.sin(k * Math.PI) * f.arc;
      f.obj.rotation.y += dt * 8;
      f.obj.scale.setScalar(f.s0 * (1 + Math.sin(k * Math.PI) * 0.35));
      if (k >= 1) {
        flyers.splice(i, 1);
        f.obj.rotation.y = 0;
        f.obj.scale.setScalar(f.s0);
        if (f.done) f.done(f.obj);
      }
    }
  }

  /* ================= CHEF ================= */
  let chef = null;
  const chefState = {
    x: 0,
    tx: 0,
    anim: 0,
    mood: "neutral",
    moodT: 0,
    stir: 0,
  };
  function buildChef() {
    if (chef) {
      retainResources(chef.root);
      world.remove(chef.root);
    }
    const o = OUTFITS.find((x) => x.id === Save.d.outfit) || OUTFITS[0];
    const mat = new T3.MeshStandardMaterial({
      map: ankaraTex([o.a, o.b, "#FFF4DE"], 0),
      roughness: 0.7,
    });
    chef = makePerson({
      skin: SKINS[1],
      bodyMat: mat,
      accent: o.b,
      hat: "chef",
      scale: 0.86,
    });
    chef.root.position.set(0, 0, 1.5);
    world.add(chef.root);
    setFace(chef, "happy");
  }
  function chefReact(m, dur) {
    chefState.mood = m;
    chefState.moodT = dur || 0.8;
    setFace(chef, m);
  }
  function updateChef(dt, t) {
    if (!chef) return;
    const P = chef;
    chefState.x = lerp(chefState.x, chefState.tx, Math.min(1, dt * 10));
    P.root.position.x = chefState.x;
    const moving = Math.abs(chefState.tx - chefState.x) > 0.05;
    P.inner.position.y = moving ? Math.abs(Math.sin(t * 16)) * 0.08 : 0;
    P.inner.scale.y = 1 + Math.sin(t * 2.6) * 0.02;
    if (chefState.stir > 0) {
      chefState.stir -= dt;
      P.armR.rotation.x = -1.2 + Math.sin(t * 25) * 0.4;
      P.armL.rotation.x = -0.6;
    } else {
      P.armR.rotation.x = lerp(
        P.armR.rotation.x,
        Math.sin(t * 2) * 0.08,
        dt * 8,
      );
      P.armL.rotation.x = lerp(
        P.armL.rotation.x,
        -Math.sin(t * 2) * 0.08,
        dt * 8,
      );
    }
    if (chefState.mood === "happy" && chefState.moodT > 0) {
      P.inner.position.y = Math.abs(Math.sin(t * 10)) * 0.18;
      P.armL.rotation.z = -2.4;
      P.armR.rotation.z = 2.4;
    } else {
      P.armL.rotation.z = lerp(P.armL.rotation.z, -0.25, dt * 8);
      P.armR.rotation.z = lerp(P.armR.rotation.z, 0.25, dt * 8);
    }
    if (Game.state === "menu") {
      P.armR.rotation.z = 2.2 + Math.sin(t * 6) * 0.4;
    }
    if (chefState.moodT > 0) {
      chefState.moodT -= dt;
      if (chefState.moodT <= 0) {
        chefState.mood = "neutral";
        setFace(chef, "happy");
      }
    }
    P.root.rotation.y = Math.sin(t * 0.8) * 0.12;
    P.head.rotation.z = Math.sin(t * 1.7) * 0.05;
  }

  /* ================= CUSTOMER MANAGER ================= */
  const STREET_Z = -2.3,
    WAIT_Z = -0.72;
  let custSeq = 0;
  function lookFor(opts) {
    const skin = pick(SKINS);
    if (opts.guest)
      return {
        skin,
        bodyMat: pick(ASO_MATS),
        accent: "#FFC531",
        hat: Math.random() < 0.65 ? "gele" : "fila",
        vip: opts.vip,
        scale: rnd(0.92, 1.04),
      };
    if (opts.vip)
      return {
        skin,
        bodyMat: pick(ANKARA_MATS),
        accent: "#FFC531",
        hat: "chief",
        vip: true,
        scale: 1.06,
      };
    const r = Math.random();
    return {
      skin,
      bodyMat: r < 0.65 ? pick(ANKARA_MATS) : M(pick(TEE)),
      accent: pick([
        "#FFC531",
        "#12A99F",
        "#FF5A5F",
        "#2FA34F",
        "#FFF4DE",
        "#6B2D8C",
      ]),
      hat: pick(["gele", "fila", "afro", "bun", "afro", "gele"]),
      vip: false,
      scale: rnd(0.9, 1.04),
    };
  }
  class Customer {
    constructor(lane, order, o) {
      this.id = ++custSeq;
      this.lane = lane;
      this.order = order.map((f) => ({ f, done: false }));
      this.vip = !!o.vip;
      this.guest = !!o.guest;
      this.max = o.patience;
      this.p = this.max;
      this.speed = o.speed || 3.6;
      this.t = Math.random() * 5;
      this.st = 0;
      this.P = makePerson(lookFor(o));
      this.root = this.P.root;
      this.root.userData.pick = { type: "cust", c: this };
      const side = Math.random() < 0.5 ? -1 : 1;
      this.root.position.set(side * 10, 0, STREET_Z);
      this.root.rotation.y = (-side * Math.PI) / 2;
      const lx = Game.laneX[lane];
      this.path = [
        new T3.Vector3(lx, 0, STREET_Z),
        new T3.Vector3(lx, 0, WAIT_Z),
      ];
      this.state = "enter";
      this.faceRot = 0;
      world.add(this.root);
      setFace(this.P, "neutral");
      const cols =
        Game.cfg.lanes >= 3 || this.order.length === 4
          ? 2
          : Math.min(this.order.length, 3);
      this.el = bridge.bubble(this, cols, FOODS, () => Game.select(this));
      this.items = [...this.el.querySelectorAll(".it")];
      this.patEl = this.el.querySelector(".pat b");
      this.sayEl = this.el.querySelector(".say");
      this.sayT = 0;
    }
    needs(f) {
      return needsFood(this.state, this.order, f);
    }
    fill(f) {
      const { index, slot } = fillOrder(this.order, f);
      if (index >= 0) this.items[index].classList.add("done");
      return slot;
    }
    complete() {
      return orderComplete(this.order);
    }
    say(txt, dur) {
      this.sayEl.textContent = txt;
      this.sayEl.classList.add("show");
      this.sayT = dur || 1.8;
    }
    leave() {
      const lx = this.root.position.x,
        side = lx > 0 ? 1 : -1;
      this.path = [
        new T3.Vector3(lx, 0, STREET_Z),
        new T3.Vector3(side * 11, 0, STREET_Z),
      ];
      this.state = "leave";
      this.el.style.opacity = "0";
    }
    update(dt) {
      this.t += dt;
      this.st += dt;
      const P = this.P,
        r = this.root;
      if (this.sayT > 0) {
        this.sayT -= dt;
        if (this.sayT <= 0) this.sayEl.classList.remove("show");
      }
      let moving = false;
      if (this.state === "enter" || this.state === "leave") {
        const tgt = this.path[0];
        if (tgt) {
          _v.subVectors(tgt, r.position);
          _v.y = 0;
          const d = _v.length(),
            step = this.speed * dt;
          if (d <= step) {
            r.position.copy(tgt);
            this.path.shift();
          } else {
            _v.multiplyScalar(1 / d);
            r.position.addScaledVector(_v, step);
            this.faceRot = Math.atan2(_v.x, _v.z);
            moving = true;
          }
        }
        if (!this.path.length) {
          if (this.state === "enter") {
            this.state = "wait";
            this.st = 0;
            this.faceRot = 0;
            this.el.style.opacity = "1";
            Game.onArrive(this);
          } else {
            this.dead = true;
          }
        }
      }
      let dr = this.faceRot - r.rotation.y;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      r.rotation.y += dr * Math.min(1, dt * 10);
      const ratio = this.p / this.max;
      if (this.state === "wait") {
        this.p -= dt * Game.patienceRate();
        if (ratio < 0.3) {
          if (!this.angry) {
            this.angry = true;
            setFace(P, "angry");
            this.el.classList.add("angry");
            this.say(pick(LINES.angry), 1.6);
          }
        } else if (this.angry) {
          this.angry = false;
          setFace(P, "neutral");
          this.el.classList.remove("angry");
        }
        if (this.p <= 0) {
          this.p = 0;
          Game.onLost(this);
        }
        const b = this.patEl;
        b.style.width = (ratio * 100).toFixed(1) + "%";
        b.style.background =
          ratio > 0.6 ? "#2FA34F" : ratio > 0.3 ? "#FFB020" : "#E5343A";
      }
      if (this.state === "happy" || this.state === "sad") {
        if (this.st > 1.05) this.leave();
      }
      // animation
      const I = P.inner;
      if (moving) {
        I.position.y = Math.abs(Math.sin(this.t * 11)) * 0.09;
        I.rotation.z = Math.sin(this.t * 11) * 0.05;
        P.armL.rotation.x = Math.sin(this.t * 11) * 0.7;
        P.armR.rotation.x = -Math.sin(this.t * 11) * 0.7;
        I.rotation.x = 0;
      } else if (this.state === "happy") {
        const k = this.st;
        I.position.y = Math.abs(Math.sin(k * 9)) * 0.35;
        I.scale.y = 1 + Math.sin(k * 18) * 0.06;
        P.armL.rotation.z = -2.5;
        P.armR.rotation.z = 2.5;
        P.armL.rotation.x = P.armR.rotation.x = 0;
      } else if (this.state === "sad") {
        I.rotation.x = lerp(I.rotation.x, 0.25, dt * 6);
        P.head.rotation.x = lerp(P.head.rotation.x, 0.3, dt * 6);
        P.armL.rotation.z = -0.1;
        P.armR.rotation.z = 0.1;
      } else {
        I.position.y = 0;
        I.rotation.z = ratio < 0.3 ? Math.sin(this.t * 16) * 0.05 : 0;
        I.scale.y = 1 + Math.sin(this.t * 2.4) * 0.025;
        P.armL.rotation.x = lerp(P.armL.rotation.x, 0, dt * 8);
        P.armR.rotation.x = lerp(P.armR.rotation.x, 0, dt * 8);
        P.armL.rotation.z = lerp(
          P.armL.rotation.z,
          ratio < 0.3 ? -0.9 : -0.25,
          dt * 6,
        );
        P.armR.rotation.z = lerp(
          P.armR.rotation.z,
          ratio < 0.3 ? 0.9 : 0.25,
          dt * 6,
        );
        P.head.rotation.z = Math.sin(this.t * 1.3) * 0.06;
        if (this.wrongT > 0) {
          this.wrongT -= dt;
          P.head.rotation.y = Math.sin(this.wrongT * 30) * 0.35;
        } else P.head.rotation.y = 0;
      }
      if (this.state === "leave") I.rotation.x = lerp(I.rotation.x, 0, dt * 4);
    }
    dispose() {
      world.remove(this.root);
      bridge.remove("bubble-" + this.id);
    }
  }
  class Stroller {
    constructor() {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.P = makePerson(lookFor({}));
      this.root = this.P.root;
      this.side = side;
      this.root.position.set(side * 11, 0, STREET_Z - rnd(0, 0.6));
      this.root.rotation.y = (-side * Math.PI) / 2;
      this.speed = rnd(1.8, 2.8);
      this.t = Math.random() * 6;
      world.add(this.root);
      setFace(this.P, Math.random() < 0.5 ? "happy" : "neutral");
    }
    update(dt) {
      this.t += dt;
      this.root.position.x -= this.side * this.speed * dt;
      const I = this.P.inner;
      I.position.y = Math.abs(Math.sin(this.t * 9)) * 0.08;
      this.P.armL.rotation.x = Math.sin(this.t * 9) * 0.6;
      this.P.armR.rotation.x = -Math.sin(this.t * 9) * 0.6;
      if (Math.abs(this.root.position.x) > 12) this.dead = true;
    }
    dispose() {
      world.remove(this.root);
    }
  }
  const selRing = new T3.Mesh(
    tor(0.62, 0.06, 8, 36),
    new T3.MeshBasicMaterial({ color: 0xffc531 }),
  );
  selRing.rotation.x = Math.PI / 2;
  selRing.visible = false;
  world.add(selRing);

  /* ================= UI MANAGER ================= */
  const UI = {
    screens: ["scrMenu", "scrMap", "scrGame"],
    show(id) {
      bridge.show(id);
    },
    open(id) {
      bridge.overlay(id, true);
    },
    close(id) {
      bridge.overlay(id, false);
    },
    toast(msg) {
      const t = $("#toast");
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(this.tt);
      this.tt = setTimeout(() => t.classList.remove("show"), 2200);
    },
    coins() {
      ["#menuCoins", "#mapCoins", "#shopCoins"].forEach(
        (s) => ($(s).textContent = Save.d.coins.toLocaleString()),
      );
    },
    pop(el) {
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
    },
  };

  function floatText(x, y, text, cls) {
    const { id, element: d } = bridge.effect("text", { x, y, text, cls });
    listen(d, "animationend", () => bridge.remove(id));
    setTimeout(() => bridge.remove(id), 1600);
  }
  function coinBurst(x, y, n, targetSel, onFirst) {
    const tgt = $(targetSel).getBoundingClientRect();
    const tx = tgt.left + tgt.width / 2,
      ty = tgt.top + tgt.height / 2;
    for (let i = 0; i < n; i++) {
      const { id, element: c } = bridge.effect("coin", { x, y });
      const dx = rnd(-46, 46),
        dy = rnd(-60, -10);
      const a = c.animate(
        [
          { transform: "translate(-50%,-50%) scale(.3)", opacity: 0 },
          {
            transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.15)`,
            opacity: 1,
            offset: 0.3,
          },
          {
            transform: `translate(calc(-50% + ${tx - x}px),calc(-50% + ${ty - y}px)) scale(.7)`,
            opacity: 1,
          },
        ],
        { duration: 650 + i * 55, easing: "cubic-bezier(.45,0,.75,1)" },
      );
      a.onfinish = () => {
        bridge.remove(id);
        if (i === 0 && onFirst) onFirst();
      };
    }
  }
  function screenPos(v3) {
    _v.copy(v3).project(camera);
    return {
      x: ((_v.x + 1) / 2) * innerWidth,
      y: ((1 - _v.y) / 2) * innerHeight,
    };
  }
  function banner(b1, b2, b3, go) {
    const b = $("#banner");
    b.querySelector(".b1").textContent = b1;
    const e2 = b.querySelector(".b2"),
      e3 = b.querySelector(".b3");
    e2.textContent = b2 || "";
    e2.hidden = !b2;
    e3.textContent = b3 || "";
    e3.hidden = !b3;
    b.classList.toggle("go", !!go);
    b.classList.remove("show");
    void b.offsetWidth;
    b.classList.add("show");
  }
  function comboText(txt) {
    const c = $("#combo");
    c.textContent = txt;
    c.classList.remove("show");
    void c.offsetWidth;
    c.classList.add("show");
  }

  /* confetti */
  const cfC = $("#confetti"),
    cfX = cfC.getContext("2d");
  let cf = [];
  function confetti(n) {
    cfC.width = innerWidth;
    cfC.height = innerHeight;
    const cols = [
      "#FFC531",
      "#FF7A1A",
      "#12A99F",
      "#FF5A5F",
      "#2FA34F",
      "#FFFFFF",
      "#7B2E8E",
    ];
    for (let i = 0; i < (REDUCED ? 30 : n); i++)
      cf.push({
        x: rnd(0, innerWidth),
        y: rnd(-innerHeight * 0.6, -10),
        vx: rnd(-60, 60),
        vy: rnd(120, 320),
        r: rnd(0, 6),
        vr: rnd(-8, 8),
        w: rnd(7, 13),
        h: rnd(10, 18),
        c: pick(cols),
        life: rnd(2.6, 4),
      });
  }
  function updateConfetti(dt) {
    if (!cf.length) return;
    cfX.clearRect(0, 0, cfC.width, cfC.height);
    for (let i = cf.length - 1; i >= 0; i--) {
      const p = cf[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      p.vx += Math.sin(p.y * 0.02) * 10 * dt;
      cfX.save();
      cfX.translate(p.x, p.y);
      cfX.rotate(p.r);
      cfX.scale(1, Math.cos(p.r * 1.3));
      cfX.fillStyle = p.c;
      cfX.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cfX.restore();
      if (p.life <= 0 || p.y > innerHeight + 30) cf.splice(i, 1);
    }
    if (!cf.length) cfX.clearRect(0, 0, cfC.width, cfC.height);
  }

  /* ================= GAME MANAGER ================= */
  const Game = {
    state: "menu",
    cfg: null,
    customers: [],
    strollers: [],
    laneX: [0],
    selected: null,
    cooldown: {},
    patienceRate() {
      return 1;
    },
    prepTime() {
      return Math.max(0.08, 0.32 - 0.045 * Save.d.up.fast);
    },
    start(cfg) {
      this.clear();
      this.cfg = cfg;
      buildEnv(cfg.ci);
      setupStations(cfg.foods);
      this.laneX =
        cfg.lanes === 1
          ? [0]
          : cfg.lanes === 2
            ? [-1.15, 1.15]
            : [-2.05, 0, 2.05];
      trays.forEach((t, i) => {
        t.visible = i < cfg.lanes;
        if (i < cfg.lanes) t.position.x = this.laneX[i];
        this.clearTray(i);
      });
      this.score = 0;
      this.coinsEarned = 0;
      this.served = 0;
      this.lost = 0;
      this.lives = 3;
      this.combo = 0;
      this.bestCombo = 0;
      this.mistakes = 0;
      this.time =
        cfg.duration + (isFinite(cfg.duration) ? Save.d.up.time * 6 : 0);
      this.spawnT = 0.8;
      this.laneBusy = new Array(3).fill(null);
      this.cooldown = {};
      this.selected = null;
      this.endT = 0;
      this.lastTick = 99;
      this.dispScore = 0;
      this.dispCoins = 0;
      this.hintT = 0;
      chefState.tx = 0;
      chefState.x = 0;
      buildFoodButtons(cfg.foods);
      bridge.caption(cfg, Save.d.endlessBest);
      $("#hudTimer").hidden = !isFinite(this.time);
      const sb = $("#hudSbar").querySelectorAll("i");
      if (cfg.mode === "endless") {
        $("#hudSbar").parentElement.hidden = true;
      } else {
        $("#hudSbar").parentElement.hidden = false;
        cfg.stars.forEach((v, i) => {
          sb[i].style.left = (v / cfg.stars[2]) * 100 + "%";
          sb[i].classList.remove("on");
        });
      }
      this.updateHUD(true);
      UI.show("scrGame");
      camMode("game");
      this.state = "intro";
      this.introT = 2.1;
      const goalTxt =
        cfg.mode === "endless"
          ? "Serve as many customers as you can!"
          : `Serve ${cfg.goal} customers`;
      banner(
        cfg.mode === "level" ? `Level ${cfg.n}` : cfg.title,
        goalTxt +
          (cfg.mode === "level" && cfg.local === 0
            ? " · " + CHAPTERS[cfg.ci].name
            : ""),
        cfg.challenge ||
          (cfg.tutorial ? "Tap the food each customer wants" : ""),
      );
    },
    clear() {
      this.customers.forEach((c) => c.dispose());
      this.customers = [];
      this.strollers.forEach((s) => s.dispose());
      this.strollers = [];
      selRing.visible = false;
      flyers.forEach((f) => world.remove(f.obj));
      flyers.length = 0;
      trays.forEach((t, i) => this.clearTray(i));
    },
    clearTray(i) {
      const t = trays[i];
      if (!t) return;
      t.userData.items.forEach((o) => t.remove(o));
      t.userData.items = [];
    },
    diff() {
      // live difficulty for endless
      const c = this.cfg;
      if (c.mode !== "endless") return c;
      const s = this.served;
      return Object.assign({}, c, {
        lanes: s < 5 ? 2 : 3,
        imin: s < 10 ? 1 : 2,
        imax: s < 6 ? 2 : s < 18 ? 3 : 4,
        patience: Math.max(9, 22 - s * 0.22),
        gap: [Math.max(0.3, 0.9 - s * 0.02), Math.max(0.9, 2.2 - s * 0.04)],
        vip: 0.15 + Math.min(0.2, s * 0.005),
      });
    },
    spawn() {
      const c = this.diff();
      const free = [];
      for (let i = 0; i < c.lanes; i++) if (!this.laneBusy[i]) free.push(i);
      if (!free.length) return false;
      if (c.mode === "endless" && c.lanes === 3 && this.laneX.length < 3) {
        this.laneX = [-2.05, 0, 2.05];
        trays.forEach((t, i) => {
          t.visible = true;
          t.position.x = this.laneX[i];
        });
      }
      const lane = pick(free);
      let k = c.imin;
      if (c.imax > c.imin)
        k =
          c.imax - c.imin === 1
            ? Math.random() < c.p2
              ? c.imax
              : c.imin
            : ri(c.imin, c.imax);
      k = Math.min(k, c.foods.length);
      if (c.tutorial && this.served < 2) k = 1;
      const pool = c.foods.slice(),
        order = [];
      for (let i = 0; i < k; i++)
        order.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      const vip = Math.random() < c.vip && !c.tutorial;
      const items = k;
      const pat =
        (c.patience + items * 2.6) *
        (1 + 0.1 * Save.d.up.patience) *
        (vip ? 0.85 : 1) *
        (c.tutorial ? 1.5 : 1);
      const cu = new Customer(lane, order, {
        vip,
        guest: c.guests && !vip && Math.random() < 0.75,
        patience: pat,
        speed: c.fast ? 4.8 : 3.6,
      });
      this.laneBusy[lane] = cu;
      this.customers.push(cu);
      return true;
    },
    onArrive(c) {
      Sound.play("arrive");
      let pool = LINES.arrive.slice();
      c.order.forEach((o) => {
        if (LINES[o.f]) pool = pool.concat(LINES[o.f], LINES[o.f]);
      });
      if (c.guest) pool = pool.concat(LINES.guest, LINES.guest);
      if (c.vip) pool = LINES.vip;
      c.say(pick(pool), 2);
    },
    select(c) {
      if (this.state !== "playing" || c.state !== "wait") return;
      this.selected = this.selected === c ? null : c;
      Sound.play("click");
    },
    tapFood(id, btn) {
      if (this.state !== "playing") return;
      btn = btn || document.querySelector(`.food[data-id="${id}"]`);
      if ((this.cooldown[id] || 0) > 0) return;
      this.cooldown[id] = this.prepTime();
      if (btn) {
        btn.classList.remove("press");
        void btn.offsetWidth;
        btn.classList.add("press");
        setTimeout(() => btn.classList.remove("press"), 120);
        const cd = btn.querySelector(".cd");
        cd.style.transition = "none";
        cd.style.height = "100%";
        void cd.offsetWidth;
        cd.style.transition = `height ${this.cooldown[id]}s linear`;
        cd.style.height = "0";
      }
      Sound.play("tap");
      const st = stations[id];
      if (st) {
        st.userData.bounce = 1;
        chefState.tx = clamp(st.position.x, -3, 3);
        chefState.stir = 0.3;
      }
      const cand = this.customers.filter((c) => c.needs(id));
      if (!cand.length) {
        this.mistakes++;
        this.combo = 0;
        Sound.play("wrong");
        if (btn) {
          btn.classList.remove("wrong");
          void btn.offsetWidth;
          btn.classList.add("wrong");
        }
        const w = this.customers
          .filter((c) => c.state === "wait")
          .sort((a, b) => a.p / a.max - b.p / b.max)[0];
        if (w) {
          w.p = Math.max(0.5, w.p - w.max * 0.08);
          w.say(pick(LINES.wrong), 1.4);
          w.wrongT = 0.5;
          const sp = screenPos(
            _v.set(w.root.position.x, 2.4, w.root.position.z),
          );
          floatText(sp.x, sp.y, "Oops!", "bad small");
        } else if (st) {
          const sp = screenPos(st.getWorldPosition(new T3.Vector3()));
          floatText(sp.x, sp.y - 40, "No one wants that!", "bad small");
        }
        chefReact("wow", 0.6);
        return;
      }
      let c = cand.includes(this.selected)
        ? this.selected
        : cand.sort((a, b) => a.p / a.max - b.p / b.max)[0];
      const slot = c.fill(id);
      const n = c.order.length;
      const tray = trays[c.lane];
      const item = foodModel(id);
      item.scale.setScalar(n > 2 ? 0.5 : 0.6);
      const from = st
        ? st.getWorldPosition(new T3.Vector3()).add(new T3.Vector3(0, 0.4, 0))
        : new T3.Vector3(0, 1.4, 2);
      const spacing = n > 2 ? 0.34 : 0.5;
      const local = new T3.Vector3((slot - (n - 1) / 2) * spacing, 0.04, 0);
      const to = tray.localToWorld(local.clone());
      UI.pop(
        c.items[
          c.order.findIndex(
            (o, i) => o.f === id && o.done && !c.items[i].dataset.p,
          )
        ] || c.items[0],
      );
      c.items.forEach((el, i) => {
        if (c.order[i].done) el.dataset.p = 1;
      });
      if (c.complete()) {
        c.state = "served";
        this.laneBusy[c.lane] = null;
        if (this.selected === c) this.selected = null;
      }
      fly(item, from, to, 0.28, 0.9, (o) => {
        world.remove(o);
        o.position.copy(local);
        tray.add(o);
        tray.userData.items.push(o);
        Sound.play("place");
        burst(to, 5, 0.8, [0, 2]);
        if (c.state === "served" && c.complete() && !c.paid) {
          c.paid = true;
          this.serve(c);
        }
      });
    },
    serve(c) {
      const base = c.order.reduce((s, o) => s + FOODS[o.f].price, 0);
      const ratio = c.p / c.max;
      const fast = ratio > 0.6;
      const { points: pts, coins } = scoreOrder({
        base,
        combo: this.combo,
        patienceRatio: ratio,
        vip: c.vip,
        tips: Save.d.up.tips,
        coinMult: this.cfg.coinMult,
      });
      this.score += pts;
      this.coinsEarned += coins;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.served++;
      c.state = "happy";
      c.st = 0;
      setFace(c.P, "happy");
      c.el.classList.remove("angry");
      c.say(pick(LINES.happy), 1.2);
      const tray = trays[c.lane],
        head = new T3.Vector3(c.root.position.x, 1.3, c.root.position.z + 0.3);
      tray.userData.items.slice().forEach((o, i) => {
        const w = o.getWorldPosition(new T3.Vector3());
        tray.remove(o);
        fly(o, w, head, 0.25 + i * 0.05, 0.4, (ob) => world.remove(ob));
      });
      tray.userData.items = [];
      Sound.play("serve");
      chefReact("happy", 0.9);
      const sp = screenPos(_v.set(c.root.position.x, 2.6, c.root.position.z));
      floatText(sp.x, sp.y, "+" + pts);
      if (fast)
        setTimeout(
          () => floatText(sp.x, sp.y + 34, "FAST!", "green small"),
          120,
        );
      if (c.vip)
        setTimeout(() => floatText(sp.x, sp.y + 60, "VIP x2", "small"), 220);
      coinBurst(
        sp.x,
        sp.y + 20,
        Math.min(8, 3 + Math.floor(coins / 40)),
        "#hudCoins",
        () => {
          Sound.play("coin");
          UI.pop($("#hudCoinPill"));
        },
      );
      burst(head.clone().setY(2.2), 16, 1.6, [0, 1, 3, 4, 5]);
      if (this.combo >= 2) {
        comboText(
          this.combo >= 5 ? `PERFECT x${this.combo}!` : `COMBO x${this.combo}!`,
        );
        if (this.combo >= 3) {
          shake = Math.min(0.22, 0.06 + this.combo * 0.02);
          Sound.play("combo");
        }
      }
      this.updateHUD();
      if (this.cfg.mode !== "endless" && this.served >= this.cfg.goal)
        this.finish(true);
    },
    onLost(c) {
      c.state = "sad";
      c.st = 0;
      setFace(c.P, "sad");
      c.el.classList.remove("angry");
      c.say(pick(LINES.leave), 1.2);
      this.laneBusy[c.lane] = null;
      if (this.selected === c) this.selected = null;
      this.clearTray(c.lane);
      this.lives--;
      this.lost++;
      this.combo = 0;
      Sound.play("lose");
      const l = $("#hudLives");
      l.classList.remove("hit");
      void l.offsetWidth;
      l.classList.add("hit");
      const sp = screenPos(_v.set(c.root.position.x, 2.4, c.root.position.z));
      floatText(sp.x, sp.y, "Customer left!", "bad small");
      shake = 0.15;
      this.updateHUD();
      if (this.lives <= 0) this.finish(false, "lives");
    },
    finish(won, why) {
      if (this.state !== "playing") return;
      this.state = "ending";
      this.endT = won ? 1.3 : 1.1;
      this.won = won;
      this.why = why;
      if (won) {
        banner("Well Done!", "Kitchen don close for today", "", false);
      } else if (this.cfg.mode === "endless") {
        banner("Rush Over!", "Three customers waka comot", "", false);
      } else
        banner(
          why === "time" ? "Time Up!" : "Oh No!",
          why === "time"
            ? "The clock beat you this time"
            : "Too many hungry customers left",
          "",
          false,
        );
    },
    showEnd() {
      this.state = "over";
      const cfg = this.cfg;
      if (cfg.mode === "endless") {
        const coins = Math.round(this.coinsEarned * 0.6);
        Save.d.coins += coins;
        const nb = this.score > Save.d.endlessBest;
        if (nb) Save.d.endlessBest = this.score;
        Save.save();
        $("#winTitle").textContent = nb ? "New Best!" : "Rush Over!";
        $("#winSub").textContent =
          `You served ${this.served} customers. Personal best: ${Save.d.endlessBest}`;
        document
          .querySelectorAll("#ovWin .bigstar")
          .forEach((s) => s.classList.remove("on"));
        $("#ovWin .bigstars").hidden = true;
        $("#winScore").textContent = this.score;
        $("#winCoins").textContent = coins;
        $("#winL3").textContent = "Best combo";
        $("#winCombo").textContent = "x" + this.bestCombo;
        $("#winNext").hidden = true;
        UI.open("ovWin");
        Sound.play(nb ? "win" : "fail");
        if (nb) confetti(160);
        return;
      }
      if (this.won) {
        const timeBonus = isFinite(this.time) ? Math.floor(this.time) * 3 : 0;
        this.score += timeBonus;
        this.coinsEarned += timeBonus;
        let stars = 1;
        if (this.score >= cfg.stars[1]) stars = 2;
        if (this.score >= cfg.stars[2]) stars = 3;
        let bonus = 0;
        if (cfg.mode === "level") {
          const k = cfg.n;
          Save.d.stars[k] = Math.max(Save.d.stars[k] || 0, stars);
          Save.d.best[k] = Math.max(Save.d.best[k] || 0, this.score);
          if (Save.d.unlocked <= k) Save.d.unlocked = Math.min(51, k + 1);
        } else if (cfg.mode === "daily" && Save.d.dailyDone !== today()) {
          bonus = 250;
          Save.d.dailyDone = today();
        }
        const total = this.coinsEarned + bonus;
        Save.d.coins += total;
        Save.d.tutorialDone = true;
        Save.save();
        $("#winTitle").textContent =
          cfg.mode === "daily"
            ? "Challenge Done!"
            : cfg.boss
              ? "Rush Conquered!"
              : "Level Complete!";
        $("#winSub").textContent =
          pick([
            "Omo, this food sweet!",
            "You sabi cook!",
            "Ah! Na correct food be this!",
            "Mama Put no dey disappoint!",
          ]) +
          (timeBonus ? ` Time bonus +${timeBonus}` : "") +
          (bonus ? ` · Daily bonus +${bonus}` : "");
        $("#ovWin .bigstars").hidden = false;
        const st = document.querySelectorAll("#ovWin .bigstar");
        st.forEach((s) => s.classList.remove("on"));
        $("#winScore").textContent = "0";
        $("#winCoins").textContent = "0";
        $("#winL3").textContent = "Best combo";
        $("#winCombo").textContent = "x" + this.bestCombo;
        $("#winNext").hidden = cfg.mode !== "level";
        $("#winNext .buttonLabel").textContent =
          cfg.n >= 50 ? "Endless!" : "Next";
        UI.open("ovWin");
        Sound.play("win");
        confetti(200);
        for (let i = 0; i < stars; i++)
          setTimeout(
            () => {
              st[i].classList.add("on");
              Sound.play("star");
              const r = st[i].getBoundingClientRect();
              for (let k = 0; k < 10; k++)
                cf.push({
                  x: r.left + r.width / 2,
                  y: r.top + r.height / 2,
                  vx: rnd(-260, 260),
                  vy: rnd(-300, -60),
                  r: 0,
                  vr: rnd(-8, 8),
                  w: 6,
                  h: 6,
                  c: "#FFC531",
                  life: 0.9,
                });
            },
            500 + i * 420,
          );
        countUp($("#winScore"), this.score, 900);
        countUp($("#winCoins"), total, 1100);
      } else {
        Save.save();
        $("#failTitle").textContent =
          this.why === "time" ? "Time Don Finish!" : "Ah! Customers Vex!";
        $("#failSub").textContent = pick([
          "No wahala. Every big madam started small. Try again!",
          "Hunger no dey wait, but you fit do am. One more try!",
          "Take heart! Next round go sweet pass.",
        ]);
        $("#failServed").textContent = `${this.served} / ${cfg.goal}`;
        UI.open("ovFail");
        Sound.play("fail");
      }
    },
    pause() {
      if (this.state !== "playing" && this.state !== "intro") return;
      this.prevState = this.state;
      this.state = "paused";
      syncToggles();
      UI.open("ovPause");
      if (Sound.ctx) Sound.ctx.suspend().catch(() => {});
    },
    resume() {
      if (this.state !== "paused") return;
      this.state = this.prevState || "playing";
      UI.close("ovPause");
      if (Sound.ctx) Sound.ctx.resume().catch(() => {});
    },
    update(dt) {
      if (this.state === "intro") {
        this.introT -= dt;
        if (this.introT <= 0) {
          this.state = "playing";
          banner("GO!", "", "", true);
          Sound.play("go");
        }
      }
      if (this.state === "playing") {
        for (const k in this.cooldown) this.cooldown[k] -= dt;
        if (isFinite(this.time)) {
          this.time -= dt;
          if (this.time <= 10 && Math.ceil(this.time) !== this.lastTick) {
            this.lastTick = Math.ceil(this.time);
            Sound.play("tick");
          }
          if (this.time <= 0) {
            this.time = 0;
            this.finish(false, "time");
          }
        }
        this.spawnT -= dt;
        const c = this.cfg,
          active = this.customers.filter(
            (x) => x.state === "enter" || x.state === "wait",
          ).length;
        if (
          this.spawnT <= 0 &&
          (c.mode === "endless" || this.served + active < c.goal)
        ) {
          if (this.spawn()) {
            const g = this.diff().gap;
            this.spawnT = rnd(g[0], g[1]);
          } else this.spawnT = 0.25;
        }
        this.hintT -= dt;
        if (this.cfg.tutorial && this.hintT <= 0) {
          this.hintT = 0.25;
          this.updateHints();
        }
      }
      if (this.state === "ending") {
        this.endT -= dt;
        if (this.endT <= 0) this.showEnd();
      }
      if (
        this.state === "playing" ||
        this.state === "ending" ||
        this.state === "intro"
      ) {
        for (let i = this.customers.length - 1; i >= 0; i--) {
          const cu = this.customers[i];
          if (this.state !== "intro") cu.update(dt);
          if (cu.dead) {
            cu.dispose();
            this.customers.splice(i, 1);
          }
        }
        this.updateHUD();
      }
      if (this.selected && this.selected.state === "wait") {
        selRing.visible = true;
        selRing.position.set(
          this.selected.root.position.x,
          0.08,
          this.selected.root.position.z,
        );
        selRing.scale.setScalar(1 + Math.sin(performance.now() / 180) * 0.06);
      } else selRing.visible = false;
      this.customers.forEach((c) =>
        c.el.classList.toggle("sel", c === this.selected),
      );
    },
    updateHints() {
      const w = this.customers
        .filter((c) => c.state === "wait")
        .sort((a, b) => a.p / a.max - b.p / b.max)[0];
      const need = w ? w.order.filter((o) => !o.done).map((o) => o.f) : [];
      document
        .querySelectorAll(".food")
        .forEach((b) =>
          b.classList.toggle("hint", need.includes(b.dataset.id)),
        );
    },
    updateHUD(force) {
      const c = this.cfg;
      if (!c) return;
      this.dispScore = force
        ? this.score
        : lerp(this.dispScore, this.score, 0.2);
      this.dispCoins = force
        ? this.coinsEarned
        : lerp(this.dispCoins, this.coinsEarned, 0.2);
      if (Math.abs(this.dispScore - this.score) < 1)
        this.dispScore = this.score;
      if (Math.abs(this.dispCoins - this.coinsEarned) < 1)
        this.dispCoins = this.coinsEarned;
      $("#hudScore").textContent = Math.round(this.dispScore);
      $("#hudCoins").textContent = Math.round(this.dispCoins);
      const now = performance.now();
      if (!force && now - (this.hudAt || 0) < 100) return;
      this.hudAt = now;
      if (c.mode === "endless") {
        $("#hudProg").style.width =
          Math.min(100, (this.served % 10) * 10) + "%";
        $("#hudProgTxt").textContent =
          `${this.served} served · score ${this.score}`;
      } else {
        $("#hudProg").style.width =
          Math.min(100, (this.served / c.goal) * 100) + "%";
        $("#hudProgTxt").textContent = `${this.served} / ${c.goal} served`;
        $("#hudScoreBar").style.width =
          Math.min(100, (this.score / c.stars[2]) * 100) + "%";
        $("#hudSbar")
          .querySelectorAll("i")
          .forEach((s, i) =>
            s.classList.toggle("on", this.score >= c.stars[i]),
          );
      }
      if (isFinite(this.time)) {
        $("#hudTime").textContent = fmtTime(this.time);
        $("#hudTimer").classList.toggle("low", this.time <= 10);
      }
      $("#hudLives")
        .querySelectorAll("i")
        .forEach((h, i) => h.classList.toggle("off", i >= this.lives));
    },
  };
  function countUp(el, to, dur) {
    const t0 = performance.now();
    const f = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(
        to * (1 - Math.pow(1 - k, 3)),
      ).toLocaleString();
      if (k < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  /* ================= INPUT MANAGER ================= */
  function buildFoodButtons(foods) {
    const g = $("#foodBtns"),
      n = foods.length;
    g.style.setProperty("--cols", n <= 3 ? n : n === 4 ? 4 : n <= 6 ? 3 : 4);
    g.classList.toggle("compact", n > 6);
    bridge.foods(foods, FOODS, (id, button) => Game.tapFood(id, button));
  }
  const ray = new T3.Raycaster(),
    ndc = new T3.Vector2();
  listen(canvas, "pointerdown", (e) => {
    if (Game.state !== "playing") return;
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
    const objs = [
      ...stationGroup.children,
      ...Game.customers.map((c) => c.root),
    ];
    const hits = ray.intersectObjects(objs, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) {
        const p = o.userData.pick;
        if (p.type === "station") Game.tapFood(p.id);
        else Game.select(p.c);
        break;
      }
    }
  });
  const KEYS = "123456789";
  listen(document, "keydown", (e) => {
    if (e.key === "Escape") {
      if (Game.state === "paused") Game.resume();
      else Game.pause();
    }
    const i = KEYS.indexOf(e.key);
    if (i >= 0 && Game.cfg && Game.cfg.foods[i] && Game.state === "playing") {
      Game.tapFood(Game.cfg.foods[i]);
    }
  });
  listen(
    document,
    "touchmove",
    (e) => {
      if (!e.target.closest(".scroll")) e.preventDefault();
    },
    { passive: false },
  );
  listen(document, "gesturestart", (e) => e.preventDefault());
  listen(document, "visibilitychange", () => {
    if (document.hidden) {
      Game.pause();
      if (Sound.ctx) Sound.ctx.suspend();
    } else if (Sound.ctx) Sound.ctx.resume();
  });

  /* ================= CAMERA ================= */
  let shake = 0;
  const cam = {
    mode: "menu",
    dist: 14,
    el: 0.72,
    yaw: 0,
    ty: 1.1,
    tz: 0.2,
    offY: 0,
    tgt: { dist: 14, el: 0.72, yaw: 0, offY: 0, ty: 1.1, tz: 0.2 },
  };
  function camMode(m) {
    cam.mode = m;
    fitCamera();
  }
  function fitCamera() {
    const W = innerWidth,
      H = innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const t = Math.tan(T3.MathUtils.degToRad(camera.fov / 2));
    let hudH, btnH, sw, sh;
    if (cam.mode === "game") {
      hudH = $("#hudTop").offsetHeight + 10;
      btnH = $("#foodBar").offsetHeight;
      sw = 7.6;
      sh = 6.2;
    } else {
      hudH = H * 0.36;
      btnH = H * 0.3;
      sw = 9;
      sh = 6.4;
    }
    const playH = Math.max(160, H - hudH - btnH),
      cy = (hudH + playH / 2) / H;
    let D = Math.max(sw / 2 / (t * camera.aspect), sh / 2 / ((t * playH) / H));
    D = clamp(D, 9, 40);
    Object.assign(cam.tgt, {
      dist: D,
      offY: (0.5 - cy) * H,
      el: cam.mode === "game" ? 0.7 : 0.5,
      ty: cam.mode === "game" ? 1.25 : 1.6,
      tz: cam.mode === "game" ? 0.55 : -0.4,
    });
    if (cam.first) {
      Object.assign(cam, cam.tgt);
      cam.first = false;
    }
  }
  cam.first = true;
  function updateCamera(dt, t) {
    const k = Math.min(1, dt * 3.2);
    ["dist", "el", "offY", "ty", "tz"].forEach(
      (p) => (cam[p] = lerp(cam[p], cam.tgt[p], k)),
    );
    cam.yaw =
      cam.mode === "game" ? lerp(cam.yaw, 0, k) : Math.sin(t * 0.15) * 0.22;
    const H = innerHeight,
      W = innerWidth;
    camera.setViewOffset(W, H, 0, cam.offY, W, H);
    const ce = Math.cos(cam.el);
    camera.position.set(
      Math.sin(cam.yaw) * ce * cam.dist,
      cam.ty + Math.sin(cam.el) * cam.dist,
      cam.tz + Math.cos(cam.yaw) * ce * cam.dist,
    );
    camera.lookAt(0, cam.ty, cam.tz);
    if (shake > 0 && !REDUCED) {
      camera.position.x += rnd(-1, 1) * shake;
      camera.position.y += rnd(-1, 1) * shake;
      shake = Math.max(0, shake - dt * 0.8);
    }
  }
  listen(window, "resize", () => {
    fitCamera();
  });
  listen(window, "orientationchange", () => setTimeout(fitCamera, 250));

  /* ================= MENUS: MAP / SHOP / SETTINGS / DAILY ================= */
  function buildMap() {
    bridge.map({
      chapters: CHAPTERS,
      foods: FOODS,
      save: Save.d,
      start: (n) => {
        Sound.play("click");
        Game.start(levelCfg(n));
      },
      locked: () => UI.toast("Finish the level before to unlock this one"),
      endless: () => Game.start(endlessCfg()),
    });
  }
  function openMap() {
    buildMap();
    UI.coins();
    UI.show("scrMap");
    camMode("menu");
    Game.state = "map";
    requestAnimationFrame(() => {
      const cur = $(".node.current");
      if (cur) {
        const sc = $("#mapScroll");
        sc.scrollTop =
          cur.getBoundingClientRect().top -
          sc.getBoundingClientRect().top +
          sc.scrollTop -
          sc.clientHeight / 2;
      }
    });
  }
  function showMenu() {
    Game.clear();
    Game.state = "menu";
    UI.close("ovWin");
    UI.close("ovFail");
    UI.close("ovPause");
    buildEnv(Math.min(4, chapterOf(Math.min(50, Save.d.unlocked))));
    setupStations(
      CHAPTERS[Math.min(4, chapterOf(Math.min(50, Save.d.unlocked)))].foods,
    );
    trays.forEach((t) => (t.visible = true));
    [-2.05, 0, 2.05].forEach((x, i) => {
      trays[i].position.x = x;
    });
    UI.coins();
    UI.show("scrMenu");
    camMode("menu");
    const el = Save.d.unlocked > 50;
    $("#endlessLock").hidden = el;
    $("#btnEndless").classList.toggle("pulse", el);
    if (Save.d.lastClaim !== today()) setTimeout(openReward, 700);
  }
  let shopTab = "up";
  function buildShop() {
    UI.coins();
    bridge.shop({
      tab: shopTab,
      save: Save.d,
      upgrades: UPGRADES,
      outfits: OUTFITS,
      decor: DECOR,
      buyUpgrade: (u, card, e) =>
        buy(
          u.costs[Save.d.up[u.id]],
          () => {
            Save.d.up[u.id]++;
          },
          card,
          e,
        ),
      buyOutfit: (o, card, e) => {
        if (Save.d.outfits.includes(o.id)) {
          Save.d.outfit = o.id;
          Save.save();
          buildChef();
          Sound.play("click");
          buildShop();
        } else
          buy(
            o.cost,
            () => {
              Save.d.outfits.push(o.id);
              Save.d.outfit = o.id;
              buildChef();
            },
            card,
            e,
          );
      },
      buyDecor: (d, card, e) =>
        buy(
          d.cost,
          () => {
            Save.d.decor.push(d.id);
            envKey = "";
            showMenuEnvRefresh();
          },
          card,
          e,
        ),
    });
  }
  function showMenuEnvRefresh() {
    if (Game.state === "menu" || Game.state === "map") {
      const ci = Math.min(4, chapterOf(Math.min(50, Save.d.unlocked)));
      buildEnv(ci);
    }
  }
  function buy(cost, fn, card, e) {
    if (Save.d.coins < cost) {
      Sound.play("wrong");
      UI.toast(
        `You need ${cost - Save.d.coins} more coins. Play levels to earn them!`,
      );
      card.classList.remove("bought");
      void card.offsetWidth;
      card.style.animation = "shake .35s";
      setTimeout(() => (card.style.animation = ""), 400);
      return;
    }
    Save.d.coins -= cost;
    fn();
    Save.save();
    Sound.play("buy");
    const r = (e.currentTarget || card).getBoundingClientRect();
    for (let k = 0; k < 18; k++)
      cf.push({
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        vx: rnd(-240, 240),
        vy: rnd(-320, -60),
        r: 0,
        vr: rnd(-8, 8),
        w: 7,
        h: 9,
        c: pick(["#FFC531", "#2FA34F", "#FF7A1A"]),
        life: 1,
      });
    buildShop();
  }
  function syncToggles() {
    ["#pSound", "#sSound"].forEach((s) =>
      $(s).classList.toggle("on", Save.d.sound),
    );
    ["#pMusic", "#sMusic"].forEach((s) =>
      $(s).classList.toggle("on", Save.d.music),
    );
    $("#sQuality").classList.toggle("on", HQ());
  }
  function openReward() {
    const streak =
      Save.d.lastClaim && isYesterday(Save.d.lastClaim)
        ? Math.min(7, Save.d.streak + 1)
        : 1;
    const amt = 40 + streak * 20;
    $("#rewardSub").textContent =
      `Welcome back! Day ${streak} of your streak. Come back tomorrow for more.`;
    $("#rewardAmt").textContent = amt;
    UI.open("ovReward");
    bridge.bind("#rewardClaim", (e) => {
      Save.d.lastClaim = today();
      Save.d.streak = streak;
      Save.d.coins += amt;
      Save.save();
      Sound.play("buy");
      const r = e.currentTarget.getBoundingClientRect();
      UI.close("ovReward");
      setTimeout(
        () =>
          coinBurst(r.left + r.width / 2, r.top, 10, "#menuCoins", () => {
            Sound.play("coin");
            UI.coins();
            UI.pop($("#menuCoinPill"));
          }),
        250,
      );
    });
  }
  function isYesterday(s) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return s === d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function openDaily() {
    const c = dailyCfg();
    $("#dailySub").textContent =
      `Level ${c.n} with a twist. Serve ${c.goal} customers.${Save.d.dailyDone === today() ? " Bonus already collected today." : " Win for +250 bonus coins!"}`;
    bridge.dailyMods(c.mods);
    UI.open("ovDaily");
    bridge.bind("#dailyGo", () => {
      UI.close("ovDaily");
      Game.start(dailyCfg());
    });
  }

  /* wire buttons */
  const on = (s, f) =>
    bridge.bind(s, (e) => {
      Sound.init();
      f(e);
    });
  on("#btnPlay", () => {
    Sound.play("click");
    openMap();
  });
  on("#mapBack", () => {
    Sound.play("click");
    showMenu();
  });
  on("#btnShop", () => {
    Sound.play("click");
    buildShop();
    UI.open("ovShop");
  });
  on("#shopClose", () => {
    UI.close("ovShop");
    UI.coins();
  });
  on("#tabUp", () => {
    shopTab = "up";
    $("#tabUp").classList.add("on");
    $("#tabStyle").classList.remove("on");
    buildShop();
  });
  on("#tabStyle", () => {
    shopTab = "style";
    $("#tabStyle").classList.add("on");
    $("#tabUp").classList.remove("on");
    buildShop();
  });
  on("#btnSettings", () => {
    syncToggles();
    $("#sReset .buttonLabel").textContent = "Reset progress";
    UI.open("ovSettings");
  });
  on("#sClose", () => UI.close("ovSettings"));
  on("#btnDaily", () => {
    Sound.play("click");
    openDaily();
  });
  on("#dailyClose", () => UI.close("ovDaily"));
  on("#btnEndless", () => {
    if (Save.d.unlocked > 50) Game.start(endlessCfg());
    else {
      Sound.play("wrong");
      UI.toast("Beat Level 50 to unlock Endless Rush!");
    }
  });
  on("#btnPause", () => Game.pause());
  on("#pResume", () => Game.resume());
  on("#pRestart", () => {
    UI.close("ovPause");
    Game.start(
      Game.cfg.mode === "daily"
        ? dailyCfg()
        : Game.cfg.mode === "endless"
          ? endlessCfg()
          : levelCfg(Game.cfg.n),
    );
  });
  on("#pMenu", () => {
    UI.close("ovPause");
    Game.cfg.mode === "level" ? (Game.clear(), openMap()) : showMenu();
  });
  const toggleSound = () => {
    Save.d.sound = !Save.d.sound;
    Save.save();
    syncToggles();
    Sound.play("click");
  };
  const toggleMusic = () => {
    Save.d.music = !Save.d.music;
    Save.save();
    syncToggles();
    Sound.setMusic(Save.d.music);
  };
  on("#pSound", toggleSound);
  on("#sSound", toggleSound);
  on("#pMusic", toggleMusic);
  on("#sMusic", toggleMusic);
  on("#sQuality", () => {
    Save.d.quality = HQ() ? "low" : "high";
    Save.save();
    syncToggles();
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, HQ() ? 2 : 1.25),
    );
    sun.castShadow = HQ();
    fitCamera();
  });
  on("#sReset", (e) => {
    const b = e.currentTarget;
    if (b.dataset.arm) {
      Save.d = Save.defaults();
      Save.save();
      delete b.dataset.arm;
      b.querySelector(".buttonLabel").textContent = "Progress reset";
      buildChef();
      envKey = "";
      showMenu();
      UI.close("ovSettings");
      UI.toast("Fresh start! Your buka awaits.");
    } else {
      b.dataset.arm = 1;
      b.querySelector(".buttonLabel").textContent =
        "Tap again to erase everything";
      setTimeout(() => {
        delete b.dataset.arm;
        b.querySelector(".buttonLabel").textContent = "Reset progress";
      }, 3000);
    }
  });
  on("#winNext", () => {
    UI.close("ovWin");
    const n = Game.cfg.n + 1;
    if (n > 50) {
      Game.clear();
      showMenu();
      UI.toast("Endless Rush unlocked!");
    } else Game.start(levelCfg(n));
  });
  on("#winRetry", () => {
    UI.close("ovWin");
    const c = Game.cfg;
    Game.start(
      c.mode === "daily"
        ? dailyCfg()
        : c.mode === "endless"
          ? endlessCfg()
          : levelCfg(c.n),
    );
  });
  on("#winMap", () => {
    UI.close("ovWin");
    Game.clear();
    Game.cfg.mode === "level" ? openMap() : showMenu();
  });
  on("#failRetry", () => {
    UI.close("ovFail");
    const c = Game.cfg;
    Game.start(c.mode === "daily" ? dailyCfg() : levelCfg(c.n));
  });
  on("#failMap", () => {
    UI.close("ovFail");
    Game.clear();
    Game.cfg.mode === "level" ? openMap() : showMenu();
  });

  /* ================= MAIN LOOP ================= */
  let last = performance.now(),
    T = 0,
    strollT = 2,
    slowFrames = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    T += dt;
    if (Game.state !== "paused") {
      Game.update(dt);
      if (Game.state === "menu" || Game.state === "map") {
        strollT -= dt;
        if (strollT <= 0 && Game.strollers.length < 5) {
          strollT = rnd(1.5, 3.5);
          Game.strollers.push(new Stroller());
        }
        for (let i = Game.strollers.length - 1; i >= 0; i--) {
          const s = Game.strollers[i];
          s.update(dt);
          if (s.dead) {
            s.dispose();
            Game.strollers.splice(i, 1);
          }
        }
      }
      updateChef(dt, T);
      updateSteam(dt);
      updateParticles(dt);
      updateFlyers(dt);
      for (const id in stations) {
        const s = stations[id];
        if (s.userData.bounce > 0) {
          s.userData.bounce = Math.max(0, s.userData.bounce - dt * 4);
          const b = s.userData.bounce;
          s.userData.dish.scale.setScalar(
            0.95 * (1 + Math.sin(b * Math.PI) * 0.35),
          );
          s.userData.dish.position.y = Math.sin(b * Math.PI) * 0.25;
        }
      }
      dyn.forEach((d) => {
        if (d.type === "drive") {
          d.x += (d.dir || 1) * d.speed * dt;
          if (d.x > 16) d.x = -16;
          if (d.x < -16) d.x = 16;
          d.o.position.set(d.x, 0, d.z);
          d.o.rotation.y = (d.dir || 1) > 0 ? 0 : Math.PI;
          d.o.position.y = Math.abs(Math.sin(T * 12)) * 0.03;
        } else if (d.type === "flag")
          d.o.rotation.x = Math.sin(T * 3 + d.ph) * 0.25;
        else if (d.type === "bob")
          d.o.position.y = d.y + Math.sin(T * 1.5 + d.ph) * 0.12;
        else if (d.type === "sway")
          d.o.rotation.z = Math.sin(T * 1.2 + d.ph) * 0.06;
      });
    }
    updateCamera(dt, T);
    renderer.render(scene, camera);
    // position customer bubbles
    for (const c of Game.customers) {
      const a = _v
        .set(
          c.root.position.x,
          c.root.position.y +
            2.45 * (c.P.inner.scale.x || 1) +
            c.P.inner.position.y,
          c.root.position.z,
        )
        .project(camera);
      c.el.style.transform = `translate3d(${(((a.x + 1) / 2) * innerWidth).toFixed(1)}px,${(((1 - a.y) / 2) * innerHeight).toFixed(1)}px,0) translate(-50%,-100%)`;
    }
    updateConfetti(dt);
    Sound.tick();
    // graceful degradation on slow devices
    if (dt > 0.03 && HQ()) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 120 && renderer.getPixelRatio() > 1) {
      renderer.setPixelRatio(1);
      slowFrames = 0;
      fitCamera();
    }
  }

  /* ================= BOOT ================= */
  function boot() {
    initGeo();
    makeThumbs();
    buildChef();
    fitCamera();
    showMenu();
    requestAnimationFrame((t) => {
      last = t;
      requestAnimationFrame(loop);
    });
    setTimeout(() => $("#boot").classList.add("gone"), 200);
    // expose a tiny debug hook for testing
    if (import.meta.env.DEV) window.__mp = { Game, Save, levelCfg, FOODS };
  }
  const fontsReady =
    document.fonts && document.fonts.load
      ? Promise.all([
          document.fonts.load('100px "Lilita One"'),
          document.fonts.load('800 20px "Baloo 2"'),
        ]).catch(() => {})
      : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(
    () => {
      if (lifetime.disposed) return;
      try {
        boot();
      } catch (e) {
        console.error(e);
        $("#bootMsg").textContent =
          "Something went wrong while loading: " + e.message;
      }
    },
  );

  // Dispose all shared and detached resources, including cached procedural templates.
  cleanupScene = () => {
    Game.clear();
    const geometries = new Set(Object.values(GC)),
      materials = new Set(Object.values(MC)),
      textures = new Set(Object.values(TEXC));
    const collect = (o) => {
      if (o.geometry) geometries.add(o.geometry);
      for (const m of [o.material].flat().filter(Boolean)) {
        materials.add(m);
        for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      }
    };
    retired.geometries.forEach((g) => geometries.add(g));
    retired.materials.forEach((m) => materials.add(m));
    retired.textures.forEach((t) => textures.add(t));
    scene.traverse(collect);
    Object.values(FOOD_TPL).forEach((o) => o.traverse(collect));
    if (GEO) Object.values(GEO).forEach((g) => geometries.add(g));
    [pGeo, steamGeo].forEach((g) => geometries.add(g));
    [
      ...ANKARA_MATS,
      ...ASO_MATS,
      ...pMats,
      ...SKINS,
      MAT_EYE,
      MAT_PUP,
      MAT_HL,
      MAT_MOUTH,
      MAT_BROW,
      MAT_CHEEK,
      MAT_HAIR,
      MAT_SHOE,
    ].forEach((m) => {
      materials.add(m);
      if (m.map) textures.add(m.map);
    });
    sun.shadow.map?.dispose();
    geometries.forEach((g) => g.dispose());
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
    // React hot reload can reuse this canvas immediately; keep its context reusable.
    renderer.dispose();
  };
  return cleanup;
}
