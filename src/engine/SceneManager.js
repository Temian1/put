import * as T3 from "three";
import { serviceLoad } from "../game/serviceLoad.js";
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
  STAFF,
  BOOSTERS,
  CUSTOMER_TYPES,
  MOODS,
  NAMES,
  STOCK,
  UNLOCKS,
  FOOD_COST,
  EVENTS,
  TIERS,
  PLACES,
  MAX_LEVEL,
} from "../game/data.js";
import { UNPAID_LIMIT } from "../game/staff.js";
import {
  JOBS,
  CREW_LIMIT,
  crewAt,
  onShift,
  roleCount as crewCount,
  managerAt,
  canHire,
  hire as hireCrew,
  sack as sackCrew,
  toggleDuty,
  wageBill as crewWages,
  runBranches,
  workDay,
  payMember,
  payAll,
  owedAt,
  owedTotal,
  daysToPayday,
  dayOfMonth,
  monthOf,
  MONTH_DAYS,
  QUIT_STRIKES,
  UNPAID_SLOWDOWN,
  earnWhileAway,
  isOpenAt,
  OPEN_HOUR,
  CLOSE_HOUR,
  tillAt,
  tillTotal,
  collect as collectTill,
} from "../game/crew.js";
import {
  REP,
  clampRep,
  spawnFactor,
  repTipFactor,
  tierOf,
  nextTier,
  canOpen,
  openBranch,
  levelOpen,
  placeOfLevel,
} from "../game/growth.js";
import {
  makeOnlineOrder,
  makeEventOrder,
  packNeeds,
  packFill,
  packComplete,
  packsFor,
  portions,
  orderValue,
  tickOrders,
  createRiders,
  dispatch,
  tickRiders,
  PACK_COST,
} from "../game/deliveries.js";
import { createSave, migrate } from "../systems/SaveManager.js";
import { createAudio } from "../systems/AudioManager.js";
import { createHaptics } from "../systems/Haptics.js";
import {
  mergeSaves,
  encodeBackup,
  decodeBackup,
} from "../systems/CloudSave.js";
import { scoreOrder, tipFor } from "../game/scoring.js";
import {
  needsFood,
  blockedFood,
  fillOrder,
  orderComplete,
  baseReady,
  nextNeeded,
} from "../game/OrderSystem.js";
import { buildOrder, toItems } from "../game/recipes.js";
import {
  createCooker,
  tickCooker,
  tapCooker,
  hasPortion,
  takePortion,
  cookerProgress,
  createSink,
  sinkFull,
  addPlate,
  tickSink,
  startWash,
} from "../game/kitchen.js";
import {
  pickCustomerType,
  pickMood,
  customerTraits,
} from "../game/customers.js";
import {
  ACHIEVEMENTS,
  ensureDaily,
  track,
  claimable,
  claim as claimMission,
  achievementProgress,
} from "../game/missions.js";
import { fmtNaira, fmtNairaShort, roundNaira } from "../game/currency.js";
import { createOnline } from "../systems/Online.js";
import { createLagosLife, lagosLifeHinted } from "../systems/LagosLife.js";
import { applyGrants, grantLabel } from "../game/grants.js";
import { tablesAt, canPlace, saveLayout, snap } from "../game/layout.js";
import { styleFor } from "../game/styles.js";
import {
  waveOf,
  waveDone,
  waveCount,
  PRIORITIES,
  DEFAULT_PRIORITY,
  serverOrder,
  cookAhead,
  specialsFor,
  plateQuality,
  specialPrice,
} from "../game/service.js";
import {
  pricing,
  activeEffects,
  drawOpportunity,
  cardById,
  decide,
  resolveDecisions,
  payLoans,
  averageAt,
  contractOffers,
  drawDisruption,
  PRICE_LEVELS,
  PRICE_SENSITIVITY,
} from "../game/decisions.js";
import {
  shiftInsights,
  recordDay,
  bookSummary,
  plateCosts,
  MENTOR,
  TARGETS,
} from "../game/insights.js";
import { LIVE, applyLiveConfig } from "../game/live.js";
import {
  EQUIPMENT,
  effects,
  upkeep as upkeepCost,
  buyEquipment,
  level as equipLevel,
  equipAt,
  BUS_HIRE,
} from "../game/equipment.js";
import {
  INGREDIENTS,
  FOOD_GROUP,
  price as marketPrice,
  isOut,
  buy as marketBuy,
  ingredientsForBatch,
  batchUnits,
  plateCost,
  batchOf as foodBatch,
  advanceMarket,
} from "../game/market.js";
import {
  RENT,
  taxes,
  hygieneScore,
  inspect,
  inspectorMood,
  offerInspector,
  begInspector,
  INSPECTOR_LINES,
  makeOffer,
  haggle as haggleOutcome,
  absenceDecay,
  settleDebt,
} from "../game/business.js";
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
  const Haptics = createHaptics(Save, navigator, REDUCED);
  // Kikter backend: account, live settings, cloud save, shifts, leaderboard.
  // The last settings received are applied straight away for offline play.
  const Online = createOnline();
  // Lagos Life (Vatar SDK) when the game is embedded there.
  const Lagos = createLagosLife();
  applyLiveConfig(Online.cachedConfig());
  const syncPrices = () => {
    for (const id in FOODS) FOODS[id].price = FOOD_DATA[id].price;
  };
  syncPrices();
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
  // Bright storybook daylight: sky-blue fill from above, green bounce from
  // the lawns, a warm sun with soft shadows.
  const hemi = new T3.HemisphereLight(0xe6f4ff, 0x9fc46e, 0.95);
  scene.add(hemi);
  const sun = new T3.DirectionalLight(0xfff4de, 1.15);
  sun.position.set(6, 12, 8);
  sun.castShadow = HQ();
  sun.shadow.mapSize.set(HQ() ? 2048 : 1024, HQ() ? 2048 : 1024);
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
  const fillL = new T3.DirectionalLight(0xcfe9ff, 0.22);
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
    zobo(g) {
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
    whiterice(g) {
      plate(g);
      const r = mesh(dome(0.26), M("#F7F3E8", { roughness: 0.95 }), 0, 0.06, 0);
      r.scale.y = 0.7;
      g.add(r);
      const st = mesh(
        sph(0.17, 16, 10),
        M("#C1301C", { roughness: 0.35 }),
        0.03,
        0.2,
        0.02,
      );
      st.scale.set(1, 0.28, 0.9);
      g.add(st);
      sprinkle(g, 0.12, 0.23, 0.01, ["#7A1E0E", "#F08A2C"], 6, 0.03);
    },
    beans(g) {
      bowl(g, "#F2E6CF");
      g.add(
        mesh(
          cyl(0.27, 0.27, 0.03, 24),
          M("#8B4A2B", { roughness: 0.85 }),
          0,
          0.2,
          0,
        ),
      );
      sprinkle(g, 0.24, 0.21, 0.015, ["#7A3E22", "#9C5631"], 14, 0.04);
      const s = mesh(
        sph(0.12, 14, 10),
        M("#4A140A", { roughness: 0.3 }),
        0.02,
        0.24,
        0.02,
      );
      s.scale.set(1, 0.3, 1);
      g.add(s);
    },
    eba(g) {
      plate(g);
      const d = mesh(
        sph(0.21, 20, 14),
        M("#E8C15A", { roughness: 0.4 }),
        0,
        0.13,
        0,
      );
      d.scale.set(1, 0.72, 1);
      g.add(d);
    },
    peppersoup(g) {
      bowl(g, "#3B2A20");
      g.add(
        mesh(
          cyl(0.27, 0.27, 0.02, 24),
          M("#A8401C", { roughness: 0.2 }),
          0,
          0.2,
          0,
        ),
      );
      [
        [0.08, 0.05],
        [-0.1, 0.02],
        [0.01, -0.11],
      ].forEach(([x, z], i) => {
        const m = mesh(
          box(0.11, 0.08, 0.09),
          M("#6B3418", { roughness: 0.7 }),
          x,
          0.23,
          z,
        );
        m.rotation.y = i;
        g.add(m);
      });
      sprinkle(g, 0.24, 0.22, 0.005, ["#2E7D32", "#C62828"], 8, 0.03);
    },
    efo(g) {
      bowl(g);
      g.add(
        mesh(
          cyl(0.27, 0.27, 0.03, 24),
          M("#2E6B26", { roughness: 0.8 }),
          0,
          0.205,
          0,
        ),
      );
      sprinkle(
        g,
        0.25,
        0.22,
        0.012,
        ["#1B5E20", "#D84315", "#43A047"],
        14,
        0.035,
      );
      const m = mesh(box(0.1, 0.08, 0.09), M("#7A3B1A"), -0.05, 0.24, 0.05);
      m.rotation.y = 0.7;
      g.add(m);
    },
    ewedu(g) {
      bowl(g);
      const half = (start) =>
        G(
          "half" + start,
          () =>
            new T3.CylinderGeometry(
              0.27,
              0.27,
              0.03,
              20,
              1,
              false,
              start,
              Math.PI,
            ),
        );
      g.add(mesh(half(0), M("#4F8F2F", { roughness: 0.7 }), 0, 0.205, 0));
      g.add(mesh(half(Math.PI), M("#C9A15A", { roughness: 0.8 }), 0, 0.205, 0));
      const st = mesh(
        sph(0.07, 12, 8),
        M("#B3261E", { roughness: 0.3 }),
        0,
        0.225,
        0,
      );
      st.scale.set(1, 0.3, 1);
      g.add(st);
    },
    beef(g) {
      plate(g, 0.28);
      [
        [-0.08, -0.04, 0.3],
        [0.09, -0.02, 1.1],
        [0, 0.1, 2],
      ].forEach(([x, z, r]) => {
        const m = mesh(
          rbox(0.15, 0.11, 0.13, 0.03),
          M("#6E2F14", { roughness: 0.35 }),
          x,
          0.12,
          z,
        );
        m.rotation.y = r;
        g.add(m);
      });
      sprinkle(g, 0.18, 0.18, 0.01, ["#C1301C"], 5, 0.03);
    },
    chicken(g) {
      plate(g);
      drumstick(g, -0.1, 0.02, 0.5);
      drumstick(g, 0.1, -0.04, -0.6);
      const t = mesh(
        sph(0.11, 12, 10),
        M("#B8641F", { roughness: 0.55 }),
        0.02,
        0.12,
        0.13,
      );
      t.scale.set(1.2, 0.6, 0.9);
      g.add(t);
    },
    fish(g) {
      plate(g);
      const f = new T3.Group();
      const body = mesh(
        sph(0.2, 18, 12),
        M("#8A6438", { roughness: 0.5 }),
        0,
        0,
        0,
      );
      body.scale.set(1.25, 0.42, 0.55);
      f.add(body);
      const tail = mesh(cone(0.1, 0.16, 4), M("#6E4A26"), -0.3, 0, 0);
      tail.rotation.z = Math.PI / 2;
      tail.scale.set(1, 1, 0.3);
      f.add(tail);
      f.add(mesh(sph(0.025, 8, 6), M("#F4F1E8"), 0.17, 0.04, 0.07));
      f.position.set(0.03, 0.12, 0);
      f.rotation.y = 0.4;
      g.add(f);
    },
    egg(g) {
      plate(g, 0.24);
      [-0.08, 0.08].forEach((x, i) => {
        const w = mesh(
          sph(0.1, 14, 10),
          M("#FBF8F0", { roughness: 0.3 }),
          x,
          0.08,
          0,
        );
        w.scale.set(0.8, 0.5, 1.1);
        w.rotation.y = i ? 0.4 : -0.4;
        g.add(w);
        const y = mesh(
          sph(0.05, 10, 8),
          M("#F2B71E", { roughness: 0.5 }),
          x,
          0.12,
          0,
        );
        y.scale.set(1, 0.4, 1);
        g.add(y);
      });
    },
    moimoi(g) {
      plate(g);
      const leaf = mesh(
        sph(0.26, 14, 8),
        M("#4E8B3A", { roughness: 0.6 }),
        0,
        0.07,
        0,
      );
      leaf.scale.set(1, 0.12, 0.8);
      g.add(leaf);
      g.add(
        mesh(
          cyl(0.15, 0.18, 0.15, 18),
          M("#E0683A", { roughness: 0.8 }),
          0,
          0.15,
          0,
        ),
      );
      const e = mesh(sph(0.05, 10, 8), M("#FBF8F0"), 0.03, 0.23, 0.02);
      e.scale.set(1, 0.4, 1);
      g.add(e);
    },
    water(g) {
      const s = mesh(
        rbox(0.4, 0.07, 0.3, 0.035),
        new T3.MeshStandardMaterial({
          color: "#CDEBFF",
          roughness: 0.15,
          transparent: true,
          opacity: 0.85,
        }),
        0,
        0.05,
        0,
      );
      g.add(s);
      g.add(mesh(box(0.3, 0.072, 0.07), M("#1E78C8"), 0, 0.055, 0.02, false));
      g.add(mesh(box(0.3, 0.073, 0.02), M("#E53935"), 0, 0.056, -0.05, false));
    },
    mineral(g) {
      g.add(
        mesh(
          cyl(0.11, 0.12, 0.34, 16),
          M("#C62828", { roughness: 0.15, metalness: 0.1 }),
          0,
          0.17,
          0,
        ),
      );
      g.add(
        mesh(
          cyl(0.122, 0.122, 0.11, 16),
          M("#FFFFFF", { roughness: 0.4 }),
          0,
          0.17,
          0,
        ),
      );
      g.add(
        mesh(
          cyl(0.045, 0.1, 0.12, 12),
          M("#C62828", { roughness: 0.15 }),
          0,
          0.4,
          0,
        ),
      );
      g.add(mesh(cyl(0.05, 0.05, 0.05, 12), M("#B71C1C"), 0, 0.48, 0));
    },
    malt(g) {
      g.add(
        mesh(
          cyl(0.11, 0.11, 0.34, 16),
          M("#3A2210", { roughness: 0.1, metalness: 0.2 }),
          0,
          0.17,
          0,
        ),
      );
      g.add(
        mesh(
          cyl(0.113, 0.113, 0.12, 16),
          M("#C9A227", { roughness: 0.35, metalness: 0.5 }),
          0,
          0.16,
          0,
        ),
      );
      g.add(
        mesh(
          cyl(0.04, 0.1, 0.14, 12),
          M("#3A2210", { roughness: 0.1 }),
          0,
          0.41,
          0,
        ),
      );
      g.add(
        mesh(
          cyl(0.048, 0.048, 0.04, 12),
          M("#E3B341", { metalness: 0.6, roughness: 0.3 }),
          0,
          0.49,
          0,
        ),
      );
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
  // Rubbish customers drop on the dining floor: a nylon bag, a pure water
  // sachet, a chicken bone or a paper wrap.
  const LITTER_KINDS = ["nylon", "sachet", "bone", "paper"];
  function litterModel(kind) {
    const key = "__litter_" + kind;
    if (!FOOD_TPL[key]) {
      const g = new T3.Group();
      if (kind === "nylon") {
        const b = mesh(sph(0.11, 8, 6), M("#2F80ED", { roughness: 0.5 }));
        b.scale.set(1.2, 0.55, 0.9);
        b.position.y = 0.06;
        g.add(b);
      } else if (kind === "sachet") {
        g.add(
          mesh(
            rbox(0.2, 0.02, 0.13, 0.01),
            M("#DDEFFF", { roughness: 0.2, transparent: true, opacity: 0.8 }),
            0,
            0.02,
            0,
          ),
        );
      } else if (kind === "bone") {
        const b = mesh(cyl(0.025, 0.025, 0.2, 6), M("#F3E6C8"), 0, 0.03, 0);
        b.rotation.z = Math.PI / 2;
        g.add(b);
        g.add(mesh(sph(0.04, 6, 5), M("#F3E6C8"), 0.1, 0.03, 0));
        g.add(mesh(sph(0.04, 6, 5), M("#F3E6C8"), -0.1, 0.03, 0));
      } else {
        const b = mesh(sph(0.09, 7, 5), M("#F1E3C2", { roughness: 1 }));
        b.scale.set(1, 0.6, 1);
        b.position.y = 0.05;
        g.add(b);
      }
      FOOD_TPL[key] = g;
    }
    return FOOD_TPL[key].clone();
  }
  // Empty plate left behind with smears of stew, waiting to be cleared.
  function dirtyPlate() {
    if (!FOOD_TPL.__dirty) {
      const g = new T3.Group();
      plate(g, 0.3);
      [
        [0.06, 0.04, 0.09],
        [-0.09, -0.05, 0.06],
        [0.02, -0.1, 0.05],
      ].forEach(([x, z, r]) => {
        const s = mesh(
          sph(r, 10, 6),
          M("#B5461F", { roughness: 0.9 }),
          x,
          0.065,
          z,
          false,
        );
        s.scale.y = 0.08;
        g.add(s);
      });
      g.add(mesh(sph(0.03, 6, 4), M("#F7F3E8"), -0.04, 0.075, 0.08, false));
      FOOD_TPL.__dirty = g;
    }
    return FOOD_TPL.__dirty.clone();
  }
  // Optional painted UI art: public/ui/manifest.json maps keys such as
  // "staff:emeka", "online", "event:burial" or "place:yaba" to image files.
  const ART = {};
  function loadUiArt() {
    const base = import.meta.env.BASE_URL + "ui/";
    return fetch(base + "manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((list) => {
        for (const [k, file] of Object.entries(list)) ART[k] = base + file;
      })
      .catch(() => {});
  }
  // Optional painted food art: list files in public/food/manifest.json, e.g.
  // {"jollof": "jollof.webp"}. Missing entries keep the generated 3D thumbnail.
  function loadFoodArt() {
    const base = import.meta.env.BASE_URL + "food/";
    return fetch(base + "manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((list) =>
        Promise.all(
          Object.entries(list).map(
            ([id, file]) =>
              FOODS[id] &&
              new Promise((done) => {
                const img = new Image();
                img.onload = () => {
                  FOODS[id].img = base + file;
                  done();
                };
                img.onerror = done;
                img.src = base + file;
              }),
          ),
        ),
      )
      .catch(() => {});
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
      if (FOODS[id].img) continue;
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
      leg: caps(0.1, 0.2),
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
    const feet = [-0.17, 0.17].map((x) => {
      const f = mesh(GEO.foot, MAT_SHOE, x, 0.07, 0.1);
      f.scale.set(0.9, 0.55, 1.3);
      inner.add(f);
      return f;
    });
    // Legs show only when seated: thighs along the chair seat, shins down
    // to the feet, so a sitting body joins the floor instead of floating.
    const legs = new T3.Group();
    [-0.16, 0.16].forEach((x) => {
      const thigh = mesh(GEO.leg, bm, x, 0.24, 0.17);
      thigh.rotation.x = Math.PI / 2;
      legs.add(thigh);
      legs.add(mesh(GEO.leg, bm, x, 0.05, 0.34));
    });
    legs.visible = false;
    inner.add(legs);
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
    } else if (hat === "helmet") {
      const h = mesh(
        GEO.afro,
        M(o.accent, { roughness: 0.25 }),
        0,
        0.03,
        -0.02,
      );
      h.rotation.x = -0.35;
      h.scale.setScalar(1.08);
      head.add(h);
      const visor = mesh(
        box(0.5, 0.05, 0.16),
        M("#263238", { roughness: 0.2 }),
        0,
        0.24,
        0.3,
      );
      visor.rotation.x = 0.35;
      head.add(visor);
    } else if (hat === "cap") {
      const c = mesh(GEO.afro, acc, 0, 0.08, -0.02);
      c.rotation.x = -0.2;
      c.scale.set(0.95, 0.8, 0.95);
      head.add(c);
      const brim = mesh(cyl(0.2, 0.2, 0.03, 16), acc, 0, 0.21, 0.3);
      brim.scale.set(1, 1, 0.75);
      head.add(brim);
    } else if (hat === "kufi") {
      head.add(
        mesh(
          cyl(0.3, 0.32, 0.18, 18),
          M("#FFFFFF", { roughness: 0.8 }),
          0,
          0.3,
          -0.02,
        ),
      );
      head.add(mesh(cyl(0.305, 0.305, 0.04, 18), acc, 0, 0.25, -0.02));
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
      feet,
      legs,
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
      sky: ["#5DBBF6", "#E2F5FF"],
      ground: "#5A9C3B",
      floor: ["#F7E3C3", "#EBC896"],
      counter: "#B86B35",
      top: "#FFE9C7",
      trim: "#12A99F",
      tray: "#FF5A5F",
      bench: "#8B4F2A",
      sign: ["MAMA PUT", "Roadside Buka"],
      signBg: "#12A99F",
      light: [0.66, 0.92],
    },
    {
      sky: ["#56B4F3", "#DDF2FF"],
      ground: "#57983A",
      floor: ["#FFF1D6", "#9FD6CF"],
      counter: "#12A99F",
      top: "#FFF4DE",
      trim: "#FF7A1A",
      tray: "#FFC531",
      bench: "#5E6B73",
      sign: ["JUNCTION SPOT", "Mama Put • Chop Better"],
      signBg: "#FF7A1A",
      light: [0.66, 0.92],
    },
    {
      sky: ["#6CC4F8", "#E6F7FF"],
      ground: "#62A443",
      floor: ["#FFFFFF", "#FFD9B0"],
      counter: "#FF5A5F",
      top: "#FFF4DE",
      trim: "#FFC531",
      tray: "#12A99F",
      bench: "#4E4A57",
      sign: ["SWALLOW JOINT", "Mama Put Stall 12 • Amala Spot"],
      signBg: "#FF5A5F",
      light: [0.66, 0.92],
    },
    {
      sky: ["#7FCBFA", "#FFF3E6"],
      ground: "#5A9E48",
      floor: ["#FFF4DE", "#F3D9A4"],
      counter: "#6B2D8C",
      top: "#FFF4DE",
      trim: "#FFC531",
      tray: "#FFC531",
      bench: "#4B2A5E",
      sign: ["OWAMBE CATERING", "Mama Put • Party Jollof Specialist"],
      signBg: "#7B2E8E",
      light: [0.66, 0.92],
    },
    {
      sky: ["#3B2E6E", "#FF9E6B"],
      ground: "#4F7C47",
      floor: ["#F4EFE6", "#D9D2C5"],
      counter: "#0F4C5C",
      top: "#F4EFE6",
      trim: "#FFC531",
      tray: "#FFC531",
      bench: "#1F2A36",
      sign: ["MAMA PUT EMPIRE", "From Roadside Buka to Food Empire"],
      signBg: "#0F4C5C",
      light: [0.55, 0.72],
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
  function floorTex(t, i, key = i) {
    return canvasTex(
      "floor" + key,
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
  function skyTex(t, i, key = i) {
    return canvasTex("sky" + key, 4, 256, (x) => {
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
  // A miniature town house: framed windows, a front door with a striped
  // awning, and a pitched roof on low buildings (flat with a parapet on
  // tall ones).
  const ROOFS = ["#C8553D", "#3E7CB1", "#8E5B3E", "#2F8F6B", "#B5473A"];
  function building(g, x, z, w, h, d, c, win, roof) {
    const b = new T3.Group();
    b.position.set(x, 0, z);
    b.add(mesh(rbox(w, h, d, 0.06), M(c), 0, h / 2, 0));
    const cols = Math.max(1, Math.floor(w / 0.9)),
      rows = Math.max(1, Math.floor((h - 1.6) / 1.1));
    const frame = M("#FFFDF5", { roughness: 0.5 }),
      glass = M(win || "#7FC8E8", { roughness: 0.15 });
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const wx = -w / 2 + ((i + 0.5) * w) / cols,
          wy = 1.9 + j * 1.1;
        b.add(
          mesh(
            rbox(0.62, 0.72, 0.05, 0.03),
            frame,
            wx,
            wy,
            d / 2 + 0.01,
            false,
          ),
        );
        b.add(
          mesh(rbox(0.5, 0.6, 0.06, 0.04), glass, wx, wy, d / 2 + 0.03, false),
        );
      }
    // Front door and a little striped awning over it.
    b.add(
      mesh(
        rbox(0.7, 1.2, 0.08, 0.05),
        M("#7A4B2A"),
        0,
        0.6,
        d / 2 + 0.02,
        false,
      ),
    );
    for (let k = 0; k < 4; k++)
      b.add(
        mesh(
          rbox(0.25, 0.05, 0.42, 0.01),
          M(k % 2 ? "#FFFFFF" : "#FF5A5F"),
          -0.375 + k * 0.25,
          1.32,
          d / 2 + 0.2,
          false,
        ),
      );
    const rc = roof || ROOFS[Math.abs(Math.round(x * 3 + z)) % ROOFS.length];
    if (h <= 6.5) {
      const r = mesh(
        cone(0.72, 1, 4),
        M(rc, { roughness: 0.55 }),
        0,
        h + 0.55,
        0,
      );
      r.rotation.y = Math.PI / 4;
      r.scale.set(w * 1.02, 1.1, d * 1.02);
      b.add(r);
    } else
      b.add(mesh(rbox(w + 0.3, 0.22, d + 0.3, 0.05), M(rc), 0, h + 0.06, 0));
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
  // Dispatch rider: okada with a red delivery box, rider in a helmet.
  function okada(g) {
    const k = new T3.Group();
    [-0.55, 0.55].forEach((x) => {
      const w = mesh(tor(0.24, 0.07, 8, 16), M("#1E1E1E"), x, 0.3, 0);
      k.add(w);
    });
    k.add(
      mesh(
        rbox(1.0, 0.22, 0.26, 0.08),
        M("#C62828", { roughness: 0.3 }),
        0,
        0.55,
        0,
      ),
    );
    k.add(mesh(rbox(0.5, 0.1, 0.3, 0.05), M("#222222"), -0.12, 0.72, 0));
    const bar = mesh(
      cyl(0.025, 0.025, 0.6, 6),
      M("#9E9E9E", { metalness: 0.6 }),
      0.5,
      0.85,
      0,
    );
    bar.rotation.x = Math.PI / 2;
    k.add(bar);
    k.add(
      mesh(
        rbox(0.42, 0.4, 0.42, 0.05),
        M("#E53935", { roughness: 0.4 }),
        -0.5,
        0.98,
        0,
      ),
    );
    k.add(mesh(rbox(0.43, 0.08, 0.43, 0.03), M("#FFC531"), -0.5, 0.98, 0));
    const P = makePerson({
      skin: pick(SKINS),
      bodyMat: M("#2FA34F", { roughness: 0.7 }),
      accent: "#FFC531",
      hat: "helmet",
      scale: 0.62,
    });
    P.root.position.set(-0.1, 0.3, 0);
    P.root.rotation.y = Math.PI / 2;
    P.armL.rotation.x = P.armR.rotation.x = -1.3;
    k.add(P.root);
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

  // `styleKey` is the restaurant (ch0..ch9) or "endless": each has its own
  // colours, furniture and decorations on top of the chapter theme.
  function buildEnv(ci, sign, styleKey = Save.d.place) {
    const style = styleFor(styleKey);
    // Equipment and business size change the buka, so they are part of the key.
    const decorKey =
      ci +
      "|" +
      styleKey +
      "|" +
      (sign || "") +
      "|" +
      Save.d.decor.slice().sort().join() +
      "|" +
      JSON.stringify(tablesAt(Save.d, Save.d.place)) +
      "|" +
      JSON.stringify(equipAt(Save.d)) +
      "|" +
      tierOf(Save.d);
    if (env && envKey === decorKey) return;
    envKey = decorKey;
    if (env) {
      retainResources(env);
      scene.remove(env);
    }
    dyn.length = 0;
    env = new T3.Group();
    scene.add(env);
    const t = {
      ...THEMES[ci],
      ...(style.colors || {}),
      ...(sign ? { sign } : {}),
    };
    const texKey = ci + "-" + styleKey;
    scene.background = skyTex(t, ci, texKey);
    scene.fog = new T3.Fog(new T3.Color(t.sky[1]), 34, 70);
    hemi.intensity = t.light[0];
    sun.intensity = t.light[1];
    sun.color.set(ci === 4 ? "#FFC59A" : "#FFF0D8");
    // A lawn with soft blades of lighter and darker grass.
    const ground = mesh(
      G("ground", () => new T3.PlaneGeometry(120, 120)),
      new T3.MeshStandardMaterial({
        map: canvasTex(
          "grass" + t.ground,
          128,
          128,
          (x) => {
            x.fillStyle = t.ground;
            x.fillRect(0, 0, 128, 128);
            const base = new T3.Color(t.ground);
            for (let k = 0; k < 260; k++) {
              const c = base
                .clone()
                .offsetHSL(0, 0, (k % 2 ? 0.06 : -0.05) * (0.5 + (k % 5) / 5));
              x.strokeStyle = "#" + c.getHexString();
              x.lineWidth = 1.5;
              const px = (k * 53) % 128,
                py = (k * 97) % 128;
              x.beginPath();
              x.moveTo(px, py);
              x.lineTo(px + ((k % 3) - 1) * 2, py - 4);
              x.stroke();
            }
          },
          [40, 40],
        ),
        roughness: 1,
      }),
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
      new T3.MeshStandardMaterial({
        map: floorTex(t, ci, texKey),
        roughness: 0.6,
      }),
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
    buildRenovation(env, effects(Save.d).building, t, ci);
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
      palm(env, 8, -3.1, 5.2);
      palm(env, -12.5, -7.4, 5);
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
        -5.1,
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
          -5.1,
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
      lamp(env, -4.4, -2.9);
      lamp(env, 4.4, -2.9);
      palm(env, -6.4, -2.95, 4.4);
      parasol(env, 7.9, -2.8, "#FFC531", "#12A99F");
      const k = keke(env);
      dyn.push({ o: k, type: "drive", z: -4.7, speed: 3.2, x: -14, len: 2 });
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
      dyn.push({
        o: d,
        type: "drive",
        z: -9.1,
        speed: 4,
        x: 16,
        dir: -1,
        len: 3.4,
      });
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
      // Endless keeps the middle clear for its scoreboard.
      (styleKey === "endless" ? [-4.4, 4.4] : [-4.4, 0, 4.4]).forEach((x) => {
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
    // Lit signboard: a row of warm bulbs and a glow over the sign.
    if (equipLevel(Save.d, "sign")) {
      const bulb = new T3.MeshBasicMaterial({ color: 0xfff1a8 });
      for (let i = 0; i < 13; i++)
        [-0.88, 0.88].forEach((y) =>
          sb.add(mesh(sph(0.06, 8, 6), bulb, -2.6 + i * 0.433, y, 0.12, false)),
        );
      const glow = new T3.PointLight(0xffd27a, 0.9, 7);
      glow.position.set(0, 0, 1.2);
      sb.add(glow);
    }
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
      tr.userData.pick = { type: "tray", lane: i };
      env.add(tr);
      trays.push(tr);
    }
    const eff = effects(Save.d);
    buildBackKitchen(env, eff);
    buildDining(env, eff, ci, style.furniture);
    buildExtras(env, style.extras || [], t, ci);
    buildGreenery(env, styleKey === "endless");
    buildTraffic(env, ci);
    buildGrowth(env, ci);
  }
  const trays = [];

  /* ---- back kitchen: the floor on the camera side of the bench ---- */
  const KITCHEN_Z = 3.4,
    BENCH_END = 4.15,
    SINK_POS = { x: -3.0, z: 3.5 },
    FRIDGE_POS = { x: 3.15, z: 3.45 },
    MARKET_EXIT = { x: 8, z: 3.3 },
    INSPECT_POS = { x: 0, z: -1.25 };
  function buildBackKitchen(g, eff) {
    const fl = mesh(
      G("bkfloor", () => new T3.PlaneGeometry(8.4, 1.5)),
      M("#E9E4DA", { roughness: 0.8 }),
      0,
      0.011,
      3.55,
      false,
    );
    fl.rotation.x = -Math.PI / 2;
    g.add(fl);
    // sink cabinet (one basin, two with the double sink)
    const wide = eff.sinkCap > 4;
    const sk = new T3.Group();
    sk.position.set(SINK_POS.x + (wide ? 0.25 : 0), 0, SINK_POS.z + 0.35);
    sk.add(
      mesh(
        rbox(wide ? 1.5 : 0.95, 0.82, 0.62, 0.05),
        M("#9FB3C8", { metalness: 0.4, roughness: 0.35 }),
        0,
        0.41,
        0,
      ),
    );
    [wide ? -0.36 : 0, ...(wide ? [0.36] : [])].forEach((x) => {
      sk.add(
        mesh(
          rbox(0.6, 0.06, 0.44, 0.03),
          M("#5E7184", { metalness: 0.6 }),
          x,
          0.82,
          0,
        ),
      );
      const tap = mesh(
        cyl(0.025, 0.025, 0.32, 6),
        M("#C0C8D0", { metalness: 0.8 }),
        x,
        1.0,
        -0.22,
      );
      sk.add(tap);
    });
    g.add(sk);
    if (eff.fridge) {
      const fr = new T3.Group();
      fr.position.set(FRIDGE_POS.x, 0, FRIDGE_POS.z + 0.3);
      fr.add(
        mesh(
          rbox(0.85, 1.5, 0.7, 0.08),
          M("#F4F7FA", { roughness: 0.3 }),
          0,
          0.75,
          0,
        ),
      );
      fr.add(
        mesh(
          rbox(0.06, 0.5, 0.05, 0.02),
          M("#9E9E9E", { metalness: 0.7 }),
          0.32,
          1.0,
          -0.37,
        ),
      );
      fr.add(mesh(box(0.8, 0.02, 0.02), M("#CFD8DC"), 0, 1.05, -0.36, false));
      g.add(fr);
    }
    // Open shelves so the stocked sacks are visible.
    const shelves = equipLevel(Save.d, "store");
    for (let i = 0; i < shelves; i++) {
      const sh = new T3.Group();
      sh.position.set(2.2 - i * 1.0, 0, 4.15);
      const wood = M("#8B5A2B", { roughness: 0.8 });
      [-0.44, 0.44].forEach((x) =>
        sh.add(mesh(box(0.06, 0.95, 0.36), wood, x, 0.475, 0)),
      );
      [0.3, 0.68].forEach((y) => {
        sh.add(mesh(box(0.94, 0.05, 0.38), wood, 0, y, 0));
        for (let k = 0; k < 3; k++) {
          const sack = mesh(
            sph(0.15, 10, 8),
            M(["#EDE2C8", "#C9A15A", "#D7CCC8"][(k + i) % 3], { roughness: 1 }),
            -0.28 + k * 0.28,
            y + 0.13,
            0,
          );
          sack.scale.set(1, 0.85, 0.8);
          sh.add(sack);
        }
      });
      g.add(sh);
    }
    if (equipLevel(Save.d, "handwash")) {
      const hw = new T3.Group();
      hw.position.set(-1.85, 0, 3.85);
      hw.add(
        mesh(
          cyl(0.26, 0.26, 0.7, 14),
          M("#1E78C8", { roughness: 0.4 }),
          0,
          0.55,
          0,
        ),
      );
      hw.add(mesh(cyl(0.18, 0.22, 0.2, 10), M("#455A64"), 0, 0.1, 0));
      hw.add(
        mesh(
          cyl(0.02, 0.02, 0.18, 6),
          M("#C0C8D0", { metalness: 0.8 }),
          0,
          0.45,
          -0.28,
        ),
      );
      hw.add(mesh(cyl(0.18, 0.15, 0.4, 10), M("#2FA34F"), 0.55, 0.2, 0.05));
      g.add(hw);
    }
    for (let i = 0; i < equipLevel(Save.d, "burner"); i++) {
      const gas = mesh(
        cyl(0.16, 0.16, 0.55, 12),
        M(i ? "#1E5AA8" : "#C62828", { roughness: 0.35 }),
        -0.6 + i * 1.2,
        0.28,
        2.95,
      );
      g.add(gas);
      g.add(
        mesh(
          sph(0.16, 10, 6),
          M(i ? "#1E5AA8" : "#C62828"),
          -0.6 + i * 1.2,
          0.56,
          2.95,
        ),
      );
    }
  }

  /* ---- renovation: tiles and paint, standing fans, then air-conditioning ---- */
  function buildRenovation(g, level, t, ci) {
    if (level >= 1) {
      const tiles = new T3.Mesh(
        G("renoFloor", () => new T3.PlaneGeometry(9.4, 1.7)),
        new T3.MeshStandardMaterial({
          map: canvasTex("reno" + ci, 128, 128, (x) => {
            for (let a = 0; a < 4; a++)
              for (let b = 0; b < 4; b++) {
                x.fillStyle = (a + b) % 2 ? "#F4EFE6" : "#CFE7E3";
                x.fillRect(a * 32, b * 32, 32, 32);
              }
          }),
          roughness: 0.35,
        }),
      );
      tiles.material.map.wrapS = tiles.material.map.wrapT = T3.RepeatWrapping;
      tiles.material.map.repeat.set(6, 1);
      tiles.rotation.x = -Math.PI / 2;
      tiles.position.set(0, 0.085, -0.85);
      tiles.receiveShadow = true;
      g.add(tiles);
    }
    if (level >= 2)
      [-4.1, 4.1].forEach((x, i) => {
        const fan = new T3.Group();
        fan.position.set(x, 0, -2.2);
        fan.add(mesh(cyl(0.18, 0.22, 0.05, 12), M("#333"), 0, 0.03, 0));
        fan.add(mesh(cyl(0.025, 0.025, 1.3, 6), M("#C9CED6"), 0, 0.68, 0));
        const head = new T3.Group();
        head.position.set(0, 1.4, 0.02);
        head.rotation.y = x > 0 ? -0.5 : 0.5;
        head.add(mesh(cyl(0.12, 0.12, 0.14, 10), M("#E8ECF1"), 0, 0, -0.06));
        const blades = new T3.Group();
        for (let k = 0; k < 3; k++) {
          const b = mesh(rbox(0.07, 0.3, 0.01, 0.01), M("#4FC3F7"), 0, 0.14, 0);
          const arm = new T3.Group();
          arm.rotation.z = (k * Math.PI * 2) / 3;
          arm.add(b);
          blades.add(arm);
        }
        head.add(blades);
        fan.add(head);
        g.add(fan);
        dyn.push({ o: blades, type: "spin", ph: i });
      });
    if (level >= 3)
      [-3.2, 3.2].forEach((x) => {
        const ac = mesh(
          rbox(0.95, 0.32, 0.26, 0.05),
          M("#FFFFFF"),
          x,
          2.6,
          -2.05,
        );
        g.add(ac);
        g.add(mesh(rbox(0.8, 0.03, 0.02, 0.01), M("#9AA4B2"), x, 2.48, -1.91));
      });
  }
  /* ---- dining: plastic tables and chairs on the customer side ---- */
  const DINING_SLOTS = [
    [-1.05, -1.62],
    [1.05, -1.62],
    [-3.15, -1.62],
    [3.15, -1.62],
    [-3.15, -0.2],
    [3.15, -0.2],
  ];
  const diningTables = [];
  // Dining furniture by restaurant class: plastic, wood, café, banquet,
  // first-class (luxury) and the neon tables of the Endless night market.
  const FURNITURE = {
    plastic: {
      table(t, c) {
        t.add(
          mesh(
            rbox(0.74, 0.05, 0.74, 0.03),
            M(c, { roughness: 0.4 }),
            0,
            0.72,
            0,
          ),
        );
        legs(t, c);
      },
    },
    wood: {
      top: "#8D5A2E",
      chair: () => "#7A4B2A",
      table(t) {
        t.add(
          mesh(
            rbox(0.8, 0.07, 0.8, 0.03),
            M("#8D5A2E", { roughness: 0.7 }),
            0,
            0.72,
            0,
          ),
        );
        legs(t, "#6B4226", 0.035);
      },
    },
    cafe: {
      chair: () => "#455A64",
      table(t) {
        t.add(
          mesh(
            cyl(0.42, 0.42, 0.04, 20),
            M("#FAFAFA", { roughness: 0.25 }),
            0,
            0.73,
            0,
          ),
        );
        t.add(
          mesh(
            cyl(0.04, 0.04, 0.7, 8),
            M("#37474F", { metalness: 0.6 }),
            0,
            0.36,
            0,
          ),
        );
        t.add(
          mesh(
            cyl(0.22, 0.22, 0.03, 16),
            M("#37474F", { metalness: 0.6 }),
            0,
            0.02,
            0,
          ),
        );
      },
    },
    banquet: {
      chair: () => "#D4A537",
      table(t) {
        t.add(
          mesh(
            rbox(0.84, 0.7, 0.84, 0.04),
            M("#FFFFFF", { roughness: 0.8 }),
            0,
            0.37,
            0,
          ),
        );
        t.add(
          mesh(
            rbox(0.22, 0.012, 0.86, 0.005),
            M("#D4A537", { metalness: 0.5 }),
            0,
            0.725,
            0,
          ),
        );
      },
    },
    luxury: {
      chair: () => "#3E2723",
      table(t) {
        t.add(
          mesh(
            rbox(0.86, 0.7, 0.86, 0.04),
            M("#7B1F2A", { roughness: 0.6 }),
            0,
            0.36,
            0,
          ),
        );
        t.add(
          mesh(
            rbox(0.88, 0.02, 0.88, 0.01),
            M("#F5F0E6", { roughness: 0.4 }),
            0,
            0.725,
            0,
          ),
        );
        t.add(mesh(cyl(0.02, 0.02, 0.14, 8), M("#FFF8E1"), 0, 0.8, 0));
        t.add(
          mesh(
            sph(0.026, 8, 6),
            M("#FFC107", { emissive: "#FFB300", emissiveIntensity: 1.2 }),
            0,
            0.89,
            0,
            false,
          ),
        );
      },
    },
    neon: {
      chair: () => "#FF2E88",
      table(t) {
        t.add(
          mesh(
            rbox(0.74, 0.05, 0.74, 0.03),
            M("#1E1E2E", { roughness: 0.3 }),
            0,
            0.72,
            0,
          ),
        );
        t.add(
          mesh(
            rbox(0.77, 0.02, 0.77, 0.01),
            M("#00E5FF", { emissive: "#00E5FF", emissiveIntensity: 1.1 }),
            0,
            0.695,
            0,
            false,
          ),
        );
        legs(t, "#111111");
      },
    },
  };
  function legs(t, c, r = 0.025) {
    [
      [-0.3, -0.3],
      [0.3, -0.3],
      [-0.3, 0.3],
      [0.3, 0.3],
    ].forEach(([a, b]) => t.add(mesh(cyl(r, r, 0.7, 6), M(c), a, 0.36, b)));
  }
  function buildDining(g, eff, ci, kind = "plastic") {
    diningTables.length = 0;
    const F = FURNITURE[kind] || FURNITURE.plastic;
    const plastic =
      ci === 4 || ci === 3 ? ["#FFFFFF", "#FFFFFF"] : ["#E53935", "#FFFFFF"];
    // Tables stand where the player arranged them, else in the default slots.
    const custom = tablesAt(Save.d, Save.d.place);
    for (let i = 0; i < Math.min(eff.tables, DINING_SLOTS.length); i++) {
      const [x, z] = custom[i] || DINING_SLOTS[i];
      const t = new T3.Group();
      t.position.set(x, 0, z);
      t.userData.table = i;
      F.table(t, plastic[0]);
      const seats = [-1, 1].map((side) => {
        const c = chair(
          F.chair
            ? F.chair(i)
            : plastic[1] === "#FFFFFF" && i % 2
              ? "#12A99F"
              : plastic[1],
        );
        c.position.set(side * 0.58, 0, 0);
        // Backrest away from the table, so the diner faces their food.
        c.rotation.y = (-side * Math.PI) / 2;
        c.scale.setScalar(0.92);
        t.add(c);
        return {
          x: x + side * 0.58,
          z,
          face: -side * (Math.PI / 2),
          taken: null,
        };
      });
      g.add(t);
      diningTables.push({ g: t, x, z, seats, plates: [], chip: null });
    }
  }

  /* ---- the miniature world around the restaurant ---- */
  function tree(g, x, z, s = 1) {
    const t = new T3.Group();
    t.position.set(x, 0, z);
    t.scale.setScalar(s);
    t.add(mesh(cyl(0.12, 0.16, 1.1, 8), M("#8A5A34"), 0, 0.55, 0));
    [
      [0, 1.55, 0, 0.62, "#5DB84A"],
      [-0.35, 1.25, 0.15, 0.45, "#4FA63F"],
      [0.36, 1.3, -0.1, 0.48, "#6CC653"],
      [0.05, 1.95, -0.05, 0.4, "#78D25E"],
    ].forEach(([a, y, b2, r, c]) =>
      t.add(mesh(sph(r, 12, 10), M(c, { roughness: 0.85 }), a, y, b2)),
    );
    g.add(t);
    return t;
  }
  const FLOWERS = ["#FF5A8A", "#FFD23F", "#FFFFFF", "#FF8C42", "#C77DFF"];
  function hedge(g, x, z, flowers) {
    g.add(mesh(sph(0.34, 10, 8), M("#4FA63F", { roughness: 0.9 }), x, 0.26, z));
    if (flowers)
      for (let k = 0; k < 3; k++)
        g.add(
          mesh(
            sph(0.06, 6, 5),
            M(
              FLOWERS[
                (Math.abs(Math.round(x * 7 + z * 5)) + k) % FLOWERS.length
              ],
            ),
            x + Math.cos(k * 2.1) * 0.2,
            0.5 + (k % 2) * 0.06,
            z + Math.sin(k * 2.1) * 0.2,
            false,
          ),
        );
  }
  function buildGreenery(g, night) {
    // Trees on the lawns either side of the restaurant, clear of the
    // walkway (z -2.3) and the road.
    [
      [6.3, 1.7, 1],
      [7.9, -0.6, 1.15],
      [9.6, 1.2, 0.95],
      [11.4, -0.8, 1.1],
      [13.2, 1.4, 1],
    ].forEach(([x, z, sc]) => {
      tree(g, x, z, sc);
      tree(g, -x, z + 0.3, sc * 0.95);
    });
    // Low hedges with flowers framing the kitchen and dining area.
    for (let zz = 3.1; zz >= -1.4; zz -= 0.75) {
      hedge(g, 5.15, zz, !night);
      hedge(g, -5.15, zz, !night);
    }
    if (night) return;
    // Clouds drifting across the sky.
    for (let i = 0; i < 6; i++) {
      const c = new T3.Group();
      const n = 4 + (i % 2);
      for (let k = 0; k < n; k++)
        c.add(
          mesh(
            sph(1.1 + (k % 3) * 0.35, 12, 10),
            M("#FFFFFF", { roughness: 1 }),
            k * 1.25 - n * 0.6,
            Math.sin(k * 1.7) * 0.35,
            Math.cos(k) * 0.4,
            false,
          ),
        );
      const x = -32 + i * 12;
      c.position.set(x, 10 + (i % 3) * 2.2, -34 - (i % 2) * 6);
      g.add(c);
      dyn.push({ o: c, type: "cloud", x, speed: 0.25 + (i % 3) * 0.1 });
    }
  }
  /* ---- decorations that set each restaurant apart ---- */
  let scoreboard = null;
  function buildExtras(g, extras, t, ci) {
    scoreboard = null;
    const glow = (c, k = 1) => M(c, { emissive: c, emissiveIntensity: k });
    for (const kind of extras) {
      if (kind === "awning") {
        // A striped canopy over the street front.
        for (let i = 0; i < 9; i++) {
          const a = mesh(
            rbox(1.0, 0.05, 0.75, 0.02),
            M(i % 2 ? "#FFFFFF" : t.trim),
            -4 + i,
            2.45,
            -2.5,
          );
          a.rotation.x = 0.28;
          g.add(a);
        }
        [-4.45, 4.45].forEach((x) =>
          g.add(mesh(cyl(0.05, 0.05, 2.4, 8), M("#5D4037"), x, 1.2, -2.75)),
        );
      } else if (kind === "lanterns") {
        [-4.1, -3.2, 3.2, 4.1].forEach((x, i) => {
          g.add(
            mesh(cyl(0.006, 0.006, 0.5, 4), M("#333"), x, 2.85, -2.45, false),
          );
          g.add(
            mesh(
              sph(0.16, 10, 8),
              glow(i % 2 ? "#FF7043" : "#FFCA28", 0.9),
              x,
              2.55,
              -2.45,
              false,
            ),
          );
        });
      } else if (kind === "bunting") {
        for (let i = 0; i < 16; i++) {
          const f = mesh(
            cone(0.13, 0.26, 3),
            M(["#FF5A5F", "#FFC531", "#12A99F", "#6B2D8C"][i % 4]),
            -4.5 + i * 0.6,
            2.7,
            -2.45,
            false,
          );
          f.rotation.x = Math.PI;
          g.add(f);
        }
      } else if (kind === "planters") {
        [
          [-4.6, -0.45],
          [4.6, -0.45],
          [-4.6, -2.05],
          [4.6, -2.05],
        ].forEach(([x, z]) => {
          g.add(mesh(cyl(0.26, 0.2, 0.42, 12), M("#8D6E63"), x, 0.21, z));
          g.add(
            mesh(
              sph(0.36, 10, 8),
              M("#2E7D32", { roughness: 0.9 }),
              x,
              0.72,
              z,
            ),
          );
        });
      } else if (kind === "palms") {
        palm(g, -4.95, -2.6, 3.2);
        palm(g, 4.95, -2.6, 3.4);
      } else if (kind === "pillars") {
        [-4.8, 4.8].forEach((x) =>
          [-2.45, 0.25].forEach((z) => {
            g.add(
              mesh(
                cyl(0.16, 0.18, 3, 14),
                M("#F5F0E6", { roughness: 0.3 }),
                x,
                1.5,
                z,
              ),
            );
            g.add(
              mesh(
                rbox(0.46, 0.12, 0.46, 0.03),
                M(t.trim, { metalness: 0.6, roughness: 0.3 }),
                x,
                3.02,
                z,
              ),
            );
            g.add(
              mesh(
                rbox(0.46, 0.1, 0.46, 0.03),
                M(t.trim, { metalness: 0.6, roughness: 0.3 }),
                x,
                0.05,
                z,
              ),
            );
          }),
        );
      } else if (kind === "chandelier") {
        [-2.1, 2.1].forEach((x) => {
          g.add(
            mesh(cyl(0.01, 0.01, 0.6, 4), M("#B8860B"), x, 3.25, -1.25, false),
          );
          const ring = mesh(
            tor(0.32, 0.03, 8, 20),
            M("#D4A537", { metalness: 0.8, roughness: 0.25 }),
            x,
            2.92,
            -1.25,
            false,
          );
          ring.rotation.x = Math.PI / 2;
          g.add(ring);
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            g.add(
              mesh(
                sph(0.05, 8, 6),
                glow("#FFF3C4", 1.4),
                x + Math.cos(a) * 0.32,
                2.98,
                -1.25 + Math.sin(a) * 0.32,
                false,
              ),
            );
          }
        });
      } else if (kind === "carpet") {
        const c = mesh(
          rbox(1.15, 0.012, 2.2, 0.005),
          M("#9B1B30", { roughness: 0.9 }),
          0,
          0.095,
          -1.25,
          false,
        );
        g.add(c);
        [-0.6, 0.6].forEach((x) =>
          g.add(
            mesh(
              rbox(0.06, 0.014, 2.2, 0.005),
              M("#D4A537", { metalness: 0.5 }),
              x,
              0.097,
              -1.25,
              false,
            ),
          ),
        );
      } else if (kind === "neon") {
        // Glowing strips along the counter front.
        [0.22, 0.92].forEach((y, i) =>
          g.add(
            mesh(
              rbox(7.1, 0.035, 0.03, 0.01),
              glow(i ? t.trim : t.tray || "#00E5FF", 1.3),
              0,
              y,
              0.08,
              false,
            ),
          ),
        );
      } else if (kind === "scoreboard") {
        // It covers the signboard, where the camera always sees it: the
        // high score and this run's score.
        const cv = document.createElement("canvas");
        cv.width = 1024;
        cv.height = 300;
        const tex = new T3.CanvasTexture(cv);
        tex.colorSpace = T3.SRGBColorSpace;
        const face = new T3.Mesh(
          new T3.PlaneGeometry(5.2, 1.52),
          new T3.MeshBasicMaterial({ map: tex, toneMapped: false }),
        );
        face.position.set(
          0,
          ci === 4 ? 3.75 : 3.25,
          (ci === 0 ? -4.3 : ci === 4 ? -5.0 : -3.4) + 0.12,
        );
        g.add(face);
        scoreboard = { cv, tex, last: "" };
        drawScoreboard(Save.d.endlessBest || 0, 0);
      }
    }
  }
  // Redraws the Endless scoreboard when the numbers change.
  function drawScoreboard(best, now) {
    if (!scoreboard) return;
    const key = best + "|" + now;
    if (key === scoreboard.last) return;
    scoreboard.last = key;
    const x = scoreboard.cv.getContext("2d");
    x.fillStyle = "#0B0B1A";
    x.fillRect(0, 0, 1024, 300);
    x.strokeStyle = "#FF2E88";
    x.lineWidth = 10;
    x.strokeRect(8, 8, 1008, 284);
    x.textBaseline = "middle";
    x.textAlign = "center";
    x.font = "bold 50px sans-serif";
    x.fillStyle = "#FFE14D";
    x.fillText("ENDLESS RUSH", 512, 54);
    x.font = "bold 40px sans-serif";
    x.fillStyle = "#FF2E88";
    x.fillText("HIGH SCORE", 270, 120);
    x.fillStyle = "#00E5FF";
    x.fillText("THIS RUN", 754, 120);
    x.font = "bold 84px sans-serif";
    x.fillStyle = "#FFFFFF";
    x.fillText(fmtNaira(best), 270, 210);
    x.fillStyle = now > best ? "#FFE14D" : "#FFFFFF";
    x.fillText(fmtNaira(now), 754, 210);
    scoreboard.tex.needsUpdate = true;
  }
  /* ---- traffic: cars, kekes, danfos and okadas on every street ---- */
  const TRAFFIC_LANES = {
    0: [-4.7, -5.5],
    1: [-4.7, -5.45],
    2: [-8.0, -9.1],
    3: [-8.2, -9.0],
    // A narrow one-way street between the parked okadas and the facade.
    4: [-4.45],
  };
  function car(g, color) {
    const k = new T3.Group();
    k.add(
      mesh(
        rbox(1.7, 0.42, 0.82, 0.12),
        M(color, { roughness: 0.3, metalness: 0.2 }),
        0,
        0.42,
        0,
      ),
    );
    k.add(
      mesh(
        rbox(0.95, 0.36, 0.76, 0.1),
        M("#263238", { roughness: 0.15 }),
        -0.08,
        0.8,
        0,
      ),
    );
    [
      [-0.55, -0.4],
      [0.55, -0.4],
      [-0.55, 0.4],
      [0.55, 0.4],
    ].forEach(([x, z]) =>
      k.add(mesh(tor(0.14, 0.06, 8, 12), M("#1E1E1E"), x, 0.2, z)),
    );
    g.add(k);
    return k;
  }
  function buildTraffic(g, ci) {
    const lanes = TRAFFIC_LANES[ci] || [-4.65, -5.55];
    if (ci === 0 || ci === 3 || ci === 4) {
      const road = mesh(
        G("road3", () => new T3.PlaneGeometry(60, 2.5)),
        M("#4A4E57", { roughness: 0.95 }),
        0,
        0.015,
        (lanes[0] + (lanes[1] ?? lanes[0])) / 2,
        false,
      );
      road.rotation.x = -Math.PI / 2;
      g.add(road);
    }
    const n = Math.min(6, 2 + tierOf(Save.d));
    const makers = [
      (h) =>
        car(h, pick(["#1E88E5", "#E53935", "#F5F5F5", "#212121", "#FFC531"])),
      keke,
      danfo,
      (h) => car(h, pick(["#9E9E9E", "#2FA34F", "#6B2D8C"])),
      okada,
      keke,
    ];
    const oneWay = lanes.length === 1;
    for (let i = 0; i < n; i++) {
      // No danfo bus where the street is too narrow for it.
      const v = (oneWay && i === 2 ? makers[0] : makers[i])(g);
      if (i === 4) v.scale.setScalar(0.9);
      const dir = oneWay || i % 2 === 0 ? 1 : -1;
      dyn.push({
        o: v,
        type: "drive",
        // One lane per direction, so traffic never drives through itself.
        z: lanes[dir > 0 ? 0 : 1],
        speed: rnd(2.4, 5),
        x: -16 + ((i * 11) % 32),
        dir,
        len: i === 2 && !oneWay ? 3.4 : 2,
      });
    }
  }
  // As the business grows the street fills up: more stalls and buildings.
  function buildGrowth(g, ci) {
    const tier = tierOf(Save.d);
    // Owned vehicles park at the roadside: okadas on the right, the bus on the left.
    for (let i = 0; i < equipLevel(Save.d, "bike"); i++) {
      const b = new T3.Group();
      okada(b);
      b.position.set(4.7 + i * 0.95, 0, -3.25);
      b.rotation.y = -0.35;
      g.add(b);
    }
    if (equipLevel(Save.d, "bus")) {
      const bus = danfo(g);
      bus.position.set(-9.2, 0, -3.15);
      bus.rotation.y = 0;
    }
    const cols = ["#FF7A1A", "#12A99F", "#FF5A5F", "#2FA34F", "#6B2D8C"];
    for (let i = 0; i < tier; i++) {
      [-1, 1].forEach((side) => {
        parasol(
          g,
          side * (5.8 + i * 1.6),
          -2.55,
          cols[(i + (side > 0 ? 2 : 0)) % 5],
          "#FFF4DE",
        );
        if (ci !== 2)
          building(
            g,
            side * (9 + i * 3.2),
            -11 - (i % 2) * 2,
            2.8,
            4 + i * 1.4,
            2.4,
            cols[(i * 2 + (side > 0 ? 1 : 0)) % 5],
            "#BFE6FF",
            "#4A1F0C",
          );
      });
    }
  }

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
          M(f.kind === "soup" ? "#5A4636" : "#3B3F46", {
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
    } else if (t === "basin") {
      // Enamel basin of wrapped portions, the way bukas keep swallow and moi moi warm.
      g.add(
        mesh(
          cyl(0.42, 0.3, 0.3, 22),
          M("#F4F1E8", { roughness: 0.3 }),
          0,
          0.15,
          0,
        ),
      );
      const rim = mesh(
        tor(0.42, 0.035, 8, 24),
        M("#1E5AA8", { roughness: 0.3 }),
        0,
        0.3,
        0,
      );
      rim.rotation.x = Math.PI / 2;
      g.add(rim);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const w = mesh(
          sph(0.13, 12, 8),
          M(col, { roughness: 0.6 }),
          Math.cos(a) * 0.16,
          0.33,
          Math.sin(a) * 0.16,
        );
        w.scale.y = 0.7;
        g.add(w);
      }
    }
    const dish = foodModel(id);
    dish.position.set(0, 0, 0.48);
    dish.scale.setScalar(0.95);
    g.add(dish);
    if (f.cook) {
      // Charred lump shown on the counter plate when a batch burns.
      const ch = mesh(
        sph(0.2, 12, 8),
        M("#1E1A17", { roughness: 1 }),
        0,
        0.12,
        0.48,
      );
      ch.scale.set(1.1, 0.45, 0.9);
      ch.visible = false;
      g.add(ch);
      g.userData.char = ch;
    }
    g.userData.pick = { type: "station", id };
    g.userData.steam = steam;
    g.userData.steam0 = steam;
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
      // Bigger pots are visibly taller.
      const big = equipLevel(Save.d, "bigpots");
      if (big && FOODS[id].station === "pot") s.scale.y = sc * (1 + 0.14 * big);
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
    "#2B2420",
    "#9FE3FF",
  ].map((c) => new T3.MeshBasicMaterial({ color: c }));
  const SMOKE = [6, 6, 2],
    ICE = [7, 2, 7];
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
    const type = CUSTOMER_TYPES[opts.type];
    if (type && type.body && !opts.vip && !opts.guest)
      return {
        skin,
        bodyMat: M(type.body, { roughness: 0.7 }),
        accent: type.accent,
        hat: type.hat,
        vip: false,
        scale: type.scale ? type.scale * rnd(0.97, 1.03) : rnd(0.92, 1.04),
      };
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
      this.order = toItems(order, o.assembly);
      this.vip = !!o.vip;
      this.guest = !!o.guest;
      this.type = o.type || "regular";
      this.mood = o.mood || null;
      this.traits = customerTraits(this.type, this.mood);
      const first = pick(NAMES);
      this.name = o.vip
        ? "Chief " + first
        : this.type === "alhaji"
          ? "Alhaji " + first
          : this.type === "odogwu"
            ? "Odogwu " + first
            : first;
      this.max = o.patience;
      this.p = this.max;
      this.speed = o.speed || 3.6;
      this.haggle = o.haggle ? { ...o.haggle, done: false } : null;
      this.haggleT = 8;
      this.priceMult = 1;
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
      this.el = bridge.bubble(
        this,
        cols,
        FOODS,
        MOODS,
        () => Game.select(this),
        (choice) => Game.resolveHaggle(this, choice),
      );
      this.items = [...this.el.querySelectorAll(".it")];
      this.patEl = this.el.querySelector(".pat b");
      this.sayEl = this.el.querySelector(".say");
      this.sayT = 0;
      this.refreshItems();
    }
    needs(f) {
      return needsFood(this.state, this.order, f);
    }
    blocks(f) {
      return blockedFood(this.state, this.order, f);
    }
    fill(f) {
      const { index, slot } = fillOrder(this.order, f);
      if (index >= 0) this.items[index].classList.add("done");
      this.refreshItems();
      return slot;
    }
    // Toppings stay greyed out until the main on the plate has been dished.
    refreshItems() {
      const ready = baseReady(this.order);
      this.order.forEach((o, i) =>
        this.items[i].classList.toggle("wait", o.layer === 1 && !ready),
      );
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
      this.P.inner.position.y = 0;
      this.el.style.opacity = "0";
    }
    // Walk to a free chair: step back from the counter, sideways, then sit.
    // Walk round to the back of the assigned chair, then step in and sit.
    // Anchors come from the chair's own position and facing, so both sides
    // of a table work, wherever the table has been moved.
    goSit() {
      const s = this.seat,
        lx = this.root.position.x,
        bx = -Math.sin(s.face),
        bz = -Math.cos(s.face),
        sitX = s.x + bx * 0.14,
        sitZ = s.z + bz * 0.14,
        backX = s.x + bx * 0.55,
        aisle = Math.min(s.z + 0.5, -0.85);
      this.path = [
        new T3.Vector3(lx, 0, aisle),
        new T3.Vector3(backX, 0, aisle),
        new T3.Vector3(backX, 0, s.z + bz * 0.55),
        new T3.Vector3(sitX, 0, sitZ),
      ];
      this.state = "toSeat";
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
      // Path following with arrival (slow down at the last point) and
      // separation (step aside from anyone too close), after Reynolds.
      if (
        this.state === "enter" ||
        this.state === "leave" ||
        this.state === "toSeat"
      ) {
        const tgt = this.path[0];
        if (tgt) {
          _v.subVectors(tgt, r.position);
          _v.y = 0;
          const d = _v.length(),
            last = this.path.length === 1,
            step =
              this.speed *
              dt *
              (last && this.state === "toSeat"
                ? Math.max(0.35, Math.min(1, d / 0.6))
                : 1);
          if (d <= step) {
            r.position.copy(tgt);
            this.path.shift();
          } else {
            _v.multiplyScalar(1 / d);
            r.position.addScaledVector(_v, step);
            this.faceRot = Math.atan2(_v.x, _v.z);
            moving = true;
          }
          if (!last || this.state !== "toSeat") {
            for (const o of Game.customers) {
              if (o === this || o.state === "eat") continue;
              const dx = r.position.x - o.root.position.x,
                dz = r.position.z - o.root.position.z,
                dd = Math.hypot(dx, dz);
              if (dd > 0.001 && dd < 0.55) {
                const push = ((0.55 - dd) / dd) * Math.min(1, dt * 6);
                r.position.x += dx * push;
                r.position.z += dz * push * 0.4;
              }
            }
          }
        }
        if (!this.path.length) {
          if (this.state === "enter") {
            this.state = "wait";
            this.st = 0;
            this.faceRot = 0;
            this.el.style.opacity = "1";
            Game.onArrive(this);
          } else if (this.state === "toSeat") {
            this.state = "eat";
            this.st = 0;
            this.eatFor = rnd(4.5, 7);
            this.faceRot = this.seat.face;
            Game.startMeal(this);
          } else {
            this.dead = true;
          }
        }
      }
      if (this.state === "eat" && this.st > this.eatFor) Game.finishMeal(this);
      let dr = this.faceRot - r.rotation.y;
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      r.rotation.y += dr * Math.min(1, dt * 10);
      const ratio = this.p / this.max;
      if (this.state === "wait") {
        // Waiting on food that has finished wears patience down faster.
        this.p -= dt * Game.patienceRate() * (this.starved ? 1.4 : 1);
        if (this.haggle && !this.haggle.done && (this.haggleT -= dt) <= 0)
          Game.resolveHaggle(this, "refuse");
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
        if (this.st > 1.05) {
          if (this.state === "happy" && this.seat) this.goSit();
          else if (this.state === "happy") {
            this.state = "seatWait";
            this.st = 0;
            this.el.style.opacity = "0";
          } else this.leave();
        }
      }
      // A busy dining room should not make every newly served customer
      // immediately leave. Give an occupied chair time to become available.
      if (this.state === "seatWait") {
        this.seat = Game.claimSeat(this);
        if (this.seat) this.goSit();
        else if (this.st >= 8) {
          // They take the food away; do not dirty a counter lane that may
          // already belong to another customer while they waited for a seat.
          this.leave();
        }
      }
      // animation
      const I = P.inner;
      // Seated on the chair: body up on the seat, feet forward under the table.
      const seated = this.state === "eat";
      if (seated !== this.sitting) {
        this.sitting = seated;
        if (P.legs) P.legs.visible = seated;
        P.feet?.forEach((f) =>
          f.position.set(
            f.position.x,
            seated ? -0.15 : 0.07,
            seated ? 0.4 : 0.1,
          ),
        );
      }
      if (this.state === "eat") {
        I.position.y = lerp(I.position.y, 0.22, dt * 8);
        I.rotation.z = 0;
        I.scale.y = 1;
        // Arms back at the sides after the happy cheer, then eating.
        P.armL.rotation.z = -0.25;
        P.armR.rotation.z = 0.25;
        P.armR.rotation.x = -1.1 + Math.sin(this.t * 7) * 0.35;
        P.armL.rotation.x = -0.4;
        P.head.rotation.x = 0.15 + Math.sin(this.t * 7) * 0.06;
      } else if (moving) {
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
  // The restaurant a shift runs at: a level's own chapter, else where you are.
  const placeFor = (cfg) =>
    cfg && cfg.mode === "level" && cfg.n
      ? placeOfLevel(cfg.n).id
      : Save.d.place || "ch0";
  /* ================= HELPERS (hired staff, visible and walking) ================= */
  // Staff live in the back kitchen (camera side of the bench). To reach the
  // front counter or the dining tables they walk round the bench ends.
  const HOME = {
    cook: [
      { x: -0.7, z: KITCHEN_Z },
      { x: 0.7, z: KITCHEN_Z },
    ],
    server: [
      { x: 1.6, z: KITCHEN_Z },
      { x: -1.6, z: KITCHEN_Z },
    ],
    cleaner: [{ x: -2.35, z: 3.35 }],
    errand: [{ x: 3.85, z: 3.75 }],
    rider: [
      { x: 3.95, z: -3.05 },
      { x: 3.35, z: -3.3 },
    ],
  };
  const roleCount = {};
  const TASK_WORDS = {
    serve: "served",
    pack: "packed",
    cook: "pots cooked",
    wash: "washes",
    clear: "tables cleared",
    sweep: "swept",
    market: "market runs",
  };
  const TASK_ICONS = {
    serve: "🍛",
    pack: "📦",
    cook: "🔥",
    wash: "🧽",
    clear: "🍽️",
    sweep: "🧹",
    market: "🛒",
  };
  let litterSeq = 0;
  const V = (x, z) => new T3.Vector3(x, 0, z);
  class Helper {
    constructor(spec) {
      this.spec = spec;
      const list = HOME[spec.role] || HOME.server,
        i = (roleCount[spec.role] = (roleCount[spec.role] ?? -1) + 1);
      const h = list[i % list.length];
      this.home = V(h.x + Math.floor(i / list.length) * 0.5, h.z);
      this.t = spec.interval * rnd(0.3, 0.8);
      this.anim = Math.random() * 5;
      this.path = [];
      this.job = null;
      this.work = 0;
      this.away = 0;
      // Workers owed last month's pay drag their feet.
      this.slow = spec.strikes > 0 ? UNPAID_SLOWDOWN : 1;
      this.speed =
        (spec.role === "errand" ? 3.4 : spec.role === "cleaner" ? 3.9 : 3.1) /
        this.slow;
      const uni = effects(Save.d).uniforms && spec.role !== "rider";
      const mat = uni
        ? M("#F4F7FA", { roughness: 0.6 })
        : new T3.MeshStandardMaterial({
            map: ankaraTex([spec.a, spec.b, "#FFF4DE"], 1),
            roughness: 0.7,
          });
      this.P = makePerson({
        skin: SKINS[spec.skin],
        bodyMat: mat,
        accent: uni ? "#12A99F" : spec.b,
        hat: uni ? "chef" : spec.hat || "chef",
        scale: 0.8,
      });
      this.root = this.P.root;
      this.root.position.copy(this.home);
      world.add(this.root);
      this.done = {};
      this.task = "";
      this.tag = document.createElement("div");
      this.tag.className = "helperTag";
      this.tag.hidden = true;
      host.querySelector("#world")?.appendChild(this.tag);
      setFace(this.P, "happy");
      // Riders wait at the roadside by the parked okadas (built with the scene).
    }
    // Routes. The bench spans x ±3.7 at z 2.3; the front counter is at z 0.55.
    toBench(x) {
      const p = this.root.position;
      const out = p.z < 2.4 ? this.roundEnd(p.x, true) : [];
      return [...out, V(clamp(x, -3.3, 3.3), 2.95)];
    }
    roundEnd(x, toBack) {
      const e = x >= 0 ? BENCH_END : -BENCH_END;
      return toBack
        ? [V(e, 1.3), V(e, KITCHEN_Z)]
        : [V(e, KITCHEN_Z), V(e, 1.3)];
    }
    toFront(x) {
      return [...this.roundEnd(x, false), V(clamp(x, -3.2, 3.2), 1.05)];
    }
    toTable(t) {
      const e = t.x >= 0 ? BENCH_END : -BENCH_END;
      return [V(e, KITCHEN_Z), V(e, 0.1), V(e, -1.05), V(t.x, -1.05)];
    }
    homePath() {
      const p = this.root.position;
      if (p.z < 2.4) {
        const e = p.x >= 0 ? BENCH_END : -BENCH_END;
        return [
          ...(p.z < 0.3 ? [V(e, -1.05), V(e, 0.1)] : []),
          V(e, 1.3),
          V(e, KITCHEN_Z),
          this.home.clone(),
        ];
      }
      return [this.home.clone()];
    }
    // Starts a job and remembers what it is, for the status tag.
    goAs(task, path, run, hold, face) {
      this.task = task;
      return this.go(path, run, hold, face);
    }
    go(path, run, hold = 0.6, face = Math.PI) {
      this.path = path;
      this.job = { run, hold, face };
      return true;
    }
    // Picks one job; the effect happens when the worker gets there.
    act() {
      const role = this.spec.role,
        G0 = Game;
      if (role === "server") {
        const waiting = G0.customers
          .filter((c) => c.state === "wait")
          .sort((a, b) => a.p / a.max - b.p / b.max);
        const ready = (f) => {
          const ck = G0.cookers[f];
          return !!stations[f] && (!ck || hasPortion(ck));
        };
        // The owner's crew priority decides which job a server looks at first.
        const counterJob = () => {
          // One trip serves the whole order: the server picks up every dish
          // that is ready along the bench, then hands them over together.
          for (const c of waiting) {
            if (G0.claimed.has("cust" + c.id)) continue;
            const first = nextNeeded(c.order).find(
              (it) => ready(it.f) && !G0.claimed.has(c.id + it.f),
            );
            if (!first) continue;
            const xs = [
              ...new Set(
                c.order
                  .filter((it) => !it.done && ready(it.f))
                  .map((it) => stations[it.f].position.x),
              ),
            ].sort(
              (a, b) =>
                Math.abs(a - this.root.position.x) -
                Math.abs(b - this.root.position.x),
            );
            G0.claimed.add("cust" + c.id);
            return this.goAs(
              "serve",
              [
                ...this.toBench(xs[0]),
                ...xs.slice(1).map((x) => V(clamp(x, -3.3, 3.3), 2.95)),
              ],
              () => {
                G0.claimed.delete("cust" + c.id);
                if (c.state !== "wait") return false;
                let served = 0;
                for (let guard = 0; guard < 8; guard++) {
                  const it = nextNeeded(c.order).find(
                    (o) => ready(o.f) && c.needs(o.f),
                  );
                  if (!it) break;
                  const k = G0.cookers[it.f],
                    st = stations[it.f];
                  if (k) takePortion(k);
                  st.userData.bounce = 1;
                  G0.deliver(
                    c,
                    it.f,
                    st.getWorldPosition(new T3.Vector3()).setY(1.4),
                  );
                  served++;
                }
                return served > 0;
              },
              0.5 + 0.12 * xs.length,
            );
          }
          return false;
        };
        const packJob = () => {
          for (const o of G0.orders)
            for (const it of o.items) {
              if (!packNeeds(o, it.f)) continue;
              const claim = `pack:${o.id}:${it.f}`;
              if (G0.claimed.has(claim)) continue;
              const ck = G0.cookers[it.f];
              if (ck && !hasPortion(ck)) continue;
              const st = stations[it.f];
              G0.claimed.add(claim);
              return this.goAs(
                "pack",
                this.toBench(st ? st.position.x : 0),
                () => {
                  G0.claimed.delete(claim);
                  const k = G0.cookers[it.f];
                  if (
                    !G0.orders.includes(o) ||
                    !packNeeds(o, it.f) ||
                    (k && !hasPortion(k))
                  )
                    return false;
                  if (k) takePortion(k);
                  G0.fillPack(o, it.f);
                },
              );
            }
          return false;
        };
        for (const k of serverOrder(G0.priority)) {
          const r = k === "pack" ? packJob() : counterJob();
          if (r) return r;
        }
      } else if (role === "rider") {
        const o = G0.orders.find((x) => packComplete(x) && !x.packing);
        if (o && G0.riders.some((r) => r.id === this.spec.id && r.away <= 0)) {
          G0.sendOrder(o.id, true);
          return true;
        }
      } else if (role === "errand") {
        const low = Object.keys(G0.cookers).find((id) => {
          const ck = G0.cookers[id];
          return (
            FOODS[id].station === "cooler" &&
            (ck.stage === "raw" || (ck.stage === "ready" && ck.stock <= 2))
          );
        });
        const groups = [
          ...new Set(G0.cfg.foods.map((f) => FOOD_GROUP[f])),
        ].filter((g) => (Save.d.pantry[g] || 0) < 2 && !isOut(Save.d, g));
        if (low || groups.length)
          return this.goAs(
            "market",
            [V(MARKET_EXIT.x, MARKET_EXIT.z)],
            () => {
              this.root.visible = false;
              this.away = 3.5;
              this.onBack = () => {
                for (const g of groups)
                  marketBuy(Save.d, g, 3, G0.eff.pantryCap, 0.8);
                if (low) {
                  const ck = G0.cookers[low];
                  if (ck.stage === "raw") G0.tapCookerFor(low, true);
                  else ck.stock = ck.spec.batch;
                  G0.syncStations();
                }
              };
            },
            0,
          );
      } else if (role === "cleaner") {
        const s = G0.sink;
        if (
          s.plates &&
          !s.washing &&
          (sinkFull(s) || s.plates >= 2 || !G0.anyDirty())
        )
          return this.goAs(
            "wash",
            [V(SINK_POS.x, SINK_POS.z - 0.2)],
            () => G0.wash(true),
            s.plates * G0.washTime + 0.3,
            Math.PI,
          );
        if (sinkFull(s)) return false;
        const lane = G0.dirty.findIndex((d, i) => d && i < G0.laneX.length);
        if (lane >= 0 && !G0.claimed.has("lane" + lane)) {
          G0.claimed.add("lane" + lane);
          return this.goAs(
            "clear",
            this.toFront(G0.laneX[lane]),
            () => {
              G0.claimed.delete("lane" + lane);
              G0.clearTable(lane, true);
            },
            0.5,
            Math.PI,
          );
        }
        const l = G0.litter.find((x) => !G0.claimed.has("litter" + x.id));
        const ti = G0.tables.findIndex(
          (t, i) => t.plates.length && !G0.claimed.has("table" + i),
        );
        if (l && (ti < 0 || G0.litter.length >= 3)) {
          G0.claimed.add("litter" + l.id);
          return this.goAs(
            "sweep",
            [...this.toTable({ x: l.x }), V(l.x, l.z + 0.35)],
            () => {
              G0.claimed.delete("litter" + l.id);
              G0.sweep(l, true);
            },
            0.6,
            Math.PI,
          );
        }
        if (ti >= 0) {
          G0.claimed.add("table" + ti);
          return this.goAs(
            "clear",
            this.toTable(G0.tables[ti]),
            () => {
              G0.claimed.delete("table" + ti);
              G0.clearDiningTable(ti, true);
            },
            0.6,
            Math.PI,
          );
        }
      } else if (role === "cook") {
        // Start food blocking the most urgent plate before preparing stock
        // for later. Object insertion order is unrelated to customer demand.
        const demand = G0.customers
          .filter((c) => c.state === "wait" || c.state === "enter")
          .sort((a, b) => a.p / a.max - b.p / b.max)
          .flatMap((c) => [
            ...nextNeeded(c.order),
            ...c.order.filter((it) => !it.done),
          ])
          .map((it) => it.f)
          .concat(
            G0.orders.flatMap((o) =>
              o.items.filter((it) => packNeeds(o, it.f)).map((it) => it.f),
            ),
          );
        const priority = (id) => {
          const index = demand.indexOf(id);
          return index < 0 ? demand.length : index;
        };
        const foods = Object.keys(G0.cookers).sort(
          (a, b) => priority(a) - priority(b),
        );
        for (const id of foods) {
          if (FOODS[id].station === "cooler") continue;
          const ck = G0.cookers[id],
            wanted =
              G0.customers.some(
                (c) =>
                  (c.state === "wait" || c.state === "enter") &&
                  c.order.some((o) => o.f === id && !o.done),
              ) ||
              G0.orders.some((o) => packNeeds(o, id)) ||
              ck.spec.hold === Infinity ||
              cookAhead(G0.priority);
          if (
            (ck.stage === "burnt" || (ck.stage === "raw" && wanted)) &&
            !G0.claimed.has("cook" + id)
          ) {
            G0.claimed.add("cook" + id);
            return this.goAs(
              "cook",
              this.toBench(stations[id].position.x),
              () => {
                G0.claimed.delete("cook" + id);
                const k = G0.cookers[id];
                if (k.stage === "burnt") G0.tapCookerFor(id, true);
                if (k.stage !== "raw") return false;
                G0.tapCookerFor(id, true);
              },
              1.2,
            );
          }
        }
      }
      return false;
    }
    update(dt) {
      this.anim += dt;
      const P = this.P,
        r = this.root;
      if (this.away > 0) {
        this.away -= dt;
        if (this.away <= 0) {
          r.visible = true;
          if (this.onBack) this.onBack();
          this.onBack = null;
          this.path = this.homePath();
          if (this.bike) this.bike.visible = true;
        }
        return;
      }
      if (this.bike)
        this.bike.visible =
          effects(Save.d).bikes >
          HOME.rider.findIndex((h) => Math.abs(h.x - this.home.x) < 0.6);
      // Travel and the work animation count toward the worker's interval.
      // A walk home can be interrupted as soon as another task is due.
      const returningPath = this.path;
      if (Game.state === "playing") {
        this.t -= dt * (1 + 0.05 * Save.d.up.fast);
        if (!this.job && this.work <= 0 && this.t <= 0) this.path = [];
      }
      let moving = false;
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
          r.rotation.y = lerp(
            r.rotation.y,
            Math.atan2(_v.x, _v.z),
            Math.min(1, dt * 12),
          );
          moving = true;
        }
      } else if (this.job) {
        const j = this.job;
        this.job = null;
        if (Game.state === "playing" || Game.state === "ending") {
          // Another server or the player may have finished this task en route.
          if (j.run() === false) {
            this.t = 0;
            this.work = 0;
            this.task = "";
            return;
          }
          if (this.task) this.done[this.task] = (this.done[this.task] || 0) + 1;
        }
        this.work = j.hold;
        this.face = j.face;
      } else if (this.work > 0) {
        this.work -= dt;
        if (this.work <= 0) this.path = this.homePath();
      } else if (Game.state === "playing") {
        if (this.t <= 0) {
          const assigned = this.act();
          // Don't spend a whole serving interval waiting for an order to arrive.
          this.t = assigned ? this.spec.interval * this.slow : 0.25;
          if (!assigned && r.position.distanceTo(this.home) > 0.05)
            this.path = returningPath.length ? returningPath : this.homePath();
        }
      }
      const atHome =
        !moving &&
        !this.job &&
        this.work <= 0 &&
        r.position.distanceTo(this.home) < 0.05;
      const want = this.work > 0 ? this.face : atHome ? 0 : r.rotation.y;
      if (!moving) {
        let dr = want - r.rotation.y;
        while (dr > Math.PI) dr -= Math.PI * 2;
        while (dr < -Math.PI) dr += Math.PI * 2;
        r.rotation.y += dr * Math.min(1, dt * 8);
      }
      P.inner.position.y = moving
        ? Math.abs(Math.sin(this.anim * 13)) * 0.07
        : 0;
      P.armL.rotation.x = moving
        ? Math.sin(this.anim * 13) * 0.6
        : lerp(P.armL.rotation.x, this.work > 0 ? -0.7 : 0, dt * 8);
      P.armR.rotation.x = moving
        ? -Math.sin(this.anim * 13) * 0.6
        : this.work > 0
          ? -1.1 + Math.sin(this.anim * 18) * 0.35
          : lerp(P.armR.rotation.x, 0, dt * 6);
      if (atHome) P.inner.rotation.z = Math.sin(this.anim * 1.4) * 0.03;
    }
    // A dispatched rider rides off on the bike and comes back after the trip.
    rideAway(trip) {
      this.root.visible = false;
      if (this.bike) this.bike.visible = false;
      this.away = trip;
      this.path = [];
      this.job = null;
    }
    dispose() {
      this.tag?.remove();
      retainResources(this.root);
      world.remove(this.root);
      if (this.bike) {
        retainResources(this.bike);
        world.remove(this.bike);
      }
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
      // Header pills share their row with buttons; narrow phones get ₦85k.
      const narrow = innerWidth < 400;
      ["#menuCoins", "#mapCoins"].forEach(
        (s) =>
          ($(s).textContent = (narrow ? fmtNairaShort : fmtNaira)(
            Save.d.coins,
          )),
      );
      ["#shopCoins", "#missionCoins"].forEach(
        (s) => ($(s).textContent = fmtNaira(Save.d.coins)),
      );
      $("#mapStarCount").textContent =
        Object.values(Save.d.stars).reduce((a, b) => a + b, 0) +
        " / " +
        MAX_LEVEL * 3;
      $("#menuRep").textContent = Math.round(Save.d.reputation);
      $("#repPill").title = "Reputation · " + TIERS[tierOf(Save.d)].name;
      $("#growCoins").textContent = fmtNaira(Save.d.coins);
      const n = claimable(Save.d).count,
        b = $("#missionBadge");
      b.hidden = !n;
      b.textContent = n;
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
  function cashBurst(x, y, n, targetSel, onFirst) {
    const tgt = $(targetSel).getBoundingClientRect();
    const tx = tgt.left + tgt.width / 2,
      ty = tgt.top + tgt.height / 2;
    for (let i = 0; i < n; i++) {
      const { id, element: c } = bridge.effect("note", { x, y });
      const dx = rnd(-46, 46),
        dy = rnd(-60, -10);
      const a = c.animate(
        [
          { transform: "translate(-50%,-50%) scale(.3) rotate(0)", opacity: 0 },
          {
            transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.15) rotate(${dx * 2}deg)`,
            opacity: 1,
            offset: 0.3,
          },
          {
            transform: `translate(calc(-50% + ${tx - x}px),calc(-50% + ${ty - y}px)) scale(.7) rotate(-8deg)`,
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
  const WASH_TIME = 0.5;
  const BOOST_BTN = { freeze: "#bFreeze", auto: "#bAuto", calm: "#bCalm" };
  const Game = {
    state: "menu",
    cfg: null,
    customers: [],
    strollers: [],
    helpers: [],
    litter: [],
    laneX: [0],
    selected: null,
    cooldown: {},
    cookers: {},
    dirty: [false, false, false],
    plates: [null, null, null],
    chips: [null, null, null],
    sink: createSink(),
    freezeT: 0,
    orders: [],
    riders: [],
    packSel: null,
    bikes: [],
    tables: [],
    claimed: new Set(),
    washTime: 0.5,
    patienceRate() {
      return this.freezeT > 0 ? 0 : 1;
    },
    anyDirty() {
      return (
        this.dirty.some(Boolean) || this.tables.some((t) => t.plates.length)
      );
    },
    prepTime() {
      return Math.max(0.08, 0.32 - 0.045 * Save.d.up.fast);
    },
    cookSpeed() {
      return (
        (1 + 0.08 * Save.d.up.fast) *
        (this.eff ? this.eff.cookSpeed : 1) *
        (this.fx?.cook || 1)
      );
    },
    track(ev, n) {
      if (this.cfg?.mode === "watch") return;
      track(Save.d, ev, n, today());
    },
    // Reputation moves live during a shift and is saved at the end.
    rep(delta) {
      this.repNow = clampRep(this.repNow + delta);
    },
    staffOnDuty(role) {
      return this.helpers.some((h) => h.spec.role === role);
    },
    start(cfg) {
      if (LIVE.maintenance) {
        UI.toast("Mama Put Rush is under maintenance. Please try again soon.");
        return;
      }
      if (needsSignIn()) {
        UI.toast("Sign in to play");
        openAccount();
        return;
      }
      this.clear();
      ["ovReward", "ovDaily", "ovShop", "ovMissions"].forEach((id) =>
        UI.close(id),
      );
      this.cfg = cfg;
      // Playing a level takes you to its restaurant: its own equipment,
      // staff and look.
      if (cfg.mode === "level" && cfg.n) Save.d.place = placeFor(cfg);
      this.startedAt = performance.now();
      // Systems the admin has switched off for everyone.
      if (!LIVE.features.haggle) cfg.haggle = false;
      if (!LIVE.features.inspections) cfg.inspect = false;
      if (!LIVE.features.onlineOrders) cfg.online = false;
      if (!LIVE.features.events) cfg.event = "";
      this.eff = effects(Save.d);
      this.tierStart = tierOf(Save.d);
      // A bigger business draws a bigger crowd: more customers, more time.
      if (cfg.mode !== "endless" && this.tierStart) {
        cfg.goal += 2 * this.tierStart;
        cfg.duration += 6 * this.tierStart;
      }
      buildEnv(
        cfg.theme ?? cfg.ci,
        cfg.sign,
        cfg.mode === "endless" ? "endless" : Save.d.place,
      );
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
      this.toolsT = 0;
      this.freezeT = 0;
      this.handActs = 0;
      this.runT = 3;
      this.watchT = 1.5;
      this.priority = Save.d.priority || DEFAULT_PRIORITY;
      // Prices, decisions in effect, a catering contract and any disruption.
      const here = cfg.mode === "endless" ? "endless" : Save.d.place;
      const pr = pricing(Save.d, here);
      this.fx = activeEffects(Save.d, here);
      this.priceFactor = pr.mult * this.fx.price;
      this.gapFactor = pr.gap * this.fx.gap;
      this.commission = 0;
      this.disruptCost = 0;
      this.disruptLabel = "";
      this.contract = null;
      if (Save.d.contract && cfg.mode === "level" && cfg.n >= UNLOCKS.online) {
        this.contract = Save.d.contract;
        delete Save.d.contract;
      }
      this.wavePrev = 0;
      this.waveCoins = 0;
      this.waveLost = 0;
      this.special = null;
      this.specials = 0;
      this.specialT =
        (cfg.mode === "level" && cfg.n >= 6) ||
        cfg.mode === "daily" ||
        cfg.mode === "endless"
          ? rnd(40, 65)
          : Infinity;
      this.toldEmpty = false;
      // A long level continues from its last wave if the game was closed.
      if (cfg.mode === "level") {
        const run = cfg.resume;
        if (run) {
          this.score = this.dispScore = run.score || 0;
          this.coinsEarned = this.dispCoins = run.coinsEarned || 0;
          this.served = this.wavePrev = run.served || 0;
          this.lost = run.lost || 0;
          this.lives = Math.max(1, run.lives || 3);
          this.time = run.time ?? this.time;
          this.waveCoins = this.coinsEarned;
          this.waveLost = this.lost;
        } else delete Save.d.levelRun;
      }
      // Endless continues where it stopped when the game was closed.
      if (cfg.mode === "endless") {
        const run = cfg.resume;
        if (run) {
          this.score = this.dispScore = run.score || 0;
          this.coinsEarned = this.dispCoins = run.coinsEarned || 0;
          this.served = run.served || 0;
          this.lost = run.lost || 0;
          this.lives = Math.max(1, run.lives || 3);
          this.combo = run.combo || 0;
          this.bestCombo = run.bestCombo || 0;
        } else delete Save.d.endlessRun;
      }
      this.teaching =
        cfg.tutorial || (!!cfg.teach && !Save.d.taught.includes(cfg.teach));
      // Fried food starts raw. From the stock unlock, every pot, basin and
      // cooler also holds a batch that finishes and must be cooked again.
      this.cookers = {};
      const eff = this.eff,
        sized = (spec, cooler) => ({
          ...spec,
          batch: cooler
            ? Math.round(spec.batch * (eff.fridge ? 1.5 : 1))
            : spec.batch + eff.batchBonus,
        });
      cfg.foods.forEach((f) => {
        const cooler = FOODS[f].station === "cooler";
        if (cfg.cooking && FOODS[f].cook)
          this.cookers[f] = createCooker(sized(FOODS[f].cook, false));
        else if (cfg.stock && STOCK[FOODS[f].station])
          this.cookers[f] = createCooker(
            sized(STOCK[FOODS[f].station], cooler),
            true,
          );
      });
      this.serviceLoad = serviceLoad(cfg);
      this.sink = createSink(eff.sinkCap + this.serviceLoad.extraSinkCapacity);
      this.washTime = eff.washTime;
      this.claimed = new Set();
      this.fines = 0;
      this.settlements = 0;
      // For the debrief: ingredients taken from the store, and the extra
      // paid when the store was empty.
      this.storeUsed = 0;
      this.emergencyExtra = 0;
      this.busFees = 0;
      this.hygiene = 80;
      this.litter.forEach((l) => this.removeLitter(l));
      this.litter = [];
      this.litterT = rnd(8, 14);
      this.complaints = 0;
      this.complainT = 0;
      this.hygT = 0;
      this.inspector = null;
      this.inspectT =
        cfg.inspect &&
        Math.random() < LIVE.inspectionChance + 0.05 * this.tierStart
          ? rnd(25, Math.max(30, Math.min(120, (cfg.duration || 120) * 0.6)))
          : Infinity;
      this.tables = diningTables.map((t) => ({
        ...t,
        plates: [],
        chip: null,
        seats: t.seats.map((s) => ({ ...s, taken: null })),
      }));
      this.foodCost = 0;
      this.packCost = 0;
      this.riderFees = 0;
      this.repStart = this.repNow = Save.d.reputation;
      this.orders = [];
      this.packSel = null;
      this.orderT = cfg.online
        ? rnd(9, 14) * this.serviceLoad.onlineIntervalScale
        : Infinity;
      this.eventT = cfg.event
        ? cfg.event === "random"
          ? 60
          : rnd(6, 10)
        : Infinity;
      if (this.contract) this.eventT = rnd(12, 20);
      if (this.fx.noOnline) this.orderT = Infinity;
      else if (isFinite(this.orderT)) this.orderT *= this.fx.online;
      this.eventsDone = this.eventsFailed = 0;
      this.toldEvent = false;
      this.starveT = 0;
      this.bikes.forEach((b) => world.remove(b.o));
      this.bikes = [];
      chefState.tx = 0;
      chefState.x = 0;
      buildFoodButtons(cfg.foods);
      for (const k in roleCount) delete roleCount[k];
      // Only this restaurant's own crew works here. Managers run the
      // books, so they do not walk the floor.
      this.place = placeFor(cfg);
      this.manager = managerAt(Save.d, this.place);
      this.helpers = onShift(Save.d, this.place)
        .filter((s) => s.role !== "manager")
        .map((s) => new Helper(s));
      // Each okada lets one hired rider deliver for free.
      this.riders = createRiders(
        this.helpers
          .filter((h) => h.spec.role === "rider")
          .slice(0, eff.bikes)
          .map((h) => h.spec),
      );
      $("#hygiene").hidden = !cfg.dishes && !cfg.litter;
      this.renderOrders();
      $("#notify").classList.remove("show");
      bridge.caption(cfg, fmtNairaShort(Save.d.endlessBest));
      $("#hudTimer").hidden = !isFinite(this.time);
      // Watching an old restaurant: no buttons to press, it runs itself.
      $("#foodBar").hidden = cfg.mode === "watch";
      $("#btnWash").hidden = !cfg.dishes;
      const sb = $("#hudSbar").querySelectorAll("i");
      if (cfg.mode === "endless" || cfg.mode === "watch") {
        $("#hudSbar").parentElement.hidden = true;
      } else {
        $("#hudSbar").parentElement.hidden = false;
        cfg.stars.forEach((v, i) => {
          sb[i].style.left = (v / cfg.stars[2]) * 100 + "%";
          sb[i].classList.remove("on");
        });
      }
      this.syncStations();
      this.updateTools();
      this.updateHUD(true);
      $("#btnSpecial").hidden = true;
      updatePriorityBtn();
      UI.show("scrGame");
      camMode("game");
      this.state = "intro";
      this.introT = 2.1;
      const goalTxt =
        cfg.mode === "endless"
          ? "Serve as many customers as you can!"
          : `Serve ${cfg.goal} customers`;
      if (cfg.mode !== "watch" && !cfg.resume && !cfg.tutorial) {
        const x = drawDisruption(Save.d, {
          ...decisionCtx(),
          level: cfg.mode === "level" ? cfg.n : 20,
          online: !!cfg.online,
        });
        if (x) setTimeout(() => this.announce(x), 2300);
      }
      if (cfg.mode === "watch") {
        const m = managerAt(Save.d, Save.d.place);
        banner(
          `Watching ${cfg.title}`,
          m
            ? `${m.name} is running it today`
            : "No manager here: only its staff are working",
          "Pause to leave",
        );
        return;
      }
      if (cfg.resume && cfg.mode === "level") {
        const w = waveOf(this.served, cfg.goal);
        banner(
          `Level ${cfg.n} continues`,
          `Wave ${w.index + 1} of ${w.count} · ${this.served} / ${cfg.goal} served`,
          "",
          false,
        );
        return;
      }
      if (cfg.resume)
        banner(
          "Welcome back!",
          `Your Endless Rush continues: ${fmtNaira(this.score)}`,
          "",
          false,
        );
      else
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
      this.helpers.forEach((h) => h.dispose());
      this.helpers = [];
      if (this.inspector) world.remove(this.inspector.P.root);
      this.inspector = null;
      this.litter.forEach((l) => this.removeLitter(l));
      this.litter = [];
      for (const t of this.tables) {
        t.plates.forEach((m) => m.parent?.remove(m));
        if (t.chip) bridge.remove(t.chipId);
        if (t.food) t.food.parent?.remove(t.food);
      }
      this.tables = [];
      selRing.visible = false;
      flyers.forEach((f) => world.remove(f.obj));
      flyers.length = 0;
      trays.forEach((t, i) => this.clearTray(i));
      for (let i = 0; i < 3; i++) this.clearDirty(i);
      this.freezeT = 0;
      $("#freezeFx").classList.remove("on");
      $("#hand").hidden = true;
      this.orders = [];
      this.packSel = null;
      this.bikes.forEach((b) => world.remove(b.o));
      this.bikes = [];
      this.renderOrders();
    },
    clearTray(i) {
      const t = trays[i];
      if (!t) return;
      t.userData.items.forEach((o) => t.remove(o));
      t.userData.items = [];
    },
    clearDirty(i) {
      if (this.plates[i]) this.plates[i].parent?.remove(this.plates[i]);
      if (this.chips[i]) bridge.remove("chip-" + i);
      this.plates[i] = this.chips[i] = null;
      this.dirty[i] = false;
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
      for (let i = 0; i < c.lanes; i++)
        if (!this.laneBusy[i] && !this.dirty[i]) free.push(i);
      if (!free.length) return false;
      if (c.mode === "endless" && c.lanes === 3 && this.laneX.length < 3) {
        this.laneX = [-2.05, 0, 2.05];
        trays.forEach((t, i) => {
          t.visible = true;
          t.position.x = this.laneX[i];
        });
      }
      const lane = pick(free);
      const vip = Math.random() < c.vip && !c.tutorial,
        guest = c.guests && !vip && Math.random() < 0.75,
        type = vip || guest ? "regular" : pickCustomerType(c),
        kind = CUSTOMER_TYPES[type],
        mood = vip || guest ? null : pickMood(c);
      let k = c.imin;
      if (c.imax > c.imin)
        k =
          c.imax - c.imin === 1
            ? Math.random() < c.p2
              ? c.imax
              : c.imin
            : ri(c.imin, c.imax);
      if (kind.extraItem) k++;
      if (kind.maxItems) k = Math.min(k, kind.maxItems);
      k = Math.min(k, c.foods.length, 4);
      if (c.tutorial && this.served < 2) k = 1;
      let order;
      if (c.assembly) order = buildOrder(c.foods, k, { likes: kind.likes });
      else {
        const pool = c.foods.slice();
        order = [];
        for (let i = 0; i < k; i++)
          order.push(
            pool.splice(Math.floor(Math.random() * pool.length), 1)[0],
          );
      }
      const traits = customerTraits(type, mood);
      const pat =
        (c.patience + order.length * 2.6) *
        (1 + 0.1 * Save.d.up.patience) *
        this.eff.comfort *
        (vip ? 0.85 : 1) *
        (c.tutorial ? 1.5 : 1) *
        traits.patience;
      const bill = order.reduce((s2, f) => s2 + FOODS[f].price, 0);
      const argues =
        c.haggle &&
        !vip &&
        type !== "odogwu" &&
        Math.random() <
          (type === "conductor" || type === "okada" || type === "schoolkid"
            ? 0.32
            : 0.16);
      const cu = new Customer(lane, order, {
        vip,
        guest,
        type,
        mood,
        haggle: argues ? { full: bill, offer: makeOffer(bill) } : null,
        assembly: c.assembly,
        patience: pat,
        speed: c.fast ? 4.8 : type === "okada" ? 4.4 : 3.6,
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
      if (LINES[c.type]) pool = pool.concat(LINES[c.type], LINES[c.type]);
      if (c.guest) pool = pool.concat(LINES.guest, LINES.guest);
      if (c.vip) pool = LINES.vip;
      c.say(pick(pool), 2);
    },
    select(c) {
      if (this.state !== "playing" || c.state !== "wait") return;
      this.selected = this.selected === c ? null : c;
      Sound.play("click");
    },
    // A level's teaching hand retires after a few correct actions.
    noteAction() {
      if (!this.teaching || this.cfg.tutorial || ++this.handActs < 6) return;
      this.teaching = false;
      if (!Save.d.taught.includes(this.cfg.teach))
        Save.d.taught.push(this.cfg.teach);
    },
    tapFood(id, btn) {
      if (this.state !== "playing" || this.cfg.mode === "watch") return;
      btn = btn || document.querySelector(`.food[data-id="${id}"]`);
      const ck = this.cookers[id];
      if (ck && !hasPortion(ck)) {
        this.tapCookerFor(id, false);
        return;
      }
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
      Haptics.play("tap");
      const st = stations[id];
      if (st) {
        st.userData.bounce = 1;
        chefState.tx = clamp(st.position.x, -3, 3);
        chefState.stir = 0.3;
      }
      const cand = this.customers.filter((c) => c.needs(id));
      const selPack = this.orders.find((o) => o.id === this.packSel);
      const pack =
        selPack && packNeeds(selPack, id)
          ? selPack
          : !cand.length && this.orders.find((o) => packNeeds(o, id));
      if (pack && !cand.includes(this.selected)) {
        if (ck) takePortion(ck);
        this.fillPack(pack, id);
        this.noteAction();
        this.syncStations();
        return;
      }
      if (!cand.length) {
        // Right food, wrong moment: the main has to go on the plate first.
        const blocked = this.customers.find((c) => c.blocks(id));
        if (blocked) {
          Sound.play("wrong");
          const main = blocked.order.find(
            (o) => o.layer === 0 && !o.drink && !o.done,
          );
          blocked.wrongT = 0.4;
          const sp = screenPos(
            _v.set(blocked.root.position.x, 2.4, blocked.root.position.z),
          );
          floatText(
            sp.x,
            sp.y,
            (main ? FOODS[main.f].short : "Main") + " first!",
            "bad small",
          );
          return;
        }
        this.mistakes++;
        this.combo = 0;
        this.rep(REP.wrong);
        Sound.play("wrong");
        Haptics.play("wrong");
        if (btn) {
          btn.classList.remove("wrong");
          void btn.offsetWidth;
          btn.classList.add("wrong");
        }
        const w = this.customers
          .filter((c) => c.state === "wait")
          .sort((a, b) => a.p / a.max - b.p / b.max)[0];
        if (w) {
          w.p = Math.max(0.5, w.p - w.max * 0.08 * w.traits.wrong);
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
      const c = cand.includes(this.selected)
        ? this.selected
        : cand.sort((a, b) => a.p / a.max - b.p / b.max)[0];
      if (ck) takePortion(ck);
      this.deliver(
        c,
        id,
        st
          ? st.getWorldPosition(new T3.Vector3()).add(new T3.Vector3(0, 0.4, 0))
          : null,
      );
      this.noteAction();
      this.syncStations();
    },
    // Moves one item onto a customer's tray. Shared by the player, staff and Auto-Serve.
    deliver(c, id, from) {
      const slot = c.fill(id);
      const n = c.order.length;
      const tray = trays[c.lane];
      const item = foodModel(id);
      item.scale.setScalar(n > 2 ? 0.5 : 0.6);
      from = from || new T3.Vector3(0, 1.4, 2);
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
      this.track("food:" + id);
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
      if (c.haggle && !c.haggle.done) this.resolveHaggle(c, "refuse", true);
      const base = Math.round(
        c.order.reduce((s, o) => s + FOODS[o.f].price, 0) *
          c.priceMult *
          (this.priceFactor || 1),
      );
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
      const big = CUSTOMER_TYPES[c.type].bigTip;
      const tip = big
        ? roundNaira(rnd(big[0], big[1]), 500)
        : tipFor({
            base,
            patienceRatio: ratio,
            tipFactor: c.traits.tip * repTipFactor(this.repNow),
          });
      this.rep(fast ? REP.serveFast : REP.serve);
      if (big) setTimeout(() => c.say(pick(LINES.change), 1.6), 400);
      this.score += pts;
      this.coinsEarned += coins + tip;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.served++;
      this.afterServe();
      this.track("serve");
      this.track("earn", coins + tip);
      this.track("combo", this.combo);
      if (tip) this.track("tip");
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
      // Customers with a free, clean chair carry their plate to the table.
      c.seat = this.claimSeat(c);
      Sound.play("serve");
      Haptics.play("serve");
      const sp = screenPos(_v.set(c.root.position.x, 2.6, c.root.position.z));
      floatText(sp.x, sp.y, "+" + fmtNaira(pts));
      if (fast)
        setTimeout(
          () => floatText(sp.x, sp.y + 34, "FAST!", "green small"),
          120,
        );
      if (c.vip)
        setTimeout(() => floatText(sp.x, sp.y + 60, "VIP x2", "small"), 220);
      if (tip)
        setTimeout(
          () =>
            floatText(
              sp.x,
              sp.y + (c.vip ? 86 : 60),
              "Tip " + fmtNaira(tip),
              "green small",
            ),
          320,
        );
      cashBurst(
        sp.x,
        sp.y + 20,
        Math.min(8, 3 + Math.floor(coins / 1000)),
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
      this.checkGoal();
    },
    // The shop closes once the goal is met and no catering order is still open.
    checkGoal() {
      if (this.cfg.mode === "endless" || this.served < this.cfg.goal) return;
      if (!this.orders.some((o) => o.kind === "event")) this.finish(true);
      else if (!this.toldEvent) {
        this.toldEvent = true;
        this.notify("🍲", "Deliver the catering order to close for the day!");
      }
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
      if (this.cfg.mode === "watch") {
        c.say(pick(LINES.leave), 1.2);
        this.updateHUD();
        return;
      }
      this.lives--;
      this.lost++;
      this.combo = 0;
      this.rep(REP.lost);
      Sound.play("lose");
      Haptics.play("lost");
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
    /* ---- cooking stages ---- */
    tapCookerFor(id, byHelper) {
      const ck = this.cookers[id],
        st = stations[id],
        r = tapCooker(ck),
        sp = st && screenPos(st.getWorldPosition(new T3.Vector3()));
      if (r === "start") {
        // Ingredients are bought for the whole batch; the market errand haggles 20% off.
        // Ingredients come from the store; if it is empty they are bought on
        // the spot at a premium (the market errand gets 20% off).
        const g = FOOD_GROUP[id],
          discount = this.staffOnDuty("errand") ? 0.8 : 1,
          value = g ? batchUnits(id) * marketPrice(Save.d, g) * discount : 0,
          premium = g && isOut(Save.d, g) ? 1.6 : 1.4;
        const cost = ingredientsForBatch(Save.d, id, discount);
        this.foodCost += cost;
        // What came from the store, and the premium for buying on the spot.
        const spot = cost / premium;
        this.emergencyExtra += cost - spot;
        this.storeUsed += Math.max(0, value - spot);
        Sound.play("tap");
        if (st) st.userData.bounce = 1;
        if (!byHelper) {
          Haptics.play("tap");
          if (st) chefState.tx = clamp(st.position.x, -3, 3);
          chefState.stir = ck.spec.time;
          this.noteAction();
          if (sp)
            floatText(
              sp.x,
              sp.y - 40,
              cost
                ? `${ck.spec.verb}ing… -${fmtNaira(cost)}`
                : `${ck.spec.verb}ing… (from store)`,
              "small",
            );
        }
      } else if (r === "busy") {
        Sound.play("click");
        if (sp)
          floatText(
            sp.x,
            sp.y - 40,
            `Still ${ck.spec.verb.toLowerCase()}ing!`,
            "small",
          );
      } else if (r === "clear") {
        Sound.play("place");
        if (st)
          burst(st.getWorldPosition(new T3.Vector3()).setY(1.6), 8, 0.8, SMOKE);
        if (!byHelper) {
          this.noteAction();
          if (sp) floatText(sp.x, sp.y - 40, "Thrown away", "bad small");
        }
      }
      this.syncStations();
    },
    onCooker(id, ev) {
      const st = stations[id],
        pos = st && st.getWorldPosition(new T3.Vector3());
      if (ev === "ready") {
        Sound.play("place");
        if (pos) burst(pos.clone().setY(1.5), 8, 0.9, [0, 1, 2]);
        this.track("cook");
      } else if (ev === "burnt") {
        Sound.play("wrong");
        Haptics.play("burnt");
        if (pos) {
          burst(pos.clone().setY(1.5), 14, 0.7, SMOKE);
          const sp = screenPos(pos);
          floatText(sp.x, sp.y - 40, "Burnt!", "bad small");
        }
      }
      this.syncStations();
    },
    // Mirrors each pan's stage onto its food button and 3D station.
    syncStations() {
      for (const id in this.cookers) {
        const ck = this.cookers[id],
          btn = $(`.food[data-id="${id}"]`),
          st = stations[id];
        if (btn) {
          const k = cookerProgress(ck);
          btn.dataset.stage = ck.stage;
          btn.style.setProperty("--k", k.toFixed(3));
          btn.classList.toggle(
            "hot",
            ck.stage === "ready" && ck.spec.hold !== Infinity && k < 0.35,
          );
          btn.querySelector(".lbl").textContent =
            ck.stage === "raw"
              ? // Pans start the day empty; anything that ran out says so.
                FOODS[id].cook && !ck.batches
                ? "Tap: " + ck.spec.verb
                : "Finished!"
              : ck.stage === "cooking"
                ? ck.spec.verb + "ing"
                : ck.stage === "burnt"
                  ? "Burnt!"
                  : "";
          btn.querySelector(".stock").textContent = "x" + ck.stock;
          btn.classList.toggle(
            "low",
            ck.stage === "ready" && ck.spec.hold === Infinity && ck.stock <= 2,
          );
        }
        if (st) {
          st.userData.dish.visible = ck.stage === "ready";
          if (st.userData.char) st.userData.char.visible = ck.stage === "burnt";
          st.userData.steam =
            ck.stage === "cooking" || ck.stage === "ready"
              ? st.userData.steam0
              : [];
        }
      }
    },
    /* ---- online and catering orders ---- */
    renderOrders() {
      bridge.orders({
        orders: this.orders,
        foods: FOODS,
        events: EVENTS,
        art: ART,
        selected: this.packSel,
        select: (id) => {
          if (this.state !== "playing") return;
          this.packSel = this.packSel === id ? null : id;
          this.selected = null;
          Sound.play("click");
          this.renderOrders();
        },
        send: (id) => this.sendOrder(id),
      });
      $("#orders").classList.toggle("has", this.orders.length > 0);
    },
    notify(icon, text) {
      const n = $("#notify");
      n.textContent = icon + " " + text;
      n.classList.remove("show");
      void n.offsetWidth;
      n.classList.add("show");
      Sound.play("arrive");
      Haptics.play("serve");
    },
    addOrder(o) {
      this.orders.push(o);
      if (o.kind === "event") {
        const ev = EVENTS[o.event];
        this.notify(
          ev.icon,
          `${ev.name} order! ${portions(o)} portions for ${o.where}`,
        );
      } else this.notify("📱", `Online order from ${o.who} in ${o.where}`);
      this.renderOrders();
    },
    fillPack(o, id) {
      packFill(o, id);
      this.track("food:" + id);
      Sound.play("place");
      const st = stations[id];
      if (st) {
        st.userData.bounce = 1;
        burst(st.getWorldPosition(new T3.Vector3()).setY(1.5), 5, 0.6, [0, 2]);
      }
      if (packComplete(o) && this.packSel === o.id) this.packSel = null;
      this.renderOrders();
    },
    // Packs a finished order (₦150 per pack/cooler) and hands it to a rider.
    sendOrder(id, byRider) {
      const o = this.orders.find((x) => x.id === id);
      if (!o || o.packing || !packComplete(o) || this.state !== "playing")
        return;
      o.packing = 1;
      this.renderOrders();
      Sound.play("click");
      setTimeout(
        () => {
          if (!this.orders.includes(o) || this.state !== "playing") return;
          const { rider, fee: riderFee, trip } = dispatch(this.riders),
            fee =
              riderFee * (this.fx?.riderFee || 1) +
              (o.kind === "event" && !this.eff.bus ? BUS_HIRE : 0),
            gross = Math.round(orderValue(o) * (o.payMult || 1)),
            cut = Math.round(gross * (this.fx?.commission || 0)),
            value = gross - cut,
            packs = packsFor(o) * PACK_COST;
          this.packCost += packs;
          this.riderFees += fee;
          this.commission += cut;
          this.coinsEarned += value;
          this.score += value;
          this.served++;
          this.afterServe();
          this.track("serve");
          this.track("earn", value);
          this.rep(o.kind === "event" ? REP.eventDone : REP.delivered);
          if (o.kind === "event") this.eventsDone++;
          this.orders.splice(this.orders.indexOf(o), 1);
          this.renderOrders();
          this.rideOut(trip);
          if (rider)
            this.helpers.find((h) => h.spec.id === rider.id)?.rideAway(trip);
          Sound.play("serve");
          comboText(o.kind === "event" ? "CATERING DELIVERED!" : "DELIVERED!");
          const r = $("#orders").getBoundingClientRect();
          floatText(
            r.left + 80,
            r.top - 10,
            `+${fmtNaira(value)}${fee ? ` · rider -${fmtNaira(fee)}` : ""}`,
            "green small",
          );
          if (!rider && !byRider && !this.toldOnCall) {
            this.toldOnCall = true;
            UI.toast(
              "No dispatch rider on duty, so an outside rider was called. Hire Emeka to save the fee",
            );
          }
          this.updateHUD();
          this.checkGoal();
        },
        o.kind === "event" ? 1400 : 800,
      );
    },
    rideOut(trip) {
      const g = new T3.Group();
      const bike = okada(g);
      bike.rotation.y = 0;
      g.position.set(3.6, 0, STREET_Z - 0.6);
      world.add(g);
      this.bikes.push({ o: g, t: 0, trip });
    },
    updateOrders(dt) {
      tickRiders(this.riders, dt);
      for (let i = this.bikes.length - 1; i >= 0; i--) {
        const b = this.bikes[i];
        b.t += dt;
        b.o.position.x = 3.6 + b.t * b.t * 3;
        b.o.position.y = Math.abs(Math.sin(b.t * 18)) * 0.03;
        if (b.o.position.x > 18) {
          world.remove(b.o);
          this.bikes.splice(i, 1);
        }
      }
      for (const o of tickOrders(this.orders, dt)) {
        this.orders.splice(this.orders.indexOf(o), 1);
        if (this.packSel === o.id) this.packSel = null;
        this.rep(o.kind === "event" ? REP.eventFailed : REP.late);
        if (o.kind === "event") {
          this.eventsFailed++;
          setTimeout(() => this.state === "playing" && this.checkGoal(), 50);
        }
        Sound.play("lose");
        UI.toast(
          o.kind === "event"
            ? `${EVENTS[o.event].name} cancelled. Your name don spoil small.`
            : `${o.who} cancelled the online order. Too slow!`,
        );
        this.renderOrders();
      }
      for (const o of this.orders) {
        const bar = $(`[data-order="${o.id}"] .otime b`);
        if (bar) {
          const k = Math.max(0, o.t / o.max);
          bar.style.width = (k * 100).toFixed(1) + "%";
          bar.style.background =
            k > 0.5 ? "#2FA34F" : k > 0.25 ? "#FFB020" : "#E5343A";
        }
      }
      const c = this.cfg,
        open = this.orders.filter((o) => o.kind === "online").length,
        budget = c.mode === "endless" || this.served + this.pending() < c.goal;
      this.orderT -= dt;
      if (this.orderT <= 0) {
        this.orderT = this.fx?.noOnline
          ? Infinity
          : rnd(14, 22) *
            spawnFactor(this.repNow) *
            this.serviceLoad.onlineIntervalScale *
            (this.fx?.online || 1);
        if (open < this.serviceLoad.onlineLimit && budget)
          this.addOrder(
            makeOnlineOrder(
              c.foods,
              Math.random,
              this.serviceLoad.onlinePortions,
            ),
          );
      }
      this.eventT -= dt;
      if (this.eventT <= 0 && this.contract && !this.contract.sent) {
        const k = this.contract;
        k.sent = true;
        const o = makeEventOrder(k.event, c.foods, Math.random, k.size);
        o.max = o.t = Math.round(o.max * k.time);
        o.payMult = k.pay;
        this.addOrder(o);
        this.eventT = c.event === "random" ? rnd(80, 120) : Infinity;
        this.notify(
          k.icon,
          `Your contract is in: ${k.name}, ${k.portions} portions. Pack it before the timer runs out!`,
        );
      } else if (this.eventT <= 0) {
        this.eventT = c.event === "random" ? rnd(80, 120) : Infinity;
        if (budget || c.mode === "endless") {
          const id = c.event === "random" ? pick(Object.keys(EVENTS)) : c.event;
          this.addOrder(
            makeEventOrder(
              id,
              c.foods,
              Math.random,
              this.serviceLoad.onlinePortions,
            ),
          );
        }
      }
    },
    pending() {
      return (
        this.orders.length +
        this.customers.filter((x) => x.state === "enter" || x.state === "wait")
          .length
      );
    },
    // Customers waiting only on finished food complain and lose patience faster.
    checkStarving(dt) {
      this.starveT -= dt;
      const check = this.starveT <= 0;
      if (check) this.starveT = 0.5;
      for (const c of this.customers) {
        if (c.state !== "wait") {
          c.starved = false;
          continue;
        }
        const need = nextNeeded(c.order);
        c.starved =
          need.length > 0 &&
          need.every((it) => {
            const ck = this.cookers[it.f];
            return ck && ck.stage !== "ready";
          });
        if (
          c.starved &&
          check &&
          (c.complainT = (c.complainT || 0) - 0.5) <= 0
        ) {
          c.complainT = 5;
          c.say(pick(LINES.complain), 1.8);
          this.rep(REP.complain);
        }
      }
    },
    /* ---- haggling ---- */
    resolveHaggle(c, choice, served) {
      if (!c.haggle || c.haggle.done) return;
      let r = haggleOutcome(choice, c.haggle.full, c.haggle.offer);
      if (served && r.leaves)
        r = { price: c.haggle.full, rep: -0.5, line: "grumble" };
      c.haggle.done = true;
      c.el.querySelector(".haggle")?.remove();
      this.rep(r.rep);
      if (r.leaves) {
        c.say("I no fit pay that one! I dey go.", 1.6);
        c.state = "sad";
        c.st = 0;
        setFace(c.P, "sad");
        this.laneBusy[c.lane] = null;
        if (this.selected === c) this.selected = null;
        this.clearTray(c.lane);
        Sound.play("lose");
        return;
      }
      c.priceMult = r.price / c.haggle.full;
      c.say(
        r.line === "deal"
          ? "Deal! Thank you Mama!"
          : r.line === "insist"
            ? `Abeg, ${fmtNaira(c.haggle.offer)} last price!`
            : "Ehn! Okay sha, I go pay.",
        1.6,
      );
      if (r.line === "deal") c.p = Math.min(c.max, c.p + c.max * 0.2);
      Sound.play(r.line === "grumble" ? "wrong" : "click");
    },
    /* ---- dining tables ---- */
    claimSeat(c) {
      // A dirty plate only blocks its own chair, not the whole table.
      for (const t of this.tables) {
        const s = t.seats.find((x) => !x.taken && !x.plate);
        if (s) {
          s.taken = c;
          s.table = t;
          return s;
        }
      }
      return null;
    },
    startMeal(c) {
      const t = c.seat.table,
        f = c.order[0].f,
        m = foodModel(f);
      m.scale.setScalar(0.45);
      m.position.set(c.seat.x - t.x > 0 ? 0.18 : -0.18, 0.75, 0);
      t.g.add(m);
      c.meal = m;
      if (Math.random() < 0.5) c.say(pick(LINES.happy), 1.4);
    },
    finishMeal(c) {
      const s = c.seat,
        t = s.table;
      if (c.meal) t.g.remove(c.meal);
      s.taken = null;
      c.seat = null;
      if (Math.random() < 0.4 * this.eff.litterRate)
        this.dropLitter(s.x + rnd(-0.4, 0.4), s.z + rnd(-0.5, 0.3));
      if (this.cfg.dishes) {
        const p = dirtyPlate();
        p.scale.setScalar(0.6);
        p.position.set(s.x - t.x > 0 ? 0.18 : -0.18, 0.75, 0);
        t.g.add(p);
        t.plates.push(p);
        s.plate = p;
        const i = this.tables.indexOf(t);
        if (!t.chip) {
          t.chipId = "tchip-" + i;
          t.chip = bridge.chip(t.chipId, () => this.clearDiningTable(i), true);
        }
      }
      c.leave();
    },
    clearDiningTable(i, byHelper) {
      const t = this.tables[i];
      if (!t || !t.plates.length || this.state !== "playing") return false;
      while (t.plates.length && !sinkFull(this.sink)) {
        addPlate(this.sink);
        const plate = t.plates.pop();
        t.g.remove(plate);
        const seat = t.seats.find((s) => s.plate === plate);
        if (seat) seat.plate = null;
      }
      if (t.plates.length) {
        if (!byHelper) {
          Sound.play("wrong");
          UI.toast("Sink full! Wash the plates first");
        }
        return false;
      }
      t.seats.forEach((x) => (x.plate = null));
      bridge.remove(t.chipId);
      t.chip = null;
      Sound.play("place");
      if (!byHelper) Haptics.play("tap");
      this.updateTools();
      return true;
    },
    /* ---- hygiene and health inspectors ---- */
    updateHygiene() {
      const starving = this.customers.filter((c) => c.starved).length;
      this.hygiene = hygieneScore({
        equipment: this.eff.hygiene,
        cleaner: this.staffOnDuty("cleaner"),
        dirty:
          this.dirty.filter(Boolean).length +
          // A plate left on a dining table looks less bad than one on the counter.
          0.5 * this.tables.reduce((n, t) => n + t.plates.length, 0) +
          0.6 * this.litter.length,
        sinkFull: sinkFull(this.sink),
        starving,
      });
      const el = $("#hygiene");
      $("#hygTxt").textContent = Math.round(this.hygiene);
      el.classList.toggle("bad", this.hygiene < 55);
      el.classList.toggle("ok", this.hygiene >= 75);
    },
    /* ---- litter: customers drop rubbish; sweep it before they complain ---- */
    dropLitter(x, z) {
      if (!this.cfg.litter || this.litter.length >= 8) return;
      const kind = pick(LITTER_KINDS),
        m = litterModel(kind);
      x = clamp(x, -4.2, 4.2);
      z = clamp(z, -2.5, -0.15);
      m.position.set(x, 0.09, z);
      m.rotation.y = rnd(0, Math.PI * 2);
      world.add(m);
      const l = { id: ++litterSeq, x, z, m, kind, chip: null };
      l.chip = bridge.chip("litter-" + l.id, () => this.sweep(l), true, true);
      this.litter.push(l);
      this.updateTools();
    },
    removeLitter(l) {
      world.remove(l.m);
      bridge.remove("litter-" + l.id);
      l.chip = null;
    },
    sweep(l, byHelper) {
      if (!this.litter.includes(l) || this.state !== "playing") return false;
      this.litter.splice(this.litter.indexOf(l), 1);
      this.removeLitter(l);
      burst(new T3.Vector3(l.x, 0.3, l.z), 5, 0.6, [0, 1]);
      Sound.play("place");
      if (!byHelper) Haptics.play("tap");
      this.track("sweep");
      this.updateHygiene();
      return true;
    },
    updateLitter(dt) {
      if (!this.cfg.litter) return;
      // Passers-by and the wind add rubbish now and then. A renovated
      // building with proper bins gets less.
      this.litterT -= dt;
      if (this.litterT <= 0) {
        this.litterT = rnd(10, 18) / this.eff.litterRate;
        this.dropLitter(rnd(-4, 4), rnd(-2.4, -0.3));
      }
      // A dirty place gets complaints: patience drops and word spreads.
      this.complainT -= dt;
      if (this.complainT <= 0 && this.hygiene < 50 && this.litter.length >= 3) {
        this.complainT = 7;
        const c = pick(this.customers.filter((x) => x.state === "wait"));
        if (c) {
          c.say(pick(LINES.dirty), 1.8);
          c.p = Math.max(1, c.p - c.max * 0.12);
          this.complaints++;
          if (this.complaints === 1)
            this.notify("🧹", "Customers are complaining: sweep the floor!");
        }
      }
    },
    updateInspector(dt) {
      this.inspectT -= dt;
      if (!this.inspector && this.inspectT <= 0) {
        this.inspectT = Infinity;
        const P = makePerson({
          skin: pick(SKINS),
          bodyMat: M("#FFFFFF", { roughness: 0.6 }),
          accent: "#1E5AA8",
          hat: "cap",
          scale: 1,
        });
        P.root.position.set(-10, 0, STREET_Z);
        world.add(P.root);
        setFace(P, "neutral");
        this.inspector = {
          P,
          state: "in",
          t: 0,
          path: [V(INSPECT_POS.x, STREET_Z), V(INSPECT_POS.x, INSPECT_POS.z)],
        };
        this.notify("🧑‍⚕️", "Health inspector is here! Keep the kitchen clean");
        Sound.play("tick");
        return;
      }
      const ins = this.inspector;
      if (!ins) return;
      ins.t += dt;
      const r = ins.P.root,
        tgt = ins.path[0];
      if (tgt) {
        _v.subVectors(tgt, r.position);
        const d = _v.length();
        if (d < 0.08) ins.path.shift();
        else {
          r.position.addScaledVector(
            _v.multiplyScalar(1 / d),
            Math.min(d, 2.6 * dt),
          );
          r.rotation.y = Math.atan2(_v.x, _v.z);
        }
        ins.P.inner.position.y = Math.abs(Math.sin(ins.t * 11)) * 0.07;
        return;
      }
      ins.P.inner.position.y = 0;
      if (ins.state === "in") {
        ins.state = "checking";
        ins.t = 0;
        r.rotation.y = 0;
        ins.P.armR.rotation.x = -1.2;
      } else if (ins.state === "checking" && ins.t > 6) {
        const res = inspect(this.hygiene, this.tierStart);
        if (res.fine > 0) {
          ins.state = "talking";
          this.talkToInspector(res);
          return;
        }
        this.applyInspection(res);
      } else if (ins.state === "out") {
        world.remove(r);
        this.inspector = null;
      }
    },
    // The inspector's verdict: fines, reputation and, if sealed, a life.
    applyInspection(res) {
      const ins = this.inspector;
      if (!ins) return;
      const r = ins.P.root;
      this.fines += res.fine;
      this.rep(res.rep);
      const sp = screenPos(_v.set(r.position.x, 2.6, r.position.z));
      if (res.result === "settled") {
        floatText(sp.x, sp.y, "No fine today", "small");
      } else if (res.result === "pass") {
        floatText(sp.x, sp.y, "Clean kitchen! Passed", "green small");
        Sound.play("star");
      } else if (res.result === "warning") {
        floatText(sp.x, sp.y, "Warning: clean up!", "small");
        UI.toast("Inspector warning: dirty plates and tables. Clean up!");
      } else {
        floatText(sp.x, sp.y, "Fined " + fmtNaira(res.fine), "bad small");
        UI.toast(
          res.result === "sealed"
            ? `Very dirty kitchen! Fined ${fmtNaira(res.fine)} and customers scared off`
            : `Hygiene fine: ${fmtNaira(res.fine)}. Buy a handwash station, hire a cleaner`,
        );
        Sound.play("lose");
        if (res.result === "sealed") {
          this.lives--;
          this.updateHUD();
          if (this.lives <= 0) this.finish(false, "lives");
        }
      }
      ins.state = "out";
      ins.path = [V(INSPECT_POS.x, STREET_Z), V(10, STREET_Z)];
      ins.P.armR.rotation.x = 0;
    },
    /* ---- service waves: a short planning break between waves ---- */
    afterServe() {
      const c = this.cfg;
      if (c.mode !== "level" || this.state !== "playing") return;
      const prev = this.wavePrev;
      this.wavePrev = this.served;
      if (waveDone(prev, this.served, c.goal)) this.waveBreak();
    },
    waveBreak() {
      const c = this.cfg,
        done = waveOf(this.served - 1, c.goal);
      this.prevState = this.state;
      this.state = "break";
      $("#waveTitle").textContent =
        `Wave ${done.index + 1} of ${done.count} done!`;
      $("#waveServed").textContent = `${this.served} / ${c.goal}`;
      $("#waveSales").textContent = fmtNaira(this.coinsEarned - this.waveCoins);
      $("#waveLost").textContent = String(this.lost - this.waveLost);
      $("#waveNext").textContent =
        `Next: customers ${done.end + 1} to ${waveOf(done.end, c.goal).end}. Restock, set your crew's priority, then open the doors.`;
      this.waveCoins = this.coinsEarned;
      this.waveLost = this.lost;
      renderPriority("#wavePriority");
      $("#wavePriority").hidden = !this.helpers.length;
      this.saveLevelRun();
      UI.open("ovWave");
      Sound.play("star");
    },
    endBreak() {
      UI.close("ovWave");
      UI.close("ovMarket");
      this.state = "playing";
      banner("Doors open!", "Next wave coming in", "", false);
    },
    // Keeps a long level so closing the game resumes it at the last wave.
    saveLevelRun() {
      const c = this.cfg;
      if (c?.mode !== "level" || waveCount(c.goal) < 2) return;
      Save.d.levelRun = {
        n: c.n,
        score: Math.round(this.score),
        coinsEarned: Math.round(this.coinsEarned),
        served: this.served,
        lost: this.lost,
        lives: this.lives,
        time: Math.round(this.time),
        at: Date.now(),
      };
      Save.save();
    },
    /* ---- announced disruptions: the owner chooses the cost ---- */
    announce(x) {
      if (this.state !== "playing") return;
      this.prevState = this.state;
      this.state = "talk";
      this.disruption = x;
      $("#disruptTitle").textContent = `${x.icon} ${x.title}`;
      $("#disruptText").textContent = x.text;
      x.choices.forEach((c, i) => {
        const b = $("#disrupt" + i);
        b.querySelector(".buttonLabel").textContent =
          c.label + (c.cost ? ` (${fmtNaira(c.cost)})` : "");
        b.title = c.note || "";
      });
      $("#disruptNote").textContent = x.choices
        .map((c) => (c.note ? `${c.label}: ${c.note}.` : ""))
        .join(" ");
      UI.open("ovDisrupt");
      Sound.play("tick");
    },
    resolveDisruption(i) {
      const x = this.disruption;
      if (!x) return;
      const c = x.choices[i];
      this.disruptCost += c.cost;
      this.disruptLabel = `${x.title}: ${c.label.toLowerCase()}`;
      const e = c.effect || {};
      if (e.cook) this.fx.cook = (this.fx.cook || 1) * e.cook;
      if (e.price) this.priceFactor *= e.price;
      if (e.riderFee) this.fx.riderFee = e.riderFee;
      if (e.noOnline) {
        this.fx.noOnline = true;
        this.orderT = Infinity;
      }
      this.disruption = null;
      UI.close("ovDisrupt");
      this.state = "playing";
      if (c.note) UI.toast(c.note);
    },
    /* ---- crew priority ---- */
    setPriority(key) {
      if (!PRIORITIES[key]) return;
      this.priority = key;
      Save.d.priority = key;
      Save.save();
      renderPriority("#wavePriority");
      updatePriorityBtn();
      UI.toast(`${PRIORITIES[key].label}: ${PRIORITIES[key].desc}`);
    },
    /* ---- owner specials: premium plates the owner finishes ---- */
    updateSpecial(dt) {
      if (this.special) {
        this.special.left -= dt;
        if (this.special.left <= 0) {
          this.special = null;
          $("#btnSpecial").hidden = true;
        }
        return;
      }
      this.specialT -= dt;
      if (this.specialT > 0) return;
      this.specialT = rnd(55, 90);
      const options = specialsFor(this.cfg.foods).filter((d) => {
        const ck = this.cookers[d.food];
        return !ck || hasPortion(ck);
      });
      if (!options.length) return;
      const dish = pick(options);
      this.special = { dish, left: 25 };
      const b = $("#btnSpecial");
      b.hidden = false;
      b.querySelector("b").textContent = dish.name;
      this.notify(
        "🍽️",
        `A guest wants the ${dish.name}. Tap Special to plate it yourself!`,
      );
      Sound.play("combo");
    },
    openSpecial() {
      if (!this.special || this.state !== "playing") return;
      const d = this.special.dish;
      this.prevState = this.state;
      this.state = "special";
      $("#specialName").textContent = d.name;
      $("#specialInfo").textContent =
        `Your crew cooked it; you plate it. Tap when the marker is in the middle. Up to ${fmtNaira(specialPrice(FOODS[d.food].price, d, plateQuality(0.5)))}.`;
      const m = $("#specialMarker");
      m.style.animation = "none";
      void m.offsetWidth;
      m.style.animation = "";
      UI.open("ovSpecial");
    },
    plateSpecial() {
      if (this.state !== "special" || !this.special) return;
      const bar = $("#specialBar").getBoundingClientRect(),
        mk = $("#specialMarker").getBoundingClientRect(),
        pos = clamp((mk.left + mk.width / 2 - bar.left) / bar.width, 0, 1);
      const d = this.special.dish,
        q = plateQuality(pos),
        price = specialPrice(FOODS[d.food].price, d, q);
      const ck = this.cookers[d.food];
      if (ck && hasPortion(ck)) takePortion(ck);
      this.coinsEarned += price;
      this.score += price;
      this.specials++;
      this.rep(q.rep);
      this.special = null;
      $("#btnSpecial").hidden = true;
      UI.close("ovSpecial");
      this.state = "playing";
      Sound.play(q.bonus >= 0.7 ? "star" : "coin");
      comboText(`${q.grade.toUpperCase()}! +${fmtNairaShort(price)}`);
      this.track("earn", price);
      this.updateHUD();
    },
    // Keeps an Endless run so closing the game does not lose it.
    saveRun(active = true) {
      if (this.cfg?.mode !== "endless" || this.state === "over") return;
      Save.d.endlessRun = {
        active,
        score: Math.round(this.score),
        coinsEarned: Math.round(this.coinsEarned),
        served: this.served,
        lost: this.lost,
        lives: this.lives,
        combo: this.combo,
        bestCombo: this.bestCombo,
        at: Date.now(),
      };
      Save.save();
    },
    // Watching: the manager covers the counter and the pots so the
    // restaurant runs by itself; staff work as usual.
    watchTick(dt) {
      const m = managerAt(Save.d, Save.d.place);
      this.watchT -= dt;
      if (this.watchT > 0) return;
      this.watchT = m ? [0, 2.4, 1.8, 1.3][m.stars] : 1;
      if (!m && !this.helpers.length && !this.toldEmpty) {
        this.toldEmpty = true;
        this.notify(
          "🪑",
          "Nobody works here yet. Hire staff or a manager in Grow → Staff",
        );
      }
      if (!m) return;
      for (const id in this.cookers) {
        const ck = this.cookers[id];
        if (
          ck.stage === "burnt" ||
          (ck.stage === "raw" && FOODS[id].station !== "cooler")
        )
          this.tapCookerFor(id, true);
        else if (ck.stage === "raw") ck.stock = ck.spec.batch;
      }
      const c = this.customers
        .filter((x) => x.state === "wait")
        .sort((a, b) => a.p / a.max - b.p / b.max)[0];
      if (!c) return;
      for (let guard = 0; c.state === "wait" && guard < 8; guard++) {
        const it = nextNeeded(c.order).find((o) => {
          const k = this.cookers[o.f];
          return !!stations[o.f] && (!k || hasPortion(k));
        });
        if (!it) break;
        const k = this.cookers[it.f];
        if (k) takePortion(k);
        this.deliver(
          c,
          it.f,
          stations[it.f].getWorldPosition(new T3.Vector3()).setY(1.4),
        );
      }
    },
    /* ---- talking to the inspector: pay, "settle" him, or beg ---- */
    talkToInspector(res) {
      const fine = res.fine;
      this.talk = {
        res,
        fine,
        mood: inspectorMood(),
        offers: [0.3, 0.5, 0.7].map((k) => roundNaira(fine * k, 500)),
        last: 0,
      };
      this.prevState = this.state;
      this.state = "talk";
      setFace(this.inspector.P, "sad");
      this.showTalk(pick(INSPECTOR_LINES.intro));
      UI.open("ovInspect");
      Sound.play("tick");
    },
    showTalk(line) {
      const t = this.talk;
      $("#inspLine").textContent = `“${line}”`;
      $("#inspInfo").textContent =
        `Hygiene ${Math.round(this.hygiene)}. Official fine: ${fmtNaira(t.fine)}` +
        (t.res.result === "sealed"
          ? ", and customers will be scared off."
          : ".");
      $("#inspPay .buttonLabel").textContent =
        `Pay the fine (${fmtNaira(t.fine)})`;
      t.offers.forEach((v, i) => {
        const b = $("#inspOffer" + i);
        b.querySelector(".buttonLabel").textContent = `Offer ${fmtNaira(v)}`;
        b.disabled = v <= t.last;
      });
      $("#inspBeg").disabled = t.mood.begged;
    },
    endTalk(res, line, cls) {
      UI.close("ovInspect");
      this.state = this.prevState === "talk" ? "playing" : this.prevState;
      this.talk = null;
      const ins = this.inspector;
      if (ins && line) {
        const sp = screenPos(
          _v.set(ins.P.root.position.x, 2.6, ins.P.root.position.z),
        );
        floatText(sp.x, sp.y, line, cls || "small");
      }
      this.applyInspection(res);
    },
    payInspector() {
      if (!this.talk) return;
      this.endTalk(this.talk.res);
    },
    bribeInspector(i) {
      const t = this.talk;
      if (!t) return;
      const amount = t.offers[i];
      const r = offerInspector(t.mood, t.fine, amount);
      if (r.result === "lowball") {
        t.last = amount;
        Sound.play("wrong");
        this.showTalk(r.line);
        return;
      }
      if (r.result === "accept") {
        this.settlements += amount;
        Sound.play("coin");
        UI.toast(`“${r.line}”`);
        // He leaves without writing anything; word still gets around a bit.
        this.endTalk({ result: "settled", fine: 0, rep: -1 });
        return;
      }
      // An honest or annoyed inspector raises the fine.
      Sound.play("lose");
      UI.toast(`“${r.line}”`);
      this.endTalk({ ...t.res, fine: r.fine, rep: t.res.rep - 3 });
    },
    begInspector() {
      const t = this.talk;
      if (!t || t.mood.begged) return;
      const r = begInspector(t.mood, this.hygiene);
      if (r.result === "warning") {
        Sound.play("star");
        UI.toast(`“${r.line}”`);
        this.endTalk({ result: "warning", fine: 0, rep: -1 });
        return;
      }
      Sound.play("wrong");
      this.showTalk(r.line);
    },
    /* ---- tables and the sink ---- */
    leaveDirty(lane) {
      const p = dirtyPlate();
      p.scale.setScalar(0.9);
      p.position.set(0, 0.04, 0);
      trays[lane].add(p);
      this.plates[lane] = p;
      this.dirty[lane] = true;
      this.chips[lane] = bridge.chip("chip-" + lane, () =>
        this.clearTable(lane),
      );
    },
    clearTable(lane, byHelper) {
      if (!this.dirty[lane] || this.state !== "playing") return false;
      if (sinkFull(this.sink)) {
        if (!byHelper) {
          Sound.play("wrong");
          UI.toast("Sink full! Wash the plates first");
          UI.pop($("#btnWash"));
        }
        return false;
      }
      addPlate(this.sink);
      const p = this.plates[lane],
        w = p.getWorldPosition(new T3.Vector3());
      p.parent.remove(p);
      fly(p, w, new T3.Vector3(-4.6, 1.2, 2.2), 0.35, 0.8, (o) =>
        world.remove(o),
      );
      this.plates[lane] = null;
      this.clearDirty(lane);
      Sound.play("place");
      if (!byHelper) {
        Haptics.play("tap");
        this.noteAction();
      }
      this.updateTools();
      return true;
    },
    wash(byHelper) {
      if (this.state !== "playing") return false;
      if (!startWash(this.sink)) {
        if (!byHelper && !this.sink.plates) UI.toast("No plates to wash yet");
        return false;
      }
      Sound.play("click");
      if (!byHelper) this.noteAction();
      this.updateTools();
      return true;
    },
    /* ---- boosters ---- */
    fireBooster(id) {
      if (this.state !== "playing" || this.cfg.mode === "watch") return;
      if (!(Save.d.boosters[id] > 0)) {
        Sound.play("wrong");
        UI.toast("No boosters left. Buy more in the shop!");
        return;
      }
      const waiting = this.customers
        .filter((c) => c.state === "wait")
        .sort((a, b) => a.p / a.max - b.p / b.max);
      if (id !== "freeze" && !waiting.length) {
        UI.toast("Nobody is waiting yet");
        return;
      }
      if (id === "freeze" && this.freezeT > 0) return;
      Save.d.boosters[id]--;
      this.track("booster");
      Sound.play("combo");
      Haptics.play("serve");
      if (id === "freeze") {
        this.freezeT = BOOSTERS.find((b) => b.id === "freeze").duration;
        $("#freezeFx").classList.add("on");
        comboText("FREEZE!");
        this.customers.forEach((c) =>
          burst(c.root.position.clone().setY(2), 6, 0.8, ICE),
        );
      } else if (id === "auto") {
        const c = waiting[0];
        for (let guard = 0; c.state === "wait" && guard < 8; guard++) {
          const next = nextNeeded(c.order)[0];
          if (!next) break;
          const st = stations[next.f];
          this.deliver(
            c,
            next.f,
            st && st.getWorldPosition(new T3.Vector3()).setY(1.4),
          );
        }
        comboText("AUTO-SERVE!");
      } else {
        waiting.forEach((c) => {
          c.p = c.max;
          const sp = screenPos(
            _v.set(c.root.position.x, 2.4, c.root.position.z),
          );
          floatText(sp.x, sp.y, "Patience full!", "green small");
        });
        comboText("PATIENCE BOOST!");
      }
      this.updateTools();
    },
    updateTools() {
      if (this.cfg?.dishes) {
        const s = this.sink;
        // Keep the count visible while washing, too.
        $("#washTxt").textContent = `${s.plates}/${s.capacity}`;
        $("#btnWash").setAttribute(
          "aria-label",
          `${s.washing ? "Washing" : "Wash"} plates: ${s.plates} of ${s.capacity}; ${s.washed} washed this shift`,
        );
        $("#btnWash").classList.toggle("full", sinkFull(s));
        $("#washBar").style.width = s.washing
          ? Math.min(100, (s.washing / this.washTime) * 100).toFixed(0) + "%"
          : "0";
      }
      BOOSTERS.forEach((b) => {
        const el = $(BOOST_BTN[b.id]),
          n = Save.d.boosters[b.id] || 0;
        el.querySelector("b").textContent = n;
        el.classList.toggle("empty", !n);
      });
      $("#bFreeze").classList.toggle("active", this.freezeT > 0);
    },
    wageBill() {
      return crewWages(Save.d, this.place || placeFor(this.cfg));
    },
    owedNow() {
      return owedAt(Save.d, this.place || placeFor(this.cfg));
    },
    // Settles the shift: costs and salaries are paid from the takings, then
    // savings. Unpaid staff get a strike and quit at the limit.
    settle(sales, extra) {
      const d = Save.d,
        tier = this.tierStart ?? tierOf(d),
        tax = taxes(tier, sales + extra),
        rent = roundNaira(RENT[tier] * LIVE.rent, 10),
        upkeep = upkeepCost(d, this.place || placeFor(this.cfg)),
        // A manager here trims waste on ingredients and packs.
        saving = this.manager ? this.manager.saving : 0,
        waste = roundNaira((this.foodCost + this.packCost) * saving, 10),
        costs =
          this.foodCost +
          this.packCost -
          waste +
          this.riderFees +
          tax.levy +
          tax.vat +
          rent +
          upkeep +
          (this.fines || 0) +
          (this.settlements || 0) +
          (this.commission || 0) +
          (this.disruptCost || 0),
        net = sales + extra - costs;
      const place = this.place || placeFor(this.cfg);
      // A working day: staff here earn their wage into what they are owed.
      // You pay them yourself from the Staff screen before month end.
      const day = workDay(d, place);
      // Other restaurants with a manager bank their takings in the safe.
      // They earn less when the brand's reputation slips.
      const away = runBranches(
        d,
        place,
        clamp(this.repNow / 60, 0.4, 1.2),
        UNPAID_LIMIT,
      );
      const debtBefore = d.debt;
      d.coins = settleDebt(d, d.coins + net);
      if (d.debt > 0) this.repNow = clampRep(this.repNow - 3);
      if (this.complaints >= 3) this.repNow = clampRep(this.repNow - 2);
      const repBefore = this.repStart;
      d.reputation = Math.round(this.repNow * 10) / 10;
      const market = advanceMarket(d, this.eff.fridgeCap);
      d.lastPlayed = today();
      const rows = [];
      const neg = (label, v) =>
        v && rows.push({ label, value: "-" + fmtNaira(v), cls: "neg" });
      neg("Ingredients (on the spot)", this.foodCost);
      neg("Takeaway packs", this.packCost);
      neg("Outside riders & bus hire", this.riderFees);
      neg("LGA levy", tax.levy);
      neg("VAT 7.5%", tax.vat);
      neg("Rent & NEPA light", rent);
      neg("Equipment upkeep", upkeep);
      neg("Hygiene fine", this.fines);
      neg("Delivery app commission", this.commission);
      neg(this.disruptLabel || "Disruption", this.disruptCost);
      neg("Inspector “settlement”", this.settlements);
      if (this.complaints >= 3)
        rows.push({
          label: `${this.complaints} complaints about dirt`,
          value: "★ -2",
          cls: "warn",
        });
      const owed = owedAt(d, place);
      if (owed)
        rows.push({
          label: `Salaries owed (payday in ${daysToPayday(d)} day${daysToPayday(d) === 1 ? "" : "s"})`,
          value: fmtNaira(owed),
          cls: daysToPayday(d) <= 2 ? "warn" : "",
        });
      if (waste)
        rows.push({
          label: `${this.manager.name} saved on waste`,
          value: "+" + fmtNaira(waste),
          cls: "pos",
        });
      const banked = away.reduce((t, b) => t + Math.max(0, b.net), 0);
      if (banked)
        rows.push({
          label: "Managers banked at other restaurants",
          value: "+" + fmtNaira(banked) + " (collect in Grow)",
          cls: "pos",
        });
      if (away.some((b) => b.full))
        rows.push({
          label: "A manager's safe is full",
          value: "Collect it in Grow",
          cls: "warn",
        });
      if (d.debt > 0)
        rows.push({
          label: "Unpaid bills (debt)",
          value: fmtNaira(d.debt),
          cls: "warn",
        });
      else if (debtBefore > 0)
        rows.push({ label: "Debt cleared", value: "✓", cls: "pos" });
      if (market.spoiled)
        rows.push({
          label: this.eff.fridgeCap
            ? "Spoiled stock (freezer full)"
            : "Spoiled stock (no freezer)",
          value: market.spoiled + " units",
          cls: "warn",
        });
      const dRep = Math.round((d.reputation - repBefore) * 10) / 10;
      rows.push({
        label: "Reputation",
        value: `★ ${Math.round(d.reputation)} (${dRep >= 0 ? "+" : ""}${dRep})`,
        cls: dRep >= 0 ? "pos" : "neg",
      });
      const tierNow = tierOf(d);
      if (tierNow !== tier)
        rows.push({
          label: tierNow > tier ? "Business grew to" : "Business fell to",
          value: TIERS[tierNow].name,
          cls: tierNow > tier ? "pos" : "warn",
        });
      day.warned.forEach((m) =>
        rows.push({
          label: `${m.name} was not paid this month`,
          value: `Strike ${m.strikes}/${QUIT_STRIKES}`,
          cls: "warn",
        }),
      );
      [...day.quit.map((m) => m.name), ...away.flatMap((b) => b.quit)].forEach(
        (n) =>
          rows.push({
            label: `${n} quit: unpaid`,
            value: "Gone",
            cls: "warn",
          }),
      );
      if (this.specials)
        rows.push({
          label: "Owner's specials plated",
          value: String(this.specials),
          cls: "pos",
        });
      for (const h of this.helpers) {
        const n = Object.values(h.done).reduce((t, v) => t + v, 0);
        if (n)
          rows.push({
            label: `${h.spec.name} (${h.spec.title.toLowerCase()})`,
            value: Object.entries(h.done)
              .map(([k, v]) => `${v} ${TASK_WORDS[k] || k}`)
              .join(", "),
            cls: "staffRow",
          });
      }
      if (market.news)
        rows.push({ label: "Market news", value: market.news, cls: "news" });
      // The books and Mama Nkechi's debrief.
      const wages = crewWages(d, place);
      recordDay(d, {
        day: d.day,
        place,
        mode: this.cfg.mode,
        level: this.cfg.n || 0,
        sales: sales + extra,
        food: this.foodCost + this.storeUsed,
        wages,
        costs,
        net: net - wages,
        served: this.served,
        lost: this.lost,
        spoiled: market.spoiled,
      });
      const insights = shiftInsights(
        {
          sales: sales + extra,
          foodCost: this.foodCost,
          storeUsed: this.storeUsed,
          emergencyExtra: roundNaira(this.emergencyExtra, 10),
          packCost: this.packCost,
          riderFees: this.riderFees,
          rent,
          upkeep,
          taxes: tax.levy + tax.vat,
          fines: this.fines,
          settlements: this.settlements,
          wages,
          served: this.served,
          lost: this.lost,
          spoiled: market.spoiled,
          complaints: this.complaints,
          net: net - wages,
          debt: d.debt,
          owed: owedAt(d, place),
          payday: daysToPayday(d),
        },
        fmtNaira,
      );
      const repaid = payLoans(d);
      if (repaid)
        rows.push({
          label: "Loan repaid",
          value: "-" + fmtNaira(repaid),
          cls: "neg",
        });
      // Decisions whose days are up: what was expected against what happened.
      for (const e of resolveDecisions(d, decisionCtx())) {
        insights.unshift({
          tone: e.outcome.good ? "good" : "bad",
          weight: 99,
          title: `Your decision: ${e.title}`,
          tip: e.outcome.text,
        });
      }
      return {
        net,
        rows,
        quit: day.quit.map((m) => m.name),
        insights: insights.slice(0, 4),
      };
    },
    finish(won, why) {
      if (this.state !== "playing") return;
      this.state = "ending";
      this.endT = won ? 1.3 : 1.1;
      this.won = won;
      this.why = why;
      $("#hand").hidden = true;
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
    // Sends the finished shift to the backend and syncs the cloud save.
    report(won, sales, cash, stars) {
      const cfg = this.cfg;
      Online.reportShift({
        mode: cfg.mode,
        level: cfg.mode === "level" ? cfg.n : null,
        won: !!won,
        served: this.served,
        lost: this.lost,
        sales: Math.max(0, Math.round(sales)),
        cash: Math.round(cash),
        stars: stars || 0,
        duration: Math.round(
          (performance.now() - (this.startedAt || 0)) / 1000,
        ),
      }).then((r) => {
        if (r?.coins > 0) {
          UI.toast(`+${r.coins} coins in your wallet`);
          showAccountDot();
        }
      });
      scheduleSync();
    },
    showEnd() {
      this.state = "over";
      if (this.cfg.mode === "level") delete Save.d.levelRun;
      const cfg = this.cfg;
      this.orders = [];
      this.renderOrders();
      if (cfg.mode === "endless") {
        delete Save.d.endlessRun;
        const shift = this.settle(roundNaira(this.coinsEarned * 0.6), 0),
          coins = shift.net;
        bridge.ledger("winLedger", shift.rows);
        showInsights("winInsights", shift.insights);
        const nb = this.score > Save.d.endlessBest;
        if (nb) Save.d.endlessBest = this.score;
        Save.save();
        this.report(true, this.coinsEarned, coins, 0);
        $("#winTitle").textContent = nb ? "New Best!" : "Rush Over!";
        $("#winSub").textContent =
          `You served ${this.served} customers. Personal best: ${fmtNaira(Save.d.endlessBest)}`;
        document
          .querySelectorAll("#ovWin .bigstar")
          .forEach((s) => s.classList.remove("on"));
        $("#ovWin .bigstars").hidden = true;
        $("#winScore").textContent = fmtNaira(this.score);
        $("#winCoins").textContent = fmtNaira(coins);
        $("#winL3").textContent = "Best combo";
        $("#winCombo").textContent = "x" + this.bestCombo;
        $("#winNext").hidden = true;
        UI.open("ovWin");
        Sound.play(nb ? "win" : "fail");
        if (nb) confetti(160);
        return;
      }
      if (this.won) {
        const timeBonus = isFinite(this.time) ? Math.floor(this.time) * 50 : 0;
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
          if (Save.d.unlocked <= k)
            Save.d.unlocked = Math.min(MAX_LEVEL + 1, k + 1);
        } else if (cfg.mode === "daily" && Save.d.dailyDone !== today()) {
          bonus = LIVE.dailyBonus;
          Save.d.dailyDone = today();
        }
        const shift = this.settle(this.coinsEarned, bonus),
          total = shift.net;
        bridge.ledger("winLedger", shift.rows);
        showInsights("winInsights", shift.insights);
        Save.d.tutorialDone = true;
        this.track("win");
        if (!this.lost) this.track("perfect");
        Save.save();
        this.report(true, this.coinsEarned, total, stars);
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
          (timeBonus ? ` Time bonus +${fmtNaira(timeBonus)}` : "") +
          (bonus ? ` · Daily bonus +${fmtNaira(bonus)}` : "");
        $("#ovWin .bigstars").hidden = false;
        const st = document.querySelectorAll("#ovWin .bigstar");
        st.forEach((s) => s.classList.remove("on"));
        $("#winScore").textContent = fmtNaira(0);
        $("#winCoins").textContent = fmtNaira(0);
        $("#winL3").textContent = "Best combo";
        $("#winCombo").textContent = "x" + this.bestCombo;
        $("#winNext").hidden = cfg.mode !== "level";
        $("#winNext .buttonLabel").textContent =
          cfg.n >= MAX_LEVEL ? "Endless!" : "Next";
        UI.open("ovWin");
        Sound.play("win");
        Haptics.play("win");
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
        countUp($("#winScore"), this.score, 900, fmtNaira);
        countUp($("#winCoins"), total, 1100, fmtNaira);
      } else {
        // Customers who were served still paid; the bills still come due.
        const shift = this.settle(this.coinsEarned, 0);
        bridge.ledger("failLedger", [
          { label: "Sales", value: fmtNaira(this.coinsEarned) },
          ...shift.rows,
          {
            label: "Cash in hand",
            value: (shift.net < 0 ? "-" : "") + fmtNaira(Math.abs(shift.net)),
            cls: shift.net < 0 ? "neg" : "pos",
          },
        ]);
        showInsights("failInsights", shift.insights);
        Save.save();
        this.report(false, this.coinsEarned, shift.net, 0);
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
        if (this.freezeT > 0) {
          this.freezeT -= dt;
          if (this.freezeT <= 0) {
            $("#freezeFx").classList.remove("on");
            this.updateTools();
          }
        } else if (isFinite(this.time)) {
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
        for (const id in this.cookers) {
          const ev = tickCooker(this.cookers[id], dt, this.cookSpeed());
          if (ev) this.onCooker(id, ev);
        }
        this.updateOrders(dt);
        this.checkStarving(dt);
        const washed = tickSink(this.sink, dt, this.washTime);
        this.hygT -= dt;
        if (this.hygT <= 0) {
          this.hygT = 0.4;
          this.updateHygiene();
        }
        this.updateInspector(dt);
        this.updateLitter(dt);
        if (this.cfg.mode === "watch") this.watchTick(dt);
        else this.updateSpecial(dt);
        if (this.cfg.mode === "endless") {
          this.runT -= dt;
          if (this.runT <= 0) {
            this.runT = 3;
            this.saveRun();
          }
        }
        if (washed) {
          Sound.play("place");
          this.track("wash", washed);
        }
        this.toolsT -= dt;
        if (this.toolsT <= 0) {
          this.toolsT = 0.1;
          if (this.cfg.mode === "endless")
            drawScoreboard(Save.d.endlessBest || 0, Math.round(this.score));
          this.syncStations();
          this.updateTools();
          this.updateHand();
        }
        this.spawnT -= dt;
        const c = this.cfg;
        if (
          this.spawnT <= 0 &&
          (c.mode === "endless" || this.served + this.pending() < c.goal)
        ) {
          if (this.spawn()) {
            const g = this.diff().gap;
            this.spawnT =
              rnd(g[0], g[1]) *
              spawnFactor(this.repNow) *
              this.eff.spawn *
              (1 - 0.05 * this.tierStart) *
              (Save.d.debt > 0 ? 1.15 : 1) *
              (this.cfg.litter && this.hygiene < 50 ? 1.2 : 1) *
              (this.gapFactor || 1);
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
        this.helpers.forEach((h) => h.update(dt));
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
      const need = w ? nextNeeded(w.order).map((o) => o.f) : [];
      document
        .querySelectorAll(".food")
        .forEach((b) =>
          b.classList.toggle("hint", need.includes(b.dataset.id)),
        );
    },
    // Pointing hand for first-time players and for each newly unlocked mechanic.
    updateHand() {
      const hand = $("#hand");
      let el = null;
      if (this.teaching) {
        const lane = this.dirty.findIndex(Boolean),
          w = this.customers
            .filter((c) => c.state === "wait")
            .sort((a, b) => a.p / a.max - b.p / b.max)[0],
          need = w && nextNeeded(w.order)[0];
        const finished = Object.keys(this.cookers).find(
            (id) =>
              this.cookers[id].stage === "raw" ||
              this.cookers[id].stage === "burnt",
          ),
          order = this.orders[0];
        if (this.cfg.dishes && sinkFull(this.sink)) el = $("#btnWash");
        else if (lane >= 0 && this.chips[lane]) el = this.chips[lane];
        else if (order && packComplete(order))
          el = $(`[data-order="${order.id}"] .osend`);
        else if (need) el = $(`.food[data-id="${need.f}"]`);
        else if (order) {
          const it = order.items.find((x) => x.got < x.need);
          el = it && $(`.food[data-id="${it.f}"]`);
        } else if (finished && this.cfg.teach === "stock")
          el = $(`.food[data-id="${finished}"]`);
      }
      if (!el) {
        hand.hidden = true;
        return;
      }
      const r = el.getBoundingClientRect();
      hand.hidden = false;
      hand.style.transform = `translate(${(r.left + r.width * 0.5).toFixed(0)}px,${(r.top + r.height * 0.5).toFixed(0)}px)`;
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
      $("#hudScore").textContent = fmtNairaShort(this.dispScore);
      $("#hudCoins").textContent = fmtNairaShort(this.dispCoins);
      const now = performance.now();
      if (!force && now - (this.hudAt || 0) < 100) return;
      this.hudAt = now;
      if (c.mode === "endless") {
        $("#hudProg").style.width =
          Math.min(100, (this.served % 10) * 10) + "%";
        $("#hudProgTxt").textContent =
          `${this.served} served · ${fmtNairaShort(this.score)}`;
      } else {
        $("#hudProg").style.width =
          Math.min(100, (this.served / c.goal) * 100) + "%";
        const w = waveOf(this.served, c.goal);
        $("#hudProgTxt").textContent =
          `${this.served} / ${c.goal} served` +
          (w.count > 1 ? ` · wave ${w.index + 1}/${w.count}` : "");
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
  function countUp(el, to, dur, fmt = (v) => v.toLocaleString()) {
    const t0 = performance.now();
    const f = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
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
  let tapHit = false;
  listen(canvas, "pointerdown", (e) => {
    tapHit = false;
    // A second finger is a pinch, not a tap. Watching is hands-off.
    if (
      Game.state !== "playing" ||
      Game.cfg.mode === "watch" ||
      e.isPrimary === false
    )
      return;
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
    const objs = [
      ...stationGroup.children,
      ...Game.customers.map((c) => c.root),
      ...trays.filter((t, i) => Game.dirty[i]),
    ];
    const hits = ray.intersectObjects(objs, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) {
        tapHit = true;
        const p = o.userData.pick;
        if (p.type === "station") Game.tapFood(p.id);
        else if (p.type === "tray") Game.clearTable(p.lane);
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
    if (e.target.closest?.("textarea")) return;
    if ((e.key === "w" || e.key === "W") && Game.cfg?.dishes) Game.wash();
    const i = KEYS.indexOf(e.key);
    if (i >= 0 && Game.cfg && Game.cfg.foods[i] && Game.state === "playing") {
      Game.tapFood(Game.cfg.foods[i]);
    }
  });
  listen(
    document,
    "touchmove",
    (e) => {
      // Every modal can be dragged to scroll; the game scene cannot.
      if (!e.target.closest(".scroll, .overlay")) e.preventDefault();
    },
    { passive: false },
  );
  listen(document, "gesturestart", (e) => e.preventDefault());
  listen(document, "visibilitychange", () => {
    if (document.hidden) {
      Game.saveRun();
      if (Game.state === "playing" || Game.state === "break")
        Game.saveLevelRun();
      Game.pause();
      if (Sound.ctx) Sound.ctx.suspend();
      Save.save();
    } else {
      if (Sound.ctx) Sound.ctx.resume();
      catchUpAway();
    }
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
    zoom: 1,
    z: 1,
    // Drag to look around: a pan offset on the floor, eased like the rest.
    px: 0,
    pz: 0,
    panX: 0,
    panZ: 0,
  };
  function camMode(m) {
    cam.mode = m;
    centerCamera();
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
      $("#scrGame").style.setProperty("--hudH", hudH + "px");
      $("#scrGame").style.setProperty("--barH", btnH + "px");
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
    cam.z = lerp(cam.z, cam.zoom, k);
    cam.px = lerp(cam.px, cam.panX, Math.min(1, dt * 10));
    cam.pz = lerp(cam.pz, cam.panZ, Math.min(1, dt * 10));
    const ce = Math.cos(cam.el),
      dist = cam.dist * cam.z;
    camera.position.set(
      cam.px + Math.sin(cam.yaw) * ce * dist,
      cam.ty + Math.sin(cam.el) * dist,
      cam.tz + cam.pz + Math.cos(cam.yaw) * ce * dist,
    );
    camera.lookAt(cam.px, cam.ty, cam.tz + cam.pz);
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
  // Zoom: buttons on the rail, mouse wheel, or two-finger pinch on the scene.
  const ZOOM = [0.6, 1.5];
  const setZoom = (z) => (cam.zoom = clamp(z, ZOOM[0], ZOOM[1]));
  listen(
    canvas,
    "wheel",
    (e) => {
      e.preventDefault();
      setZoom(cam.zoom * (e.deltaY > 0 ? 1.08 : 0.93));
    },
    { passive: false },
  );
  const touches = new Map();
  let pinch0 = 0,
    zoom0 = 1;
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  // One finger dragging on empty floor moves the view; taps on food,
  // customers and tables still work as before.
  const PAN = { x: 4.5, zMin: -3.5, zMax: 2.5 };
  let drag = null;
  function centerCamera() {
    cam.panX = cam.panZ = 0;
    const b = $("#camCenter");
    if (b) b.hidden = true;
  }
  listen(canvas, "pointerdown", (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag =
      touches.size === 1 && !tapHit
        ? { x: e.clientX, y: e.clientY, px: cam.panX, pz: cam.panZ, on: false }
        : null;
    if (touches.size === 2) {
      pinch0 = spread();
      zoom0 = cam.zoom;
    }
  });
  listen(window, "pointermove", (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && pinch0) setZoom(zoom0 * (pinch0 / spread()));
    else if (drag && touches.size === 1) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (!drag.on && Math.hypot(dx, dy) < 10) return;
      drag.on = true;
      // Screen pixels to floor units at the current distance.
      const k = (cam.dist * cam.z * 1.15) / innerHeight;
      cam.panX = clamp(drag.px - dx * k, -PAN.x, PAN.x);
      cam.panZ = clamp(drag.pz - dy * k * 1.4, PAN.zMin, PAN.zMax);
      $("#camCenter").hidden = false;
    }
  });
  /* ---- rearrange: hold a dining table to pick it up and drag it ---- */
  const ground = new T3.Plane(new T3.Vector3(0, 1, 0), 0);
  let press = null,
    moving = null;
  const floorAt = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(ground, new T3.Vector3());
  };
  const othersThan = (t) =>
    diningTables.filter((o) => o !== t).map((o) => [o.x, o.z]);
  listen(canvas, "pointerdown", (e) => {
    if (Game.state !== "menu" || touches.size > 1) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(
      diningTables.map((t) => t.g),
      true,
    )[0];
    if (!hit) return;
    let o = hit.object;
    while (o && o.userData.table === undefined) o = o.parent;
    const t = o && diningTables[o.userData.table];
    if (!t) return;
    // Where the finger meets the floor, so the table keeps its offset from
    // the finger instead of jumping when it is picked up.
    const grab = floorAt(e);
    press = {
      t,
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        // Picked up: the camera stops panning and the table follows.
        drag = null;
        moving = {
          t,
          from: [t.x, t.z],
          ok: true,
          off: grab ? [t.x - grab.x, t.z - grab.z] : [0, 0],
        };
        t.g.position.y = 0.25;
        Haptics.play("tap");
        Sound.play("click");
        if (!Save.d.taught.includes("arrange")) {
          Save.d.taught.push("arrange");
          UI.toast("Drag the table, then let go to place it");
        }
      }, 450),
    };
  });
  listen(window, "pointermove", (e) => {
    if (
      press &&
      !moving &&
      Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10
    ) {
      clearTimeout(press.timer);
      press = null;
    }
    if (!moving) return;
    const p = floorAt(e);
    if (!p) return;
    const t = moving.t;
    t.g.position.x = clamp(p.x + moving.off[0], -4.4, 4.4);
    t.g.position.z = clamp(p.z + moving.off[1], -2.2, 0);
    moving.ok = canPlace(t.g.position.x, t.g.position.z, othersThan(t));
    // Lifted tables tilt slightly; a bad spot shows by tilting the other way.
    t.g.rotation.z = moving.ok ? 0.04 : -0.08;
  });
  function dropTable() {
    const { t, from } = moving;
    moving = null;
    const x = snap(t.g.position.x),
      z = snap(t.g.position.z);
    t.g.rotation.z = 0;
    t.g.position.y = 0;
    if (!canPlace(x, z, othersThan(t))) {
      t.g.position.set(from[0], 0, from[1]);
      Sound.play("wrong");
      UI.toast("Keep the counter queue, the walkway and other tables clear");
      return;
    }
    t.g.position.set(x, 0, z);
    const dx = x - t.x,
      dz = z - t.z;
    t.x = x;
    t.z = z;
    for (const seat of t.seats) {
      seat.x += dx;
      seat.z += dz;
    }
    saveLayout(
      Save.d,
      Save.d.place,
      diningTables.map((o) => [o.x, o.z]),
    );
    envKey = "";
    Save.save();
    Sound.play("place");
  }
  const lift = (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch0 = 0;
    if (!touches.size) drag = null;
    if (press) {
      clearTimeout(press.timer);
      press = null;
    }
    if (moving) dropTable();
  };
  listen(window, "pointerup", lift);
  listen(window, "pointercancel", lift);

  /* ================= MENUS: MAP / SHOP / SETTINGS / DAILY ================= */
  function buildMap() {
    bridge.map({
      chapters: CHAPTERS,
      foods: FOODS,
      save: Save.d,
      start: (n) => {
        Sound.play("click");
        startLevel(n);
      },
      locked: () => UI.toast("Finish the level before to unlock this one"),
      endless: () => Game.start(endlessCfg()),
      places: PLACES,
      openPlace: (ci) => promptOpen(PLACES[ci]),
    });
  }
  // Watching a restaurant you own: its menu and lanes, no goal or clock.
  function watchCfg(pl) {
    const n = Math.max(
      pl.firstLevel,
      Math.min(Save.d.unlocked, pl.firstLevel + 9, MAX_LEVEL),
    );
    return {
      ...levelCfg(n),
      mode: "watch",
      n: 0,
      title: pl.name,
      goal: Infinity,
      duration: Infinity,
      tutorial: false,
      teach: "",
      challenge: "",
      event: "",
      online: false,
      inspect: false,
      haggle: false,
      litter: false,
    };
  }
  // Levels in a restaurant you have not paid to open cannot be played.
  function startLevel(n) {
    if (levelOpen(Save.d, n)) Game.start(levelCfg(n));
    else promptOpen(placeOfLevel(n));
  }
  let openTarget = null;
  function promptOpen(pl) {
    openTarget = pl;
    const short = pl.cost - Save.d.coins;
    $("#openName").textContent = pl.name;
    $("#openArea").textContent =
      `${pl.area} · Levels ${pl.firstLevel}–${pl.firstLevel + 9}`;
    $("#openSub").textContent =
      short > 0
        ? `You need ${fmtNaira(short)} more to pay rent, fit out the kitchen and get permits. Replay your old restaurants, stock up smart and keep costs low.`
        : `Pay to rent, fit out and get permits. Once open it earns ${fmtNaira(pl.income)} after every shift, even when you play elsewhere.`;
    $("#openCost").textContent = fmtNaira(pl.cost);
    $("#openHave").textContent = fmtNaira(Save.d.coins);
    const art = ART["place:" + pl.id];
    $("#openArt").hidden = !art;
    if (art) $("#openArt").src = art;
    $("#openGo").classList.toggle("plain", short > 0);
    $("#openGo").classList.toggle("green", short <= 0);
    UI.open("ovOpen");
  }
  function openRestaurant(pl) {
    const c = canOpen(Save.d, pl);
    if (!c.ok) {
      Sound.play("wrong");
      UI.toast(
        c.why === "Not enough money"
          ? `You need ${fmtNaira(pl.cost - Save.d.coins)} more`
          : c.why,
      );
      return false;
    }
    openBranch(Save.d, pl);
    Save.d.place = pl.id;
    Save.save();
    Sound.play("buy");
    confetti(120);
    UI.toast(`${pl.name} is open! Welcome to ${pl.area}`);
    UI.coins();
    return true;
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
    updateTillBadge();
    updateStaffBadge();
    setTimeout(offerCard, 1200);
    UI.close("ovWin");
    UI.close("ovFail");
    UI.close("ovPause");
    menuEnv();
    setupStations(
      CHAPTERS[chapterOf(Math.min(MAX_LEVEL, Save.d.unlocked))].foods,
    );
    trays.forEach((t) => (t.visible = true));
    [-2.05, 0, 2.05].forEach((x, i) => {
      trays[i].position.x = x;
    });
    ensureDaily(Save.d, today());
    UI.coins();
    UI.show("scrMenu");
    camMode("menu");
    const el = Save.d.unlocked > 50;
    $("#endlessLock").hidden = el;
    $("#btnEndless").classList.toggle("pulse", el);
    if (Save.d.lastClaim !== today()) setTimeout(openReward, 700);
  }
  let shopTab = "up",
    crewPlace = "";
  function buildShop() {
    UI.coins();
    if (!Save.d.branches.includes(crewPlace)) crewPlace = Save.d.place;
    const placeName = (id) => PLACES.find((p) => p.id === id)?.name || id;
    bridge.shop({
      tab: shopTab,
      save: Save.d,
      upgrades: UPGRADES,
      outfits: OUTFITS,
      decor: DECOR,
      lagos: (type, item) => {
        const p = lagosProduct(type, item);
        return p
          ? { name: p.name, amount: p.amount, buy: (btn) => buyPack(p, btn) }
          : null;
      },
      crew: {
        place: crewPlace,
        places: PLACES.filter((p) => Save.d.branches.includes(p.id)),
        members: crewAt(Save.d, crewPlace),
        jobs: JOBS,
        limit: CREW_LIMIT,
        count: (role) => crewCount(Save.d, crewPlace, role),
        check: (job) => canHire(Save.d, crewPlace, job.id),
        till: tillAt(Save.d, crewPlace),
        here: crewPlace === Save.d.place,
        payday: {
          day: dayOfMonth(Save.d),
          month: monthOf(Save.d),
          days: MONTH_DAYS,
          left: daysToPayday(Save.d),
          owed: owedAt(Save.d, crewPlace),
          strikes: QUIT_STRIKES,
        },
        pay: (m) => {
          const r = payMember(Save.d, crewPlace, m.uid);
          if (!r.ok) {
            Sound.play("wrong");
            UI.toast(
              r.why === "Not enough money"
                ? `You need ${fmtNaira(m.owed - Save.d.coins)} more to pay ${m.name}`
                : r.why,
            );
            return;
          }
          Save.save();
          Sound.play("coin");
          UI.coins();
          UI.toast(`${m.name} has been paid ${fmtNaira(r.paid)}`);
          updateStaffBadge();
          buildShop();
        },
        payAll: () => {
          const r = payAll(Save.d, crewPlace);
          Save.save();
          if (!r.paid) {
            Sound.play("wrong");
            UI.toast("Not enough money to pay anyone yet");
            return;
          }
          Sound.play("coin");
          UI.coins();
          UI.toast(
            `Paid ${fmtNaira(r.paid)} in salaries` +
              (r.left ? `. Still owed: ${fmtNaira(r.left)}` : ""),
          );
          updateStaffBadge();
          buildShop();
        },
        setPlace: (id) => {
          crewPlace = id;
          Sound.play("click");
          buildShop();
        },
      },
      boosters: BOOSTERS,
      equipment: EQUIPMENT,
      equipLevel: (id) => equipLevel(Save.d, id, crewPlace),
      buyEquip: (it, card, e) => {
        const cost = it.costs[equipLevel(Save.d, it.id, crewPlace)];
        if (cost === undefined) return;
        buy(
          cost,
          () => {
            Save.d.coins += cost;
            buyEquipment(Save.d, it, crewPlace);
            envKey = "";
            showMenuEnvRefresh();
            UI.toast(`${it.name} added to ${placeName(crewPlace)}!`);
            buildShop();
          },
          card,
          e,
        );
      },
      hireStaff: (job, card, e) => {
        const c = canHire(Save.d, crewPlace, job.id);
        if (!c.ok) {
          Sound.play("wrong");
          UI.toast(c.why);
          return;
        }
        buy(
          job.cost,
          () => {
            const m = hireCrew(Save.d, crewPlace, job.id);
            Game.track("hire");
            UI.toast(`${m.name} don join ${placeName(crewPlace)}!`);
            buildShop();
          },
          card,
          e,
        );
      },
      art: ART,
      sackStaff: (m) => {
        sackCrew(Save.d, crewPlace, m.uid);
        Save.save();
        Sound.play("wrong");
        UI.toast(`${m.name} has been sacked. No more salary.`);
        buildShop();
      },
      toggleStaff: (m) => {
        toggleDuty(Save.d, crewPlace, m.uid);
        Save.save();
        Sound.play("click");
        buildShop();
      },
      buyBooster: (b, card, e) =>
        buy(
          b.cost,
          () => {
            Save.d.boosters[b.id] = (Save.d.boosters[b.id] || 0) + 1;
          },
          card,
          e,
        ),
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
    if (Game.state === "menu" || Game.state === "map") menuEnv();
  }
  // The menu shows home (grown with your chapter) or the branch you are visiting.
  function menuEnv() {
    const pl = PLACES.find((x) => x.id === Save.d.place);
    if (pl && Save.d.branches.includes(pl.id))
      buildEnv(
        pl.ci,
        pl.sign || [pl.name.toUpperCase(), "Mama Put • " + pl.area],
      );
    else {
      const ch = CHAPTERS[chapterOf(Math.min(MAX_LEVEL, Save.d.unlocked))];
      buildEnv(ch.theme ?? CHAPTERS.indexOf(ch), ch.sign);
    }
  }
  function buy(cost, fn, card, e) {
    if (Save.d.coins < cost) {
      Sound.play("wrong");
      UI.toast(
        `You need ${fmtNaira(cost - Save.d.coins)} more. Play levels to earn it!`,
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
    $("#sHaptics").classList.toggle("on", Save.d.haptics && Haptics.supported);
  }
  function openReward() {
    // The reward is queued from the menu; never pop it over a level in progress.
    if (Game.state !== "menu" && Game.state !== "map") return;
    const streak =
      Save.d.lastClaim && isYesterday(Save.d.lastClaim)
        ? Math.min(7, Save.d.streak + 1)
        : 1;
    const amt = LIVE.dailyReward.base + streak * LIVE.dailyReward.step;
    $("#rewardSub").textContent =
      `Welcome back! Day ${streak} of your streak. Come back tomorrow for more.`;
    $("#rewardAmt").textContent = fmtNaira(amt);
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
          cashBurst(r.left + r.width / 2, r.top, 10, "#menuCoins", () => {
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
      `Level ${c.n} with a twist. Serve ${c.goal} customers.${Save.d.dailyDone === today() ? " Bonus already collected today." : ` Win for a ${fmtNaira(LIVE.dailyBonus)} bonus!`}`;
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
    openShop("up");
    UI.open("ovShop");
  });
  on("#shopClose", () => {
    UI.close("ovShop");
    UI.coins();
  });
  const SHOP_TABS = {
    up: "#tabUp",
    buka: "#tabBuka",
    staff: "#tabStaff",
    boost: "#tabBoost",
    style: "#tabStyle",
  };
  function openShop(tab) {
    shopTab = tab;
    for (const k in SHOP_TABS)
      $(SHOP_TABS[k]).classList.toggle("on", k === tab);
    buildShop();
    $("#shopList").scrollTop = 0;
  }
  for (const k in SHOP_TABS) on(SHOP_TABS[k], () => openShop(k));
  // Growth: business size and branches in other places.
  function buildGrow() {
    UI.coins();
    bridge.grow({
      save: Save.d,
      tier: tierOf(Save.d),
      tiers: TIERS,
      next: nextTier(Save.d),
      earned: Save.d.stats.earn,
      places: PLACES,
      art: ART,
      check: (pl) => canOpen(Save.d, pl),
      manager: (pl) => managerAt(Save.d, pl.id),
      till: (pl) => tillAt(Save.d, pl.id),
      tillTotal: tillTotal(Save.d),
      contracts: Save.d.unlocked >= UNLOCKS.online ? currentContracts() : null,
      contract: Save.d.contract || null,
      takeContract: (k) => {
        Save.d.contract = k;
        Save.save();
        Sound.play("buy");
        UI.toast(`${k.name} accepted. It comes in your next level from 15 on.`);
        buildGrow();
      },
      openNow: isOpenAt(Date.now()),
      hours: `${OPEN_HOUR}am–${CLOSE_HOUR - 12}pm`,
      collect: (pl) => {
        const v = pl ? collectTill(Save.d, pl.id) : collectAll();
        if (!v) return;
        Save.save();
        Sound.play("coin");
        UI.coins();
        UI.toast(`Collected ${fmtNaira(v)} from your managers`);
        buildGrow();
        updateTillBadge();
      },
      staffAt: (pl) => {
        crewPlace = pl.id;
        shopTab = "staff";
        UI.close("ovGrow");
        openShop("staff");
        UI.open("ovShop");
      },
      open: (pl, card) => {
        if (!openRestaurant(pl)) return;
        card?.classList.add("bought");
        showMenuEnvRefresh();
        buildGrow();
      },
      // Jump to that restaurant's chapter on the map.
      playAt: (pl) => {
        UI.close("ovGrow");
        openMap();
        requestAnimationFrame(() => {
          const cards = host.querySelectorAll("#mapInner .chap");
          cards[pl.chapter]?.scrollIntoView({ block: "start" });
        });
      },
      visit: (pl) => {
        Save.d.place = pl.id;
        Save.save();
        Sound.play("click");
        UI.close("ovGrow");
        Game.start(watchCfg(pl));
      },
    });
  }
  // The Staff button shows when salaries are waiting to be paid.
  function updateStaffBadge() {
    const b = $("#staffBadge");
    if (!b) return;
    const owed = owedTotal(Save.d);
    b.hidden = !owed;
    b.textContent = owed ? fmtNairaShort(owed) : "";
    b.classList.toggle("due", owed > 0 && daysToPayday(Save.d) <= 2);
  }
  // Restaurants with a manager keep earning during opening hours while you
  // are away; this catches them up when you come back.
  function catchUpAway() {
    const r = earnWhileAway(
      Save.d,
      Date.now(),
      clamp((Save.d.reputation || 50) / 60, 0.4, 1.2),
      UNPAID_LIMIT,
    );
    Save.save();
    updateTillBadge();
    if (r.made > 0)
      UI.toast(
        `While you were away your managers made ${fmtNaira(r.made)} in ${r.hours} opening hour${r.hours === 1 ? "" : "s"}. Collect it in Grow!`,
      );
    if (r.quit.length) UI.toast(`${r.quit.join(", ")} quit: not paid`);
  }
  // Mama Nkechi's debrief under the shift report.
  function showInsights(id, list = []) {
    const box = $("#" + id);
    if (!box) return;
    box.hidden = !list.length;
    const head = document.createElement("div");
    head.className = "mentorHead";
    head.textContent = `${MENTOR} says`;
    box.replaceChildren(
      head,
      ...list.map((i) => {
        const row = document.createElement("div");
        row.className = "insight " + i.tone;
        const t = document.createElement("b");
        t.textContent = i.title;
        const tip = document.createElement("span");
        tip.textContent = i.tip;
        row.append(t, tip);
        return row;
      }),
    );
  }
  function openBooks() {
    bridge.books({
      journal: (Save.d.journal || []).slice().reverse(),
      history: Save.d.history || [],
      summary: bookSummary(Save.d.history || [], 7),
      targets: TARGETS,
      fmt: fmtNaira,
      placeName: (id) => PLACES.find((p) => p.id === id)?.name || id,
    });
    UI.open("ovBooks");
  }
  on("#growBooks", () => {
    Sound.play("click");
    openBooks();
  });
  on("#booksClose", () => UI.close("ovBooks"));
  // Three catering offers a day to choose from.
  function currentContracts() {
    const day = Save.d.day || 0;
    if (Save.d.contractOffers?.day !== day) {
      const pl = PLACES.find((x) => x.id === Save.d.place) || PLACES[0];
      Save.d.contractOffers = {
        day,
        list: contractOffers(Save.d, CHAPTERS[pl.chapter].foods),
      };
    }
    return Save.d.contractOffers.list;
  }
  // Crew priority buttons (wave break) and the rail button.
  function renderPriority(sel) {
    const box = $(sel);
    if (!box) return;
    box
      .querySelectorAll("[data-pri]")
      .forEach((b) =>
        b.classList.toggle("on", b.dataset.pri === Game.priority),
      );
  }
  function updatePriorityBtn() {
    const b = $("#btnPriority");
    if (!b) return;
    b.hidden = !Game.helpers.length || Game.cfg?.mode === "watch";
    b.querySelector("b").textContent =
      { counter: "🍛", delivery: "📦", restock: "🔥" }[Game.priority] || "🍛";
  }
  // What the decision rules need to know about where you are.
  function decisionCtx() {
    const pl = PLACES.find((x) => x.id === Save.d.place) || PLACES[0];
    return {
      place: pl.id,
      fmt: fmtNaira,
      foods: CHAPTERS[pl.chapter].foods,
      bulkCost: roundNaira(marketPrice(Save.d, "rice") * 8 * 0.85, 50),
      ricePrice: marketPrice(Save.d, "rice"),
      online: Save.d.unlocked >= UNLOCKS.online,
      level: Save.d.unlocked,
    };
  }
  function offerCard() {
    if (Game.state !== "menu" || document.querySelector(".overlay.show"))
      return;
    const card = drawOpportunity(Save.d, decisionCtx());
    if (!card) return;
    Save.save();
    const c = decisionCtx();
    $("#offerTitle").textContent = card.title;
    $("#offerText").textContent = card.text(c);
    $("#offerExpect").textContent = `Expected: ${card.expect}`;
    const choices = card.choices || [
      {
        id: "accept",
        label:
          card.cost(c) > 0 ? `Accept (${fmtNaira(card.cost(c))})` : "Accept",
      },
      { id: "decline", label: "No thanks" },
    ];
    ["offerA", "offerB"].forEach((id, i) => {
      const b = $("#" + id);
      b.dataset.choice = choices[i].id;
      b.querySelector(".buttonLabel").textContent = choices[i].label;
    });
    UI.open("ovOffer");
  }
  function answerOffer(e) {
    const choice = e.currentTarget.dataset.choice;
    const card = cardById(Save.d.offer?.id);
    if (!card) return UI.close("ovOffer");
    const c = decisionCtx();
    if (choice !== "decline" && card.cost(c) > Save.d.coins) {
      Sound.play("wrong");
      UI.toast(`You need ${fmtNaira(card.cost(c) - Save.d.coins)} more`);
      return;
    }
    const h = Save.d.history || [],
      day = Save.d.day || 0;
    decide(Save.d, c, choice, {
      net: averageAt(h, c.place, "net", day - 3, day),
      served: averageAt(h, c.place, "served", day - 3, day),
    });
    Save.save();
    UI.coins();
    UI.close("ovOffer");
    Sound.play(choice === "decline" ? "click" : "buy");
    if (choice !== "decline")
      UI.toast(
        "Decision recorded. Check Business books to see how it turns out.",
      );
  }
  on("#offerA", answerOffer);
  on("#offerB", answerOffer);
  on("#disrupt0", () => Game.resolveDisruption(0));
  on("#disrupt1", () => Game.resolveDisruption(1));
  function collectAll() {
    return PLACES.reduce((t, p) => t + collectTill(Save.d, p.id), 0);
  }
  // The Grow button shows when managers have money waiting.
  function updateTillBadge() {
    const b = $("#growBadge");
    if (!b) return;
    const v = tillTotal(Save.d);
    b.hidden = !v;
    b.textContent = v ? fmtNairaShort(v) : "";
  }
  // Market: stock the store before prices rise
  function buildMarket() {
    UI.coins();
    const cap = effects(Save.d).pantryCap;
    const pl = PLACES.find((x) => x.id === Save.d.place) || PLACES[0];
    const needed = new Set(
      CHAPTERS[pl.chapter].foods.map((f) => FOOD_GROUP[f]).filter(Boolean),
    );
    bridge.market({
      place: pl.name,
      priceLevel: Save.d.prices?.[pl.id] || "normal",
      priceLevels: PRICE_LEVELS,
      sensitive: (PRICE_SENSITIVITY[pl.id] ?? 1) >= 1.2,
      relaxed: (PRICE_SENSITIVITY[pl.id] ?? 1) <= 0.7,
      setPrice: (lv) => {
        Save.d.prices = { ...(Save.d.prices || {}), [pl.id]: lv };
        Save.save();
        Sound.play("click");
        buildMarket();
      },
      foodTarget: TARGETS.foodCost,
      menu: plateCosts(
        CHAPTERS[pl.chapter].foods.filter((f) => FOOD_GROUP[f]),
        (f) => FOODS[f].price,
        (f) => plateCost(Save.d, f) * foodBatch(f),
        foodBatch,
      ).map((m) => ({ ...m, name: FOODS[m.id].name })),
      items: Object.entries(INGREDIENTS)
        .filter(([id]) => needed.has(id))
        .map(([id, g]) => ({
          id,
          ...g,
          have: Save.d.pantry[id] || 0,
          price: marketPrice(Save.d, id),
          out: isOut(Save.d, id),
          uses: Object.keys(FOOD_GROUP)
            .filter((f) => FOOD_GROUP[f] === id)
            .map((f) => FOODS[f].short)
            .join(", "),
        })),
      news: Save.d.market.news,
      index: Save.d.market.index,
      cap,
      fridge: effects(Save.d).fridgeCap,
      buy: (id, n, e) => {
        const discount =
          crewCount(Save.d, Save.d.place, "errand") > 0 ? 0.8 : 1;
        const r = marketBuy(Save.d, id, n, cap, discount);
        if (!r.ok) {
          Sound.play("wrong");
          UI.toast(r.why);
          return;
        }
        Save.save();
        Sound.play("buy");
        const b = e.currentTarget.getBoundingClientRect();
        floatText(b.left + b.width / 2, b.top, "-" + fmtNaira(r.cost), "small");
        buildMarket();
      },
    });
    $("#marketCoins").textContent = fmtNaira(Save.d.coins);
  }
  on("#btnMarket", () => {
    Sound.play("click");
    buildMarket();
    UI.open("ovMarket");
  });
  on("#marketClose", () => {
    UI.close("ovMarket");
    UI.coins();
  });
  // Leaderboard against rival bukas
  const BOARD_TABS = {
    sales: "#tabBoardSales",
    stars: "#tabBoardStars",
    endless: "#tabBoardEndless",
  };
  // Real players from the Kikter backend; your row is added if you are
  // outside the top 50.
  let boardSeq = 0,
    boardTab = "sales";
  async function openBoard(id) {
    boardTab = id;
    const scope = $("#boardScope").checked ? "lagoslife" : "all";
    $("#boardScopeRow").hidden = !Online.enabled;
    for (const k in BOARD_TABS)
      $(BOARD_TABS[k]).classList.toggle("on", k === id);
    const unit = id === "stars" ? "stars" : "naira",
      seq = ++boardSeq;
    bridge.board({
      rows: [],
      unit,
      fmt: fmtNaira,
      note: "Loading the leaderboard…",
    });
    if (!LIVE.features.leaderboard || !Online.enabled) {
      bridge.board({
        rows: [],
        unit,
        fmt: fmtNaira,
        note: "The online leaderboard is not available right now.",
      });
      return;
    }
    const render = (data) => {
      if (seq !== boardSeq) return;
      if (!data) {
        bridge.board({
          rows: [],
          unit,
          fmt: fmtNaira,
          note: "You are offline. Connect to see real players.",
        });
        return;
      }
      const rows = data.rows.map((r) => ({
        rank: r.rank,
        name: r.name,
        where:
          `${r.tier} · ${r.restaurants} restaurant${r.restaurants === 1 ? "" : "s"}` +
          (r.source === "lagoslife" || r.source === "both"
            ? " · Lagos Life"
            : ""),
        value: r.value,
        you: r.you,
      }));
      if (data.me && !rows.some((r) => r.you))
        rows.push({
          rank: data.me.rank,
          name: data.me.name,
          where: "You",
          value: data.me.value,
          you: true,
        });
      bridge.board({
        rows,
        unit,
        fmt: fmtNaira,
        note:
          `${data.players.toLocaleString()} real ${scope === "lagoslife" ? "Lagos Life " : ""}players. Play more shifts to climb.` +
          (Online.account?.signedIn
            ? ""
            : " Sign in to keep your place on every phone."),
      });
      requestAnimationFrame(() =>
        $("#boardList .boardRow.you")?.scrollIntoView({ block: "center" }),
      );
    };
    // Show the board straight away, then again once your latest save is in.
    render(await Online.leaderboard(id, scope));
    if (await syncNow()) render(await Online.leaderboard(id, scope));
  }
  on("#btnBoard", () => {
    Sound.play("click");
    openBoard("sales");
    UI.open("ovBoard");
  });
  for (const k in BOARD_TABS) on(BOARD_TABS[k], () => openBoard(k));
  on("#boardClose", () => UI.close("ovBoard"));
  listen(host, "change", (e) => {
    if (e.target.id === "boardScope") openBoard(boardTab);
  });
  on("#btnGrow", () => {
    Sound.play("click");
    buildGrow();
    UI.open("ovGrow");
  });
  on("#growClose", () => UI.close("ovGrow"));
  on("#zoomIn", () => setZoom(cam.zoom * 0.85));
  on("#zoomOut", () => setZoom(cam.zoom * 1.18));
  on("#camCenter", () => {
    centerCamera();
    setZoom(1);
  });
  on("#btnStaff", () => {
    Sound.play("click");
    openShop("staff");
    UI.open("ovShop");
  });
  // Missions and achievements
  let missionTab = "daily";
  function buildMissions() {
    UI.coins();
    bridge.missions({
      tab: missionTab,
      daily: ensureDaily(Save.d, today()),
      achievements: ACHIEVEMENTS,
      save: Save.d,
      progressOf: (a) => achievementProgress(Save.d, a),
      claim: (id, e) => {
        const amt = claimMission(Save.d, id);
        if (!amt) return;
        Save.save();
        Sound.play("buy");
        const r = e.currentTarget.getBoundingClientRect();
        cashBurst(r.left + r.width / 2, r.top, 8, "#missionCoins", () => {
          Sound.play("coin");
          UI.coins();
        });
        UI.toast("+" + fmtNaira(amt));
        buildMissions();
      },
    });
  }
  const openMissionTab = (t) => {
    missionTab = t;
    $("#tabDailyM").classList.toggle("on", t === "daily");
    $("#tabAch").classList.toggle("on", t === "ach");
    buildMissions();
  };
  on("#btnMissions", () => {
    Sound.play("click");
    openMissionTab("daily");
    UI.open("ovMissions");
  });
  on("#tabDailyM", () => openMissionTab("daily"));
  on("#tabAch", () => openMissionTab("ach"));
  on("#missionsClose", () => {
    UI.close("ovMissions");
    UI.coins();
  });
  // In-game tools
  on("#bFreeze", () => Game.fireBooster("freeze"));
  on("#bAuto", () => Game.fireBooster("auto"));
  on("#bCalm", () => Game.fireBooster("calm"));
  on("#btnWash", () => Game.wash());
  on("#btnSettings", () => {
    syncToggles();
    showOnlineStatus();
    $("#sReset .buttonLabel").textContent = "Reset progress";
    UI.open("ovSettings");
  });
  on("#sClose", () => UI.close("ovSettings"));
  on("#sAccount", () => {
    UI.close("ovSettings");
    openAccount();
  });
  on("#btnDaily", () => {
    Sound.play("click");
    openDaily();
  });
  on("#dailyClose", () => UI.close("ovDaily"));
  on("#btnEndless", () => {
    if (Save.d.unlocked > 50)
      Game.start({ ...endlessCfg(), resume: Save.d.endlessRun || null });
    else {
      Sound.play("wrong");
      UI.toast("Beat Level 50 to unlock Endless Rush!");
    }
  });
  on("#btnPause", () => Game.pause());
  on("#inspPay", () => Game.payInspector());
  on("#waveGo", () => Game.endBreak());
  on("#waveMarket", () => {
    buildMarket();
    UI.open("ovMarket");
  });
  for (const k of ["counter", "delivery", "restock"])
    on("#pri-" + k, () => Game.setPriority(k));
  on("#btnPriority", () => {
    const keys = ["counter", "delivery", "restock"];
    Game.setPriority(keys[(keys.indexOf(Game.priority) + 1) % keys.length]);
  });
  on("#btnSpecial", () => Game.openSpecial());
  on("#specialPlate", () => Game.plateSpecial());
  for (let i = 0; i < 3; i++)
    on("#inspOffer" + i, () => Game.bribeInspector(i));
  on("#inspBeg", () => Game.begInspector());
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
    if (Game.cfg.mode === "level") delete Save.d.levelRun;
    if (Game.cfg.mode === "endless") Game.saveRun(false);
    Save.save();
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
  on("#sHaptics", () => {
    if (!Haptics.supported) {
      UI.toast("This device cannot vibrate");
      return;
    }
    Save.d.haptics = !Save.d.haptics;
    Save.save();
    syncToggles();
    Haptics.play("serve");
  });
  // Backup code and optional cloud sync
  const afterRestore = (msg) => {
    Save.save();
    buildChef();
    envKey = "";
    UI.close("ovBackup");
    UI.close("ovSettings");
    showMenu();
    UI.toast(msg);
  };
  on("#sBackup", () => {
    $("#backupCode").value = encodeBackup(Save.d);
    $("#cloudSync").hidden = !Online.enabled;
    $("#backupSub").textContent =
      "Copy this code to move your progress to another phone. Paste a code here and tap Restore." +
      (Online.enabled
        ? " Your save also syncs automatically with your Kikter cloud account."
        : "");
    UI.open("ovBackup");
  });
  on("#backupClose", () => UI.close("ovBackup"));
  on("#backupCopy", () => {
    const box = $("#backupCode");
    box.value = encodeBackup(Save.d);
    box.select();
    const done = () => UI.toast("Backup code copied");
    if (navigator.clipboard?.writeText)
      navigator.clipboard
        .writeText(box.value)
        .then(done, () => UI.toast("Select the code and copy it"));
    else UI.toast("Select the code and copy it");
  });
  on("#backupRestore", () => {
    let incoming;
    try {
      incoming = decodeBackup($("#backupCode").value);
    } catch (err) {
      Sound.play("wrong");
      UI.toast(err.message);
      return;
    }
    // Merge so restoring an older code never wipes newer progress.
    Save.d = migrate(mergeSaves(Save.d, incoming), Save.defaults());
    afterRestore("Progress restored!");
  });
  on("#cloudSync", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    const ok = await syncNow();
    b.disabled = false;
    UI.toast(
      ok ? "Cloud save synced" : "Could not reach the server. Try again.",
    );
  });
  // Buka name shown on the leaderboard
  on("#savePlayerName", async () => {
    const name = $("#playerName").value.trim();
    if (name.length < 2) {
      UI.toast("Use at least 2 letters");
      return;
    }
    const r = await Online.rename(name);
    UI.toast(
      r
        ? `Your buka is now "${r.name}"`
        : "Could not reach the server. Try again.",
    );
    showOnlineStatus();
  });
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
    if (n > MAX_LEVEL) {
      Game.clear();
      showMenu();
      UI.toast("Endless Rush unlocked!");
    } else if (levelOpen(Save.d, n)) Game.start(levelCfg(n));
    else {
      Game.clear();
      openMap();
      promptOpen(placeOfLevel(n));
    }
  });
  on("#openLater", () => UI.close("ovOpen"));
  on("#openGo", () => {
    const pl = openTarget;
    if (!pl || !openRestaurant(pl)) return;
    UI.close("ovOpen");
    if (Game.state === "map") buildMap();
    setTimeout(() => startLevel(pl.firstLevel), 600);
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
        if (strollT <= 0 && Game.strollers.length < 5 + 2 * tierOf(Save.d)) {
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
          let speed = d.speed;
          for (const o of dyn) {
            if (o === d || o.type !== "drive" || o.z !== d.z) continue;
            const gap = ((o.x - d.x) * (d.dir || 1) + 32) % 32;
            if (gap < (o.len + d.len) / 2 + 0.6)
              speed = Math.min(speed, o.speed * 0.9);
          }
          d.x += (d.dir || 1) * speed * dt;
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
        else if (d.type === "spin") d.o.rotation.z = T * 9 + d.ph;
        else if (d.type === "cloud") {
          d.x += d.speed * dt;
          if (d.x > 40) d.x = -40;
          d.o.position.x = d.x;
        }
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
    for (const t of Game.tables) {
      if (!t.chip) continue;
      const p = _v.set(t.x, 1.25, t.z).project(camera);
      t.chip.style.transform = `translate3d(${(((p.x + 1) / 2) * innerWidth).toFixed(1)}px,${(((1 - p.y) / 2) * innerHeight).toFixed(1)}px,0) translate(-50%,-50%)`;
    }
    for (const h of Game.helpers) {
      if (!h.tag) continue;
      const busy = (!!h.job || h.work > 0) && !!h.task && h.root.visible;
      h.tag.hidden = !busy;
      if (!busy) continue;
      h.tag.textContent = TASK_ICONS[h.task] || "";
      const p = _v
        .set(h.root.position.x, 2.05, h.root.position.z)
        .project(camera);
      h.tag.style.transform = `translate3d(${(((p.x + 1) / 2) * innerWidth).toFixed(1)}px,${(((1 - p.y) / 2) * innerHeight).toFixed(1)}px,0) translate(-50%,-100%)`;
    }
    for (const l of Game.litter) {
      if (!l.chip) continue;
      const p = _v.set(l.x, 0.45, l.z).project(camera);
      l.chip.style.transform = `translate3d(${(((p.x + 1) / 2) * innerWidth).toFixed(1)}px,${(((1 - p.y) / 2) * innerHeight).toFixed(1)}px,0) translate(-50%,-50%)`;
    }
    for (let i = 0; i < 3; i++) {
      const chip = Game.chips[i];
      if (!chip || !trays[i]) continue;
      const p = trays[i].getWorldPosition(_v).setY(1.45).project(camera);
      chip.style.transform = `translate3d(${(((p.x + 1) / 2) * innerWidth).toFixed(1)}px,${(((1 - p.y) / 2) * innerHeight).toFixed(1)}px,0) translate(-50%,-50%)`;
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
    const away = absenceDecay(Save.d.lastPlayed, today());
    if (away.rep && Save.d.decayDay !== today()) {
      Save.d.decayDay = today();
      Save.d.reputation = clampRep(Save.d.reputation + away.rep);
      Save.save();
      setTimeout(
        () =>
          UI.toast(
            `Your buka was closed for ${away.days} days. Customers went elsewhere (★ ${Math.round(away.rep)})`,
          ),
        1500,
      );
    }
    initGeo();
    makeThumbs();
    buildChef();
    fitCamera();
    showMenu();
    // Managers' earnings for the opening hours you were away.
    catchUpAway();
    goOnline();
    const lr = Save.d.levelRun;
    if (lr && lr.n && levelOpen(Save.d, lr.n))
      setTimeout(
        () =>
          Game.state === "menu" &&
          Game.start({ ...levelCfg(lr.n), resume: lr }),
        600,
      );
    else if (Save.d.endlessRun?.active && Save.d.unlocked > 50)
      setTimeout(
        () =>
          Game.state === "menu" &&
          Game.start({ ...endlessCfg(), resume: Save.d.endlessRun }),
        600,
      );
    requestAnimationFrame((t) => {
      last = t;
      requestAnimationFrame(loop);
    });
    setTimeout(() => $("#boot").classList.add("gone"), 200);
    // expose a tiny debug hook for testing
    if (import.meta.env.DEV)
      window.__mp = {
        Game,
        Save,
        levelCfg,
        FOODS,
        stations,
        trays,
        camera,
        scene,
        dyn,
        diningTables,
        cam,
        Online,
        syncNow,
      };
  }
  /* ================= ACCOUNT (Kikter account / Lagos Life) ================= */
  const needsSignIn = () =>
    Online.enabled && !LIVE.accounts.guests && !Online.account?.signedIn;
  function showAccountDot() {
    const dot = $("#accountDot");
    if (dot)
      dot.hidden =
        !Online.enabled ||
        (!!Online.account?.signedIn && !Online.status.expired);
  }
  let accMode = "login";
  function setAccMode(mode) {
    accMode = mode;
    $("#tabLogin").classList.toggle("on", mode === "login");
    $("#tabRegister").classList.toggle("on", mode === "register");
    $("#accName").hidden = mode !== "register";
    $("#accPassword").autocomplete =
      mode === "register" ? "new-password" : "current-password";
    $("#accPassword").placeholder =
      mode === "register" ? "Password (8+ characters)" : "Password";
    $("#accSubmit .buttonLabel").textContent =
      mode === "register" ? "Create account" : "Log in";
    accError("");
  }
  function accError(msg) {
    const el = $("#accError");
    el.hidden = !msg;
    el.textContent = msg || "";
  }
  function renderAccount() {
    const acc = Online.account,
      signed = !!acc?.signedIn && !Online.status.expired;
    $("#accGuest").hidden = signed;
    $("#accSigned").hidden = !signed;
    const lagosReady = Lagos.state.active && LIVE.accounts.lagoslife;
    $("#accLagos").hidden = !lagosReady || signed;
    $("#accIntro").textContent = !Online.enabled
      ? "Online play is off in this version of the game."
      : Online.status.expired
        ? "Your sign-in ended. Sign in again to keep your buka in sync."
        : LIVE.accounts.guests
          ? "Sign in to keep your buka on every phone, earn coins and use the same account in Lagos Life and Lagos War."
          : "Sign in or create a free account to play.";
    if (!signed) return;
    const via = [
      acc.email,
      acc.lagoslife ? `Lagos Life: ${acc.lagoslife}` : null,
    ].filter(Boolean);
    $("#accWho").textContent =
      `${Online.player?.name || "Your buka"} · ${via.join(" · ")}`;
    $("#accCoins").textContent = (acc.wallet || 0).toLocaleString();
    const w = LIVE.wallet;
    $("#accWalletNote").textContent =
      `Shared with Lagos War${acc.lagoslife ? " and Lagos Life" : ""}. Win shifts to earn ${w.perWin} coins (up to ${w.dailyCap} a day). 1 coin = ${fmtNaira(w.rate)} in your buka, swap at least ${w.min}.`;
    $("#accSwap").min = String(w.min);
    if (!$("#accSwap").value) $("#accSwap").value = String(w.min);
    // Coins and naira bought with Lagos Life checkout. Shop items (boosters,
    // outfits, equipment...) have their own Lagos Life buttons in the shop.
    const packs = $("#accPacks");
    const money = canBuyWithLagos()
      ? LIVE.lagoslifeProducts.filter((p) => moneyType(p) !== "")
      : [];
    packs.hidden = !money.length;
    packs.replaceChildren(
      ...money.map((p) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn gold";
        const name = document.createElement("b");
        name.textContent = p.name;
        const what = document.createElement("small");
        what.textContent =
          moneyType(p) === "cash"
            ? fmtNaira(p.amount) + " for your buka"
            : `${(p.amount || p.coins).toLocaleString()} coins`;
        b.append(name, what);
        b.onclick = () => buyPack(p, b);
        return b;
      }),
    );
  }
  async function openAccount() {
    setAccMode(accMode);
    renderAccount();
    UI.open("ovAccount");
    if (Online.account?.signedIn) {
      await Online.wallet();
      renderAccount();
    }
  }
  // After any sign-in: merge this phone's progress with the account's save.
  async function afterSignIn(welcome) {
    warnedExpired = false;
    await syncNow();
    await Online.wallet();
    showOnlineStatus();
    renderAccount();
    if (Game.state === "menu") showMenu();
    UI.toast(welcome);
  }
  async function submitAccount() {
    const email = $("#accEmail").value.trim(),
      password = $("#accPassword").value,
      name = $("#accName").value.trim();
    if (accMode === "register" && name.length < 2)
      return accError("Enter your name (at least 2 letters).");
    if (!/^\S+@\S+\.\S+$/.test(email)) return accError("Enter a valid email.");
    if (password.length < (accMode === "register" ? 8 : 1))
      return accError(
        accMode === "register"
          ? "Use a password of at least 8 characters."
          : "Enter your password.",
      );
    const btn = $("#accSubmit");
    btn.disabled = true;
    accError("");
    const r =
      accMode === "register"
        ? await Online.register(name, email, password)
        : await Online.login(email, password);
    btn.disabled = false;
    if (!r.ok) {
      Sound.play("wrong");
      return accError(r.error);
    }
    $("#accPassword").value = "";
    Sound.play("coin");
    await afterSignIn(
      accMode === "register"
        ? "Account created. Welcome!"
        : `Welcome back, ${r.player.account?.name || r.player.name}!`,
    );
    // Inside Lagos Life, link the Lagos Life player to this account too.
    if (Lagos.state.active && LIVE.accounts.lagoslife) await signInLagos(true);
  }
  async function signInLagos(quiet) {
    if (!Lagos.state.active) return false;
    let r;
    try {
      r = await Online.lagosLife(await Lagos.session());
    } catch (e) {
      r = { ok: false, error: e.message };
    }
    if (!r.ok) {
      if (!quiet) accError(r.error);
      return false;
    }
    await afterSignIn(
      `Signed in with Lagos Life as ${r.player.lagoslife?.name || r.player.name}`,
    );
    await claimPurchases();
    collectGrants();
    return true;
  }
  // Lagos Life sells Mama Put's own shop items. Older coin packs only had
  // `coins`, so they count as coins.
  const moneyType = (p) =>
    p.type === "cash" ? "cash" : p.type === "coins" || !p.type ? "coins" : "";
  const canBuyWithLagos = () =>
    Lagos.state.active &&
    !!Online.account?.lagoslife &&
    !Online.status.expired &&
    LIVE.lagoslifeProducts.length > 0;
  const lagosProduct = (type, item) =>
    canBuyWithLagos()
      ? LIVE.lagoslifeProducts.find((p) => p.type === type && p.item === item)
      : null;
  // Adds items bought on Lagos Life to the save, once each, then tells the
  // server they arrived. Also picks up purchases delivered by webhook.
  let collecting = null;
  function collectGrants(list) {
    if (collecting) return collecting;
    collecting = (async () => {
      const grants = list || (await Online.grants());
      if (!grants.length) return;
      const { handled, applied } = applyGrants(Save.d, grants);
      Save.save();
      await Online.ackGrants(handled);
      if (!applied.length) return;
      Sound.play("buy");
      UI.toast(
        "Lagos Life purchase added: " +
          applied.map((g) => grantLabel(g, fmtNaira)).join(", "),
      );
      UI.coins();
      envKey = "";
      showMenuEnvRefresh();
      if (Game.state === "menu" || Game.state === "map") buildChef();
      if ($("#ovShop").classList.contains("show")) buildShop();
      syncNow();
    })().finally(() => (collecting = null));
    return collecting;
  }
  // Delivers a Lagos Life purchase: the server verifies it with Lagos Life,
  // adds coins to the wallet and returns any shop items to add here.
  async function claimPurchase(purchaseId) {
    const r = await Online.claimPurchase(await Lagos.session(), purchaseId);
    if (r?.error) UI.toast(r.error);
    else if (r?.granted && !r.grants?.length) {
      Sound.play("coin");
      UI.toast("Coins added to your wallet!");
    }
    if (r?.grants) await collectGrants(r.grants);
    renderAccount();
  }
  async function claimPurchases() {
    for (const p of await Lagos.purchases())
      await claimPurchase(p.purchaseId).catch(() => {});
  }
  async function buyPack(p, b) {
    b.disabled = true;
    try {
      const purchase = await Lagos.purchase(p.productId);
      if (purchase?.purchaseId) await claimPurchase(purchase.purchaseId);
    } catch (e) {
      UI.toast(e.message || "Purchase cancelled");
    }
    b.disabled = false;
  }
  async function connectLagos() {
    if (!Online.enabled || !LIVE.accounts.lagoslife || !lagosLifeHinted())
      return;
    const r = await Lagos.connect({
      onPause: () => Game.pause(),
      onPurchase: (p) => claimPurchase(p.purchaseId).catch(() => {}),
    });
    if (!r || lifetime.disposed) return;
    const acc = Online.account;
    if (acc?.lagoslife && !Online.status.expired) {
      await claimPurchases();
      collectGrants();
    } else await signInLagos(true);
  }
  setAccMode("login");
  on("#btnAccount", () => {
    Sound.play("click");
    openAccount();
  });
  on("#tabLogin", () => setAccMode("login"));
  on("#tabRegister", () => setAccMode("register"));
  listen(host, "submit", (e) => {
    if (e.target.id !== "accForm") return;
    e.preventDefault();
    Sound.init();
    submitAccount();
  });
  on("#accLagos", () => signInLagos(false));
  on("#accClose", () => UI.close("ovAccount"));
  on("#accSwapBtn", async (e) => {
    const b = e.currentTarget,
      n = Math.floor(Number($("#accSwap").value));
    if (!(n >= LIVE.wallet.min)) {
      UI.toast(`Swap at least ${LIVE.wallet.min} coins`);
      return;
    }
    b.disabled = true;
    const r = await Online.exchange(n);
    b.disabled = false;
    if (!r.ok) {
      Sound.play("wrong");
      UI.toast(r.error);
      return;
    }
    Save.d.coins += r.cash;
    Save.save();
    UI.coins();
    Sound.play("coin");
    UI.toast(`${n} coins swapped for ${fmtNaira(r.cash)}`);
    renderAccount();
    syncNow();
  });
  on("#accLogout", async (e) => {
    const b = e.currentTarget;
    if (!b.dataset.arm) {
      b.dataset.arm = 1;
      b.querySelector(".buttonLabel").textContent =
        "Tap again: this phone starts a fresh buka";
      setTimeout(() => {
        delete b.dataset.arm;
        b.querySelector(".buttonLabel").textContent = "Log out";
      }, 3000);
      return;
    }
    delete b.dataset.arm;
    b.querySelector(".buttonLabel").textContent = "Log out";
    await syncNow();
    await Online.logout();
    // The account keeps its progress; this phone goes back to a new guest.
    Save.d = Save.defaults();
    Save.d.coins = LIVE.startCash;
    Save.save();
    buildChef();
    envKey = "";
    UI.close("ovAccount");
    showMenu();
    showOnlineStatus();
    UI.toast("Logged out. Your buka is safe in your account.");
    if (LIVE.accounts.guests) syncNow();
    else openAccount();
  });
  /* ================= ONLINE (Kikter backend) ================= */
  function showOnlineStatus() {
    const el = $("#onlineStatus");
    if (!el) return;
    const p = Online.player,
      acc = Online.account;
    el.textContent = !Online.enabled
      ? "Offline mode"
      : Online.status.banned
        ? "This player has been suspended"
        : Online.status.expired
          ? "Signed out. Open Account to sign in again."
          : p
            ? `Online as ${p.name}` +
              (acc?.signedIn
                ? ` · ${acc.email || "Lagos Life"}`
                : " · guest on this phone")
            : Online.status.online
              ? "Online"
              : "Connecting…";
    showAccountDot();
    if (p && document.activeElement !== $("#playerName"))
      $("#playerName").value = p.name;
  }
  function showAnnouncement() {
    const a = $("#announce");
    const text = LIVE.maintenance
      ? "Mama Put Rush is under maintenance. Please check back soon."
      : LIVE.announcement;
    a.hidden = !text;
    a.textContent = text || "";
  }
  let syncing = null,
    warnedExpired = false;
  // Pull, merge and push the save; admin edits on the server come in here.
  function syncNow() {
    if (!Online.enabled) return Promise.resolve(false);
    if (syncing) return syncing;
    syncing = Online.sync(Save.d)
      .then((merged) => {
        if (!merged) return false;
        const before = JSON.stringify([
          Save.d.coins,
          Save.d.unlocked,
          Save.d.reputation,
        ]);
        Save.d = migrate(merged, Save.defaults());
        Save.save();
        if (Game.state === "menu" || Game.state === "map") {
          UI.coins();
          if (
            JSON.stringify([
              Save.d.coins,
              Save.d.unlocked,
              Save.d.reputation,
            ]) !== before
          )
            Game.state === "map" ? buildMap() : showMenuEnvRefresh();
        }
        return true;
      })
      .catch(() => false)
      .finally(() => {
        syncing = null;
        showOnlineStatus();
        if (Online.status.banned)
          UI.toast("This player has been suspended by an admin.");
        else if (Online.status.expired && !warnedExpired) {
          warnedExpired = true;
          UI.toast("You were signed out. Sign in again to keep syncing.");
        }
        Lagos.score(Save.d.stats?.earn || 0);
      });
    return syncing;
  }
  let syncTimer = 0;
  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 1500);
  }
  async function goOnline() {
    showAnnouncement();
    if (!Online.enabled) return showOnlineStatus();
    const fresh =
      !Save.d.lastPlayed && Save.d.unlocked === 1 && !Save.d.stats.serve;
    const cfg = await Online.config();
    if (lifetime.disposed) return;
    if (applyLiveConfig(cfg)) {
      syncPrices();
      if (fresh && Save.d.coins !== LIVE.startCash) {
        Save.d.coins = LIVE.startCash;
        Save.save();
      }
      showAnnouncement();
      UI.coins();
    }
    await connectLagos();
    if (lifetime.disposed) return;
    if (needsSignIn()) openAccount();
    else await syncNow();
    if (Online.account?.signedIn) Online.wallet();
  }
  listen(window, "online", () => syncNow());

  const fontsReady =
    document.fonts && document.fonts.load
      ? Promise.all([
          document.fonts.load('100px "Lilita One"'),
          document.fonts.load('800 20px "Baloo 2"'),
        ]).catch(() => {})
      : Promise.resolve();
  const ready = Promise.all([fontsReady, loadFoodArt(), loadUiArt()]);
  Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(() => {
    if (lifetime.disposed) return;
    try {
      boot();
    } catch (e) {
      console.error(e);
      $("#bootMsg").textContent =
        "Something went wrong while loading: " + e.message;
    }
  });

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
