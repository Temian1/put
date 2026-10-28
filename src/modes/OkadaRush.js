/* Okada Rush: the delivery runner. Draws game/runner.js state with the
   game's own WebGL renderer in a separate scene, so phones never hold a
   second 3D context. */
import {
  createRun,
  step,
  act,
  tierFor,
  runStars,
  runSettlement,
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
  SEG = 24,
  SEGS = 9;
const HOUSE_COLORS = [
  "#FFF4DE",
  "#F7C6A3",
  "#BFE3D0",
  "#FFE08A",
  "#CFE3FF",
  "#F4B6C2",
];
const ROOFS = ["#C8553D", "#3E7CB1", "#8E5B3E", "#2F8F6B", "#B5473A"];
const TIPS = {
  1: "Swipe left or right. Ride through the green rings to deliver!",
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
    segs = [],
    houses = [];
  const objs = new Map();
  const fading = [];
  const owned = { geos: new Set(), mats: new Set() };

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

  function buildScene(tier) {
    scene = new T3.Scene();
    const night = !!tier.night;
    const sky = night ? "#1B2347" : "#7CC8F8";
    scene.background = new T3.Color(sky);
    scene.fog = new T3.Fog(sky, 40, 120);
    scene.add(
      new T3.HemisphereLight(
        night ? 0x8090ff : 0xe6f4ff,
        night ? 0x202030 : 0x9fc46e,
        night ? 0.55 : 0.95,
      ),
    );
    const sun = new T3.DirectionalLight(
      night ? 0xaab8ff : 0xfff4de,
      night ? 0.5 : 1.1,
    );
    sun.position.set(-6, 14, 8);
    scene.add(sun);
    camera = new T3.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 200);

    // Road segments that loop under the rider.
    segs = [];
    for (let i = 0; i < SEGS; i++) {
      const g = new T3.Group();
      g.add(
        mesh(
          box(LANE_W * 3 + 0.6, 0.1, SEG),
          M(night ? "#3B3F4A" : "#5F646E"),
          0,
          -0.05,
          0,
        ),
      );
      // Kerbs and pavement.
      [-1, 1].forEach((s) => {
        g.add(
          mesh(
            box(0.35, 0.25, SEG),
            M("#E9DCC0"),
            s * (LANE_W * 1.5 + 0.45),
            0.05,
            0,
          ),
        );
        g.add(
          mesh(
            box(3.2, 0.12, SEG),
            M(night ? "#5A5E52" : "#C9BFA6"),
            s * (LANE_W * 1.5 + 2.2),
            0,
            0,
          ),
        );
        g.add(
          mesh(
            box(30, 0.05, SEG),
            M(night ? "#2E4A2E" : "#7FC56A"),
            s * 19.4,
            -0.06,
            0,
          ),
        );
      });
      // Dashed lane lines.
      for (let k = 0; k < 4; k++)
        [-0.5, 0.5].forEach((l) =>
          g.add(
            mesh(
              box(0.12, 0.02, 2.6),
              M("#FFFFFF", { emissive: night ? "#444" : "#000" }),
              l * LANE_W,
              0.01,
              -SEG / 2 + 3 + k * 6,
            ),
          ),
        );
      // Street lamps every segment.
      [-1, 1].forEach((s) => {
        const lamp = new T3.Group();
        lamp.add(
          mesh(
            new T3.CylinderGeometry(0.06, 0.08, 4, 6),
            M("#3A3A3A"),
            0,
            2,
            0,
          ),
        );
        lamp.add(mesh(box(0.9, 0.08, 0.2), M("#3A3A3A"), -s * 0.4, 4, 0));
        lamp.add(
          mesh(
            new T3.SphereGeometry(0.18, 8, 6),
            M("#FFF2B0", {
              emissive: night ? "#FFD86B" : "#000",
              emissiveIntensity: night ? 1.4 : 0,
            }),
            -s * 0.8,
            3.85,
            0,
          ),
        );
        lamp.position.set(
          s * (LANE_W * 1.5 + 1),
          0,
          (s > 0 ? 0 : SEG / 2) - SEG / 4,
        );
        g.add(lamp);
      });
      scene.add(track(g));
      segs.push(g);
    }
    // Roadside houses, recycled as you ride past.
    houses = [];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const h = new T3.Group();
      const w = 3 + Math.random() * 2,
        ht = 2.6 + Math.random() * 3.5,
        d = 3.5;
      const wall = HOUSE_COLORS[i % HOUSE_COLORS.length];
      h.add(mesh(box(w, ht, d), M(wall), 0, ht / 2, 0));
      const roof = mesh(
        new T3.ConeGeometry(0.72, 1, 4),
        M(ROOFS[i % ROOFS.length]),
        0,
        ht + 0.55,
        0,
      );
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w * 1.02, 1.1, d * 1.02);
      h.add(roof);
      const glass = M(night ? "#FFE28A" : "#7FC8E8", {
        emissive: night ? "#FFB84D" : "#000",
        emissiveIntensity: night ? 0.8 : 0,
      });
      for (let k = 0; k < Math.floor(w / 1.2); k++)
        h.add(
          mesh(
            box(0.6, 0.6, 0.05),
            glass,
            -w / 2 + 0.8 + k * 1.2,
            ht * 0.6,
            -side * (d / 2 + 0.03),
          ),
        );
      h.rotation.y = 0;
      h.userData = { side, z: i * 9 };
      scene.add(track(h));
      houses.push(h);
    }
    rider = buildRider();
    scene.add(track(rider.root));
  }

  // The okada and its rider, with the Mama Put delivery box on the back.
  function buildRider() {
    const root = new T3.Group(),
      lean = new T3.Group();
    root.add(lean);
    const red = M("#E53935", { roughness: 0.4, metalness: 0.2 });
    lean.add(mesh(box(0.42, 0.35, 1.5), red, 0, 0.62, 0));
    lean.add(mesh(box(0.36, 0.14, 0.7), M("#222"), 0, 0.86, 0.15));
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
      mesh(box(0.9, 0.06, 0.06), M("#888", { metalness: 0.7 }), 0, 1.18, -0.6),
    );
    lean.add(
      mesh(
        new T3.SphereGeometry(0.1, 8, 6),
        M("#FFF7C2", { emissive: "#FFE066", emissiveIntensity: 0.8 }),
        0,
        0.85,
        -0.78,
      ),
    );
    // Delivery box.
    const crate = new T3.Group();
    crate.add(
      mesh(box(0.72, 0.6, 0.62), M("#FFFFFF", { roughness: 0.5 }), 0, 0, 0),
    );
    crate.add(mesh(box(0.74, 0.16, 0.64), M("#12A99F"), 0, 0.12, 0));
    crate.position.set(0, 1.25, 0.62);
    lean.add(crate);
    // Rider.
    let body;
    if (person) {
      body = person();
      body.root.userData.shared = true;
      body.root.scale.setScalar(0.72);
      body.root.position.set(0, 0.62, 0.05);
      body.root.rotation.y = Math.PI;
      lean.add(body.root);
    } else {
      body = { root: mesh(box(0.5, 0.9, 0.35), M("#2F8F6B"), 0, 1.35, 0.05) };
      lean.add(body.root);
    }
    const helmet = mesh(
      new T3.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.8),
      M("#FFC531", { roughness: 0.3 }),
      0,
      2.02,
      0.05,
    );
    helmet.visible = false;
    lean.add(helmet);
    // Turbo flames.
    const flame = mesh(
      new T3.ConeGeometry(0.16, 0.8, 8),
      M("#FF8A00", { emissive: "#FF5A00", emissiveIntensity: 1.2 }),
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
    if (it.type === "hazard") {
      if (it.kind === "danfo") {
        const y = M("#FFC531", { roughness: 0.45 });
        g.add(mesh(box(1.9, 1.9, 4.2), y, 0, 1.15, 0));
        [0.5, 1.3].forEach((h) =>
          g.add(mesh(box(1.92, 0.12, 4.22), M("#1E1E1E"), 0, h, 0)),
        );
        g.add(
          mesh(
            box(1.7, 0.6, 0.05),
            M("#2B3A4A", { roughness: 0.2 }),
            0,
            1.55,
            2.12,
          ),
        );
        [-0.7, 0.7].forEach((x) =>
          [-1.4, 1.4].forEach((z) => {
            const w = mesh(
              new T3.CylinderGeometry(0.32, 0.32, 0.25, 12),
              M("#1E1E1E"),
              x,
              0.32,
              z,
            );
            w.rotation.z = Math.PI / 2;
            g.add(w);
          }),
        );
        g.add(
          mesh(
            box(0.22, 0.15, 0.05),
            M("#FFF7C2", { emissive: "#FFE066" }),
            -0.6,
            0.75,
            2.12,
          ),
        );
        g.add(
          mesh(
            box(0.22, 0.15, 0.05),
            M("#FFF7C2", { emissive: "#FFE066" }),
            0.6,
            0.75,
            2.12,
          ),
        );
      } else if (it.kind === "barrier") {
        for (let k = 0; k < 4; k++)
          g.add(
            mesh(
              box(0.46, 0.32, 0.25),
              M(k % 2 ? "#FFFFFF" : "#E53935"),
              -0.69 + k * 0.46,
              0.62,
              0,
            ),
          );
        [-0.75, 0.75].forEach((x) =>
          g.add(mesh(box(0.12, 0.5, 0.12), M("#555"), x, 0.25, 0)),
        );
      } else if (it.kind === "pothole") {
        const hole = mesh(
          new T3.CylinderGeometry(0.9, 0.9, 0.04, 20),
          M("#1C1A18", { roughness: 1 }),
          0,
          0.03,
          0,
        );
        hole.scale.z = 0.7;
        g.add(hole);
        const rim = mesh(
          new T3.TorusGeometry(0.9, 0.08, 6, 20),
          M("#7A6A55"),
          0,
          0.04,
          0,
        );
        rim.rotation.x = Math.PI / 2;
        rim.scale.y = 0.7;
        g.add(rim);
      } else if (it.kind === "pole") {
        [-1, 1].forEach((s) =>
          g.add(mesh(box(0.15, 1.6, 0.15), M("#333"), s * 1.05, 0.8, 0)),
        );
        for (let k = 0; k < 5; k++)
          g.add(
            mesh(
              box(0.44, 0.18, 0.18),
              M(k % 2 ? "#FFFFFF" : "#E53935"),
              -0.88 + k * 0.44,
              1.35,
              0,
            ),
          );
      }
    } else if (it.type === "note") {
      const n = mesh(
        box(0.55, 0.3, 0.04),
        M("#3FA34D", { emissive: "#1E6B2A", emissiveIntensity: 0.4 }),
        0,
        0.9,
        0,
      );
      g.add(n);
      g.userData.spin = n;
    } else if (it.type === "pack") {
      const p = new T3.Group();
      p.add(mesh(box(0.6, 0.42, 0.45), M("#FFFFFF", { roughness: 0.5 })));
      p.add(mesh(box(0.62, 0.12, 0.47), M("#E53935"), 0, 0.08, 0));
      p.position.y = 1;
      g.add(p);
      g.userData.spin = p;
      const glow = mesh(
        new T3.RingGeometry(0.5, 0.65, 24),
        M("#FFFFFF", { emissive: "#FFFFFF", transparent: true, opacity: 0.6 }),
        0,
        0.03,
        0,
      );
      glow.rotation.x = -Math.PI / 2;
      g.add(glow);
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
        M(c, { emissive: c, emissiveIntensity: 0.6, roughness: 0.3 }),
        0,
        1.1,
        0,
      );
      g.add(orb);
      const ring = mesh(
        new T3.TorusGeometry(0.62, 0.05, 6, 24),
        M("#FFFFFF", { emissive: "#FFFFFF" }),
        0,
        1.1,
        0,
      );
      g.add(ring);
      g.userData.spin = orb;
      g.userData.ring = ring;
    } else if (it.type === "drop") {
      const ring = mesh(
        new T3.TorusGeometry(0.95, 0.12, 8, 28),
        M("#3BE07A", {
          emissive: "#2FA34F",
          emissiveIntensity: 1,
          transparent: true,
          opacity: 0.9,
        }),
        0,
        1.1,
        0,
      );
      g.add(ring);
      g.userData.ring = ring;
      // The customer waiting at the gate, waving.
      const side = it.lane;
      const gate = new T3.Group();
      gate.add(mesh(box(0.12, 1.8, 0.12), M("#8A5A34"), -0.7, 0.9, 0));
      gate.add(mesh(box(0.12, 1.8, 0.12), M("#8A5A34"), 0.7, 0.9, 0));
      gate.add(mesh(box(1.5, 0.12, 0.12), M("#8A5A34"), 0, 1.8, 0));
      gate.position.set(side * 3.4, 0, 0);
      g.add(gate);
      let cust;
      if (person) {
        cust = person(it.id);
        cust.root.userData.shared = true;
        cust.root.position.set(side * 2.9, 0.1, 0);
        cust.root.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(cust.root);
        g.userData.wave = cust.armR || cust.root;
      }
      const sign = mesh(
        new T3.ConeGeometry(0.25, 0.5, 4),
        M("#3BE07A", { emissive: "#2FA34F" }),
        side * 2.9,
        3.1,
        0,
      );
      sign.rotation.x = Math.PI;
      g.add(sign);
      g.userData.sign = sign;
    }
    g.position.x = it.lane * LANE_W;
    scene.add(track(g));
    return g;
  }

  /* ---- HUD ---- */
  function hud() {
    const t = run.tier;
    $("#runClockLabel").textContent = t.endless ? "Distance" : "Time";
    $("#runClock").textContent = t.endless
      ? Math.round(run.dist) + " m"
      : Math.floor(run.timeLeft / 60) +
        ":" +
        String(Math.floor(run.timeLeft % 60)).padStart(2, "0");
    $("#runClockBox").classList.toggle("low", !t.endless && run.timeLeft < 10);
    $("#runDelivered").textContent = t.endless
      ? run.delivered
      : `${run.delivered} / ${t.target}`;
    $("#runDelivered").parentElement.classList.toggle(
      "done",
      !t.endless && run.delivered >= t.target,
    );
    $("#runCash").textContent = fmt(run.cash);
    let packs = "";
    for (let i = 0; i < MAX_PACKS; i++) {
      const p = run.packs[i];
      packs += p
        ? `<span class="pack" style="--h:${p.heat}"><i>🥡</i><em style="width:${Math.round(p.heat * 100)}%"></em></span>`
        : `<span class="pack empty"><i>🥡</i></span>`;
    }
    $("#runPacks").innerHTML = packs;
    $("#runLives").innerHTML =
      [0, 1, 2]
        .map(
          (i) =>
            `<i class="${i < run.maxCrashes - run.crashes ? "on" : ""}">❤</i>`,
        )
        .join("") + (run.power.helmet ? `<i class="shield">⛑️</i>` : "");
    $("#runPowers").innerHTML = ["magnet", "cooler", "turbo"]
      .filter((k) => run.power[k] > 0)
      .map(
        (k) =>
          `<span><b>${POWERS[k].icon}</b>${Math.ceil(run.power[k])}s</span>`,
      )
      .join("");
    $("#runCombo").textContent = run.combo >= 2 ? `x${run.combo} streak` : "";
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

  /* ---- events from the run ---- */
  function onEvent(e) {
    const o = e.item && objs.get(e.item.id);
    if (e.type === "deliver") {
      Sound.play("serve");
      Haptics.play("serve");
      float(`+${fmt(e.pay)}${e.heat >= 0.7 ? " · hot! 🔥" : ""}`, "pay");
      if (run.combo >= 3) message(`Streak x${run.combo}!`, 900);
      if (o) fadeOut(o, 1.8);
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
      message(
        `${POWERS[e.kind].icon} ${POWERS[e.kind].name}: ${POWERS[e.kind].desc}`,
        1300,
      );
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
      float("Missed a customer", "miss");
    } else if (e.type === "empty") {
      message("No food to deliver. Grab a pack 🥡", 1100);
    } else if (e.type === "jump") Sound.play("tap");
    else if (e.type === "over") finish();
  }
  function fadeOut(o, grow) {
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
          message("Go! " + (TIPS[run.tier.id] || ""), 2200);
          Sound.play("go");
        }
      } else step(run, dt).forEach(onEvent);
      if (active) hud();
    }
    if (!run) return;
    // Items: create, move, animate.
    const seen = new Set();
    for (const it of run.items) {
      seen.add(it.id);
      let o = objs.get(it.id);
      if (!o) {
        o = itemMesh(it);
        objs.set(it.id, o);
      }
      const rel = it.z - run.dist;
      o.position.z = -rel;
      o.position.x += (it.lane * LANE_W - o.position.x) * Math.min(1, dt * 10);
      const u = o.userData;
      if (u.spin) u.spin.rotation.y += dt * 3;
      if (u.spin && it.type !== "hazard")
        u.spin.position.y = 1 + Math.sin(T * 4 + it.id) * 0.12;
      if (u.ring) {
        u.ring.rotation.y = it.type === "drop" ? Math.sin(T * 2) * 0.3 : T * 2;
        u.ring.scale.setScalar(1 + Math.sin(T * 5) * 0.06);
      }
      if (u.sign) u.sign.position.y = 3.1 + Math.sin(T * 4) * 0.15;
      if (u.wave) u.wave.rotation.z = Math.sin(T * 8) * 0.6 - 1.2;
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
    // Road and houses loop past.
    const loop = SEG * SEGS;
    segs.forEach((g, i) => {
      const rel = ((((i * SEG - run.dist) % loop) + loop) % loop) - SEG;
      g.position.z = -(rel + SEG / 2);
    });
    const span = houses.length * 9;
    houses.forEach((h) => {
      const rel = ((((h.userData.z - run.dist) % span) + span) % span) - 15;
      h.position.set(h.userData.side * (LANE_W * 1.5 + 6.2), 0, -rel);
    });
    // The rider: steer, lean, jump, duck, blink when hurt.
    const r = rider;
    const px = run.x * LANE_W;
    const prevX = r.root.position.x;
    r.root.position.x = px;
    r.root.position.y = run.y;
    r.lean.rotation.z = Math.max(-0.5, Math.min(0.5, (prevX - px) * 8));
    r.lean.rotation.x = run.slide > 0 ? -0.35 : run.y > 0 ? 0.15 : 0;
    r.lean.scale.y = run.slide > 0 ? 0.7 : 1;
    const spin = (countdown > 0 ? 0 : run.speed) * dt * 3;
    r.wheels.forEach((w) => (w.rotation.x -= spin));
    r.root.visible = run.hurt > 0 ? Math.floor(T * 16) % 2 === 0 : true;
    r.helmet.visible = !!run.power.helmet;
    r.flame.visible = run.power.turbo > 0;
    r.flame.scale.y = 1 + Math.sin(T * 40) * 0.3;
    r.crate.position.y = 1.25 + Math.sin(T * 12) * 0.02 * (run.speed / 10);
    // Camera follows from behind, wider in turbo, shaking on crashes.
    shake = Math.max(0, shake - dt);
    const sx = shake ? (Math.random() - 0.5) * shake : 0,
      sy = shake ? (Math.random() - 0.5) * shake : 0;
    camera.position.x += (px * 0.7 - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y = 4.7 + run.y * 0.4 + sy;
    camera.position.z = 7.6;
    camera.position.x += sx;
    const fov = run.power.turbo > 0 ? 74 : 62;
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    camera.lookAt(px * 0.85, 0.6, -14);
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
    message("3", 700);
    Sound.play("tick");
    $("#scrRun").classList.toggle("night", !!tier.night);
  }

  function finish() {
    paused = true;
    const stars = runStars(run);
    const money = runSettlement(run);
    const res = claimRun(Save.d, run, money, today());
    Save.save();
    UI.coins();
    const t = run.tier;
    const won = t.endless || run.delivered >= t.target;
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
    owned.mats.forEach((m) => m.dispose());
    owned.geos.clear();
    owned.mats.clear();
    objs.clear();
    fading.length = 0;
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
    startScreen();
    return true;
  }
  function close() {
    active = false;
    paused = true;
    ["ovRunStart", "ovRunEnd", "ovRunPause"].forEach((id) => UI.close(id));
    dispose();
    ctx.onExit();
  }

  /* ---- controls: swipes, buttons and keys ---- */
  let touch = null;
  const playing = () => active && run && !paused && countdown <= 0 && !run.over;
  function control(a) {
    if (!playing()) return;
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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
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
  on("#runLeft", () => control("left"));
  on("#runRight", () => control("right"));
  on("#runJump", () => control("jump"));
  on("#runSlide", () => control("slide"));
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
