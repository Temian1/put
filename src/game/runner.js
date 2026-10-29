/* Okada Rush: deliver Mama Put orders on an okada through Lagos traffic.
   Pure logic only: lanes, moving traffic, hawkers, the police, food heat,
   deliveries and power-ups. The 3D view draws whatever this state holds. */

export const LANES = [-1, 0, 1];
export const RUN_UNLOCK = 10;

// The run grows with the player's restaurant level. Below level 50 a run is
// a timed delivery round with a target; from level 50 it is endless.
export const TIERS = [
  {
    id: 1,
    from: RUN_UNLOCK,
    name: "Roadside rounds",
    desc: "Light traffic. Weave past the cars and drop off.",
    speed: 9,
    maxSpeed: 13,
    gap: 20,
    time: 75,
    target: 5,
    cool: 0.02,
    hazards: ["car", "danfo"],
    hawkers: 0,
    shift: 0,
    pay: 900,
  },
  {
    id: 2,
    from: 20,
    name: "Market traffic",
    desc: "Keke, danfo and hawkers crossing anyhow. Watch the indicators!",
    speed: 11,
    maxSpeed: 16,
    gap: 16,
    time: 85,
    target: 7,
    cool: 0.026,
    hazards: ["car", "danfo", "keke"],
    hawkers: 0.14,
    shift: 0.2,
    pay: 1300,
  },
  {
    id: 3,
    from: 35,
    name: "Night rush",
    desc: "Night traffic, and the police are on patrol.",
    speed: 13,
    maxSpeed: 19,
    gap: 14,
    time: 90,
    target: 9,
    cool: 0.03,
    hazards: ["car", "danfo", "keke"],
    hawkers: 0.16,
    shift: 0.3,
    patrol: 45,
    night: true,
    pay: 1800,
  },
  {
    id: 4,
    from: 50,
    name: "Okada Endless",
    desc: "No clock. Deliver as many as you can before 3 crashes.",
    speed: 14,
    maxSpeed: 27,
    gap: 12,
    time: 0,
    target: 0,
    cool: 0.034,
    hazards: ["car", "danfo", "keke"],
    hawkers: 0.18,
    shift: 0.35,
    patrol: 35,
    endless: true,
    pay: 2400,
  },
];

export const tierFor = (level) =>
  [...TIERS].reverse().find((t) => level >= t.from) || null;

// Everything on the road moves. Traffic drives the same way you do, at a
// share of your speed (`pace`); hawkers walk across the road.
export const HAZARDS = {
  car: { name: "Car", pace: [0.4, 0.55] },
  danfo: { name: "Danfo bus", pace: [0.28, 0.42] },
  keke: { name: "Keke", pace: [0.2, 0.32] },
  hawker: { name: "Hawker crossing" },
};

export const POWERS = {
  magnet: {
    name: "Magnet",
    icon: "🧲",
    time: 8,
    desc: "Pulls in notes and packs",
  },
  cooler: { name: "Cooler box", icon: "🧊", time: 12, desc: "Food stays hot" },
  helmet: { name: "Helmet", icon: "⛑️", time: 0, desc: "One free crash" },
  turbo: {
    name: "Turbo",
    icon: "⚡",
    time: 5,
    desc: "Speed up and fly past traffic",
  },
};

export const MAX_PACKS = 3;
// Who is waiting at the gate.
export const CUSTOMERS = [
  "Mama Bisi",
  "Oga Tunde",
  "Aunty Ngozi",
  "Baba Sule",
  "Chidi",
  "Halima",
  "Uncle Femi",
  "Sister Joy",
  "Emeka",
  "Madam Kemi",
];

// The next customer ahead who is still waiting, if any.
export const nextDrop = (r) =>
  r.items
    .filter((i) => i.type === "drop" && !i.done && i.z > r.dist - 0.5)
    .sort((a, b) => a.z - b.z)[0] || null;

const LANE_SPEED = 9,
  AHEAD = 140,
  BOOST_T = 0.9,
  BOOST_CD = 2.2,
  BRAKE_T = 0.7,
  CHASE_T = 12,
  // Hawkers stand at the kerb, then step out when you get this close.
  HAWKER_GO = 30,
  KERB = 2.7;

export function createRun(tier, rng = Math.random, opts = {}) {
  const r = {
    tier,
    rng,
    t: 0,
    dist: 0,
    speed: tier.speed,
    lane: 0,
    x: 0,
    boost: 0,
    boostCd: 0,
    brake: 0,
    crashes: 0,
    maxCrashes: 3,
    hurt: 0,
    packs: [],
    delivered: 0,
    hot: 0,
    missed: 0,
    combo: 0,
    bestCombo: 0,
    cash: 0,
    notes: 0,
    timeLeft: tier.time,
    power: { magnet: 0, cooler: 0, turbo: 0, helmet: !!opts.helmet },
    // The insulated box (Okada gear) slows cooling for good.
    coolRate: tier.cool * (opts.box ? 0.6 : 1),
    // The police: null, or a chase { gap, t } with the gap in metres.
    police: null,
    patrolIn: tier.patrol ? tier.patrol * 0.6 : 0,
    caught: 0,
    escapes: 0,
    items: [],
    nextId: 1,
    genZ: 30,
    over: false,
    events: [],
  };
  // Start with an order already in the box so the first drop comes quickly.
  r.packs.push({ heat: 1 });
  generate(r);
  return r;
}

const pickOf = (r, list) => list[Math.floor(r.rng() * list.length)];
const add = (r, item) => {
  const it = { id: r.nextId++, ...item };
  r.items.push(it);
  return it;
};
// Where a moving item meets the rider: vehicles by `meet`, the rest by `z`.
const meetOf = (it) => it.meet ?? it.z;

// A vehicle driving ahead in a lane. Its place is worked out from the
// rider's distance so it reaches the rider exactly at `meet`, however fast
// the rider goes; that keeps every row fair.
function vehicle(r, kind, lane, z) {
  const [a, b] = HAZARDS[kind].pace;
  return add(r, {
    type: "hazard",
    kind,
    lane,
    x: lane,
    meet: z,
    z,
    vf: a + r.rng() * (b - a),
    signal: 0,
  });
}

// Lays the road ahead in rows. Every row leaves at least one lane open.
function generate(r) {
  const t = r.tier;
  while (r.genZ < r.dist + AHEAD) {
    const z = r.genZ;
    const roll = r.rng();
    if (roll < 0.22) {
      // A customer waiting at a gate on one side. The run-up to the gate is
      // kept clear of traffic in that lane.
      const side = r.rng() < 0.5 ? -1 : 1;
      r.items = r.items.filter(
        (i) =>
          i.type !== "hazard" ||
          meetOf(i) < z - 24 ||
          meetOf(i) > z + 4 ||
          (i.kind !== "hawker" && i.lane !== side && i.shift !== side),
      );
      const drop = r.nextId;
      add(r, { type: "drop", lane: side, z, name: pickOf(r, CUSTOMERS) });
      // Arrows painted on the road lead into the drop lane, then notes.
      for (let k = 1; k <= 3; k++)
        add(r, { type: "guide", lane: side, z: z - 6 - k * 4, drop });
      for (let k = 1; k <= 2; k++)
        add(r, { type: "note", lane: side, z: z - k * 2.2 });
    } else if (roll < 0.36) {
      // A food stall hands out a pack.
      add(r, { type: "pack", lane: pickOf(r, LANES), z });
    } else if (roll < 0.42) {
      add(r, {
        type: "power",
        kind: pickOf(r, Object.keys(POWERS)),
        lane: pickOf(r, LANES),
        z,
      });
    } else if (roll < 0.42 + t.hawkers) {
      // A hawker with a tray on the head crosses wherever they like.
      const from = r.rng() < 0.5 ? -1 : 1;
      const lane = pickOf(r, LANES);
      add(r, {
        type: "hazard",
        kind: "hawker",
        lane,
        x: from * KERB,
        from,
        z,
        vx: 0,
      });
      const open = LANES.filter((l) => l !== lane);
      const nl = pickOf(r, open);
      for (let k = 0; k < 3; k++)
        add(r, { type: "note", lane: nl, z: z + 2 + k * 2 });
    } else {
      // Traffic: one or two lanes taken, the rest carry notes.
      const blocked = r.rng() < 0.35 + t.id * 0.08 ? 2 : 1;
      const lanes = [...LANES].sort(() => r.rng() - 0.5);
      const cars = lanes
        .slice(0, blocked)
        .map((lane) => vehicle(r, pickOf(r, t.hazards), lane, z));
      let open = lanes[blocked];
      // Sometimes a driver flicks the indicator and moves into the open lane,
      // leaving their own lane free instead.
      const mover = cars.find((c) => Math.abs(c.lane - open) === 1);
      if (mover && r.rng() < t.shift) {
        mover.shift = open;
        open = mover.lane;
      }
      if (r.rng() < 0.6)
        for (let k = 0; k < 3; k++)
          add(r, { type: "note", lane: open, z: z + 2 + k * 2 });
    }
    const gap = Math.max(t.gap * 0.6, t.gap - r.dist / 400);
    r.genZ += gap * (0.8 + r.rng() * 0.4);
  }
}

// Player input: "left", "right", "boost" or "brake" ("jump" and "slide"
// are older names for the last two).
export function act(r, a) {
  if (r.over) return;
  if (a === "left") r.lane = Math.max(-1, r.lane - 1);
  else if (a === "right") r.lane = Math.min(1, r.lane + 1);
  else if (a === "boost" || a === "jump") {
    if (r.boostCd > 0) return;
    r.boost = BOOST_T;
    r.boostCd = BOOST_CD;
    r.brake = 0;
    r.events.push({ type: "boost" });
  } else if (a === "brake" || a === "slide") {
    r.brake = BRAKE_T;
    r.boost = 0;
    r.events.push({ type: "brake" });
  }
}

// Money for one delivery: hotter food and longer streaks pay more.
export function deliveryPay(tier, heat, combo) {
  const base = tier.pay * (0.55 + 0.45 * heat);
  const tip = heat >= 0.7 ? tier.pay * 0.25 : 0;
  return (
    Math.round(((base + tip) * (1 + Math.min(combo, 10) * 0.05)) / 10) * 10
  );
}
// What the police take when they catch you, and the bonus for losing them.
export const policeFine = (tier) => Math.round((tier.pay * 0.5) / 10) * 10;
export const escapeBonus = (tier) => Math.round((tier.pay * 0.3) / 10) * 10;

function chase(r) {
  r.police = { gap: 7, t: CHASE_T };
  r.events.push({ type: "police" });
}
function endChase(r) {
  r.police = null;
  r.patrolIn = (r.tier.patrol || 40) * (0.7 + r.rng() * 0.6);
}

function crash(r, item) {
  if (r.power.turbo > 0 || r.hurt > 0) return;
  if (r.power.helmet) {
    r.power.helmet = false;
    r.hurt = 1;
    r.events.push({ type: "shield", item });
    return;
  }
  r.crashes++;
  r.hurt = 1.4;
  r.combo = 0;
  r.speed = Math.max(r.tier.speed, r.speed * 0.7);
  const spilled = r.packs.pop();
  r.events.push({ type: "crash", item, spilled: !!spilled });
  if (r.crashes >= r.maxCrashes) return end(r, "crashes");
  // A crash draws the police; a crash while they chase lets them close in.
  if (r.police) r.police.gap -= 4;
  else chase(r);
}

function end(r, why) {
  if (r.over) return;
  r.over = true;
  r.why = why;
  r.events.push({ type: "over", why });
}

// Moves traffic and hawkers to where they are this frame.
function moveTraffic(r, it, dt, v) {
  if (it.meet != null) {
    it.z = it.meet - it.vf * (it.meet - r.dist);
    if (it.shift == null) return;
    const rel = it.z - r.dist;
    const p = Math.min(1, Math.max(0, (24 - rel) / 12));
    it.x = it.lane + (it.shift - it.lane) * p * p * (3 - 2 * p);
    it.signal = p < 1 && rel < 42 ? Math.sign(it.shift - it.lane) : 0;
  } else if (it.kind === "hawker") {
    const rel = it.z - r.dist;
    // Steps out timed to be in their lane as you arrive, at your speed now.
    if (!it.go && rel < HAWKER_GO) {
      it.go = true;
      it.vx = (it.lane - it.x) / Math.max(0.4, rel / Math.max(v, 1));
    }
    if (it.go && Math.abs(it.x) < KERB + 0.3) it.x += it.vx * dt;
  }
}

export function step(r, dt) {
  if (r.over) return r.events.splice(0);
  const t = r.tier;
  r.t += dt;
  // Speed creeps up the longer you ride; boost, brake and turbo change it.
  r.speed = Math.min(t.maxSpeed, r.speed + dt * (t.endless ? 0.12 : 0.06));
  const v =
    r.speed *
    (r.power.turbo > 0 ? 1.6 : 1) *
    (r.boost > 0 ? 1.35 : 1) *
    (r.brake > 0 ? 0.55 : 1);
  r.dist += v * dt;
  if (!t.endless) {
    r.timeLeft = Math.max(0, r.timeLeft - dt);
    if (r.timeLeft <= 0) end(r, "time");
  }
  const dx = r.lane - r.x;
  r.x += Math.sign(dx) * Math.min(Math.abs(dx), LANE_SPEED * dt * 0.5);
  r.boost = Math.max(0, r.boost - dt);
  r.boostCd = Math.max(0, r.boostCd - dt);
  r.brake = Math.max(0, r.brake - dt);
  r.hurt = Math.max(0, r.hurt - dt);
  for (const k of ["magnet", "cooler", "turbo"])
    r.power[k] = Math.max(0, r.power[k] - dt);
  // Food cools down on the way unless it is in the cooler box.
  if (!r.power.cooler)
    r.packs.forEach((p) => (p.heat = Math.max(0, p.heat - r.coolRate * dt)));

  // The police: patrols on later tiers, and a chase after any crash. Speed
  // away (boost, turbo) to lose them; braking lets them catch up.
  if (t.patrol && !r.police) {
    r.patrolIn -= dt;
    if (r.patrolIn <= 0) chase(r);
  }
  if (r.police) {
    const p = r.police;
    p.t -= dt;
    p.gap = Math.min(
      10,
      p.gap +
        dt *
          (r.power.turbo > 0
            ? 2
            : r.boost > 0
              ? 1.8
              : r.brake > 0
                ? -3
                : -0.35),
    );
    if (p.gap <= 1) {
      const fine = Math.min(r.cash, policeFine(t));
      r.cash -= fine;
      r.combo = 0;
      r.caught++;
      endChase(r);
      r.events.push({ type: "caught", fine });
    } else if (p.t <= 0) {
      const bonus = escapeBonus(t);
      r.cash += bonus;
      r.escapes++;
      endChase(r);
      r.events.push({ type: "escaped", bonus });
    }
  }

  const lanePos = Math.round(r.x);
  for (let i = r.items.length - 1; i >= 0; i--) {
    const it = r.items[i];
    if (it.type === "hazard") moveTraffic(r, it, dt, v);
    const rel = it.z - r.dist;
    // The magnet pulls notes and packs from any lane.
    if (
      r.power.magnet > 0 &&
      (it.type === "note" || it.type === "pack") &&
      rel < 9 &&
      rel > -1
    )
      it.lane = lanePos;
    if (rel > 0.9) continue;
    if (rel < -2) {
      if (it.type === "drop" && !it.done) {
        r.missed++;
        r.combo = 0;
        r.events.push({ type: "missed", item: it });
      }
      // Passed traffic drops back behind you before it goes.
      if (it.type !== "hazard" || rel < -12) r.items.splice(i, 1);
      continue;
    }
    const ix = it.x ?? it.lane;
    if (it.done || Math.abs(ix - r.x) > (it.kind === "hawker" ? 0.42 : 0.5))
      continue;
    if (it.type === "hazard") {
      crash(r, it);
      it.done = true;
    } else if (it.type === "note") {
      it.done = true;
      r.notes++;
      r.cash += 20;
      r.events.push({ type: "note", item: it });
    } else if (it.type === "pack") {
      it.done = true;
      if (r.packs.length < MAX_PACKS) {
        r.packs.push({ heat: 1 });
        r.events.push({ type: "pack", item: it });
      } else r.events.push({ type: "full", item: it });
    } else if (it.type === "power") {
      it.done = true;
      if (it.kind === "helmet") r.power.helmet = true;
      else r.power[it.kind] = POWERS[it.kind].time;
      r.events.push({ type: "power", item: it, kind: it.kind });
    } else if (it.type === "drop") {
      it.done = true;
      if (!r.packs.length) {
        r.missed++;
        r.combo = 0;
        r.events.push({ type: "empty", item: it });
        continue;
      }
      // The hottest pack goes to the customer.
      r.packs.sort((a, b) => b.heat - a.heat);
      const pack = r.packs.shift();
      r.combo++;
      r.bestCombo = Math.max(r.bestCombo, r.combo);
      r.delivered++;
      if (pack.heat >= 0.7) r.hot++;
      const pay = deliveryPay(t, pack.heat, r.combo);
      r.cash += pay;
      r.events.push({ type: "deliver", item: it, heat: pack.heat, pay });
    }
  }
  generate(r);
  return r.events.splice(0);
}

// Stars for a timed round: reach the target, then beat it.
export function runStars(r) {
  const t = r.tier;
  if (t.endless)
    return r.delivered >= 30
      ? 3
      : r.delivered >= 15
        ? 2
        : r.delivered >= 5
          ? 1
          : 0;
  if (r.delivered < t.target) return 0;
  return (
    1 +
    (r.delivered >= t.target + 3 ? 1 : 0) +
    (r.delivered >= t.target + 6 ? 1 : 0)
  );
}

// What the run earned for the restaurant, and its fuel cost.
export function runSettlement(r) {
  const fuel = Math.round((r.dist * 2) / 10) * 10;
  const spoiled = r.packs.length * Math.round(r.tier.pay * 0.3);
  return {
    gross: r.cash,
    fuel,
    spoiled,
    net: Math.max(0, r.cash - fuel),
  };
}
