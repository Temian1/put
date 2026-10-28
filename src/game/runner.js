/* Okada Rush: deliver Mama Put orders on an okada through Lagos traffic.
   Pure logic only: lanes, the road ahead, crashes, food heat, deliveries
   and power-ups. The 3D view draws whatever this state holds. */

export const LANES = [-1, 0, 1];
export const RUN_UNLOCK = 10;

// The run grows with the player's restaurant level. Below level 50 a run is
// a timed delivery round with a target; from level 50 it is endless.
export const TIERS = [
  {
    id: 1,
    from: RUN_UNLOCK,
    name: "Roadside rounds",
    desc: "Quiet streets. Learn to dodge and drop off.",
    speed: 9,
    maxSpeed: 13,
    gap: 20,
    time: 75,
    target: 5,
    cool: 0.02,
    hazards: ["danfo", "barrier"],
    pay: 900,
  },
  {
    id: 2,
    from: 20,
    name: "Market traffic",
    desc: "Busier roads and potholes. Jump them!",
    speed: 11,
    maxSpeed: 16,
    gap: 16,
    time: 85,
    target: 7,
    cool: 0.026,
    hazards: ["danfo", "barrier", "pothole"],
    pay: 1300,
  },
  {
    id: 3,
    from: 35,
    name: "Night rush",
    desc: "Checkpoints at night. Duck under the poles.",
    speed: 13,
    maxSpeed: 19,
    gap: 14,
    time: 90,
    target: 9,
    cool: 0.03,
    hazards: ["danfo", "barrier", "pothole", "pole"],
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
    hazards: ["danfo", "barrier", "pothole", "pole"],
    endless: true,
    pay: 2400,
  },
];

export const tierFor = (level) =>
  [...TIERS].reverse().find((t) => level >= t.from) || null;

// What gets you past each hazard.
export const HAZARDS = {
  danfo: { name: "Danfo bus", dodge: "lane" },
  barrier: { name: "Road barrier", dodge: "jump" },
  pothole: { name: "Pothole", dodge: "jump" },
  pole: { name: "Checkpoint pole", dodge: "slide" },
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
const JUMP_V = 9.5,
  GRAVITY = 26,
  SLIDE_T = 0.75,
  LANE_SPEED = 9,
  AHEAD = 140;

export function createRun(tier, rng = Math.random, opts = {}) {
  const r = {
    tier,
    rng,
    t: 0,
    dist: 0,
    speed: tier.speed,
    lane: 0,
    x: 0,
    y: 0,
    vy: 0,
    slide: 0,
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
const add = (r, item) => r.items.push({ id: r.nextId++, ...item });

// Lays the road ahead in rows. Every row leaves at least one lane open.
function generate(r) {
  const t = r.tier;
  while (r.genZ < r.dist + AHEAD) {
    const z = r.genZ;
    const roll = r.rng();
    // Every few rows: a customer waiting at a gate on one side.
    if (roll < 0.22) {
      const side = r.rng() < 0.5 ? -1 : 1;
      add(r, { type: "drop", lane: side, z });
      // A row of notes leads into the drop lane.
      for (let k = 1; k <= 3; k++)
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
    } else {
      // Hazards: one or two lanes blocked, the rest carry notes.
      const blocked = r.rng() < 0.35 + t.id * 0.08 ? 2 : 1;
      const lanes = [...LANES].sort(() => r.rng() - 0.5);
      lanes
        .slice(0, blocked)
        .forEach((lane) =>
          add(r, { type: "hazard", kind: pickOf(r, t.hazards), lane, z }),
        );
      // Never block all three with things you cannot jump.
      const open = lanes[blocked];
      if (r.rng() < 0.6)
        for (let k = 0; k < 3; k++)
          add(r, { type: "note", lane: open, z: z + 2 + k * 2 });
    }
    const gap = Math.max(t.gap * 0.6, t.gap - r.dist / 400);
    r.genZ += gap * (0.8 + r.rng() * 0.4);
  }
}

// Player input: "left", "right", "jump" or "slide".
export function act(r, a) {
  if (r.over) return;
  if (a === "left") r.lane = Math.max(-1, r.lane - 1);
  else if (a === "right") r.lane = Math.min(1, r.lane + 1);
  else if (a === "jump" && r.y <= 0.01) {
    r.vy = JUMP_V;
    r.slide = 0;
    r.events.push({ type: "jump" });
  } else if (a === "slide") {
    r.slide = SLIDE_T;
    if (r.y > 0) r.vy = -JUMP_V * 1.4; // drop fast from a jump
    r.events.push({ type: "slide" });
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
  if (r.crashes >= r.maxCrashes) end(r, "crashes");
}

function end(r, why) {
  if (r.over) return;
  r.over = true;
  r.why = why;
  r.events.push({ type: "over", why });
}

export function step(r, dt) {
  if (r.over) return r.events.splice(0);
  const t = r.tier;
  r.t += dt;
  // Speed creeps up the longer you ride; turbo adds a burst.
  r.speed = Math.min(t.maxSpeed, r.speed + dt * (t.endless ? 0.12 : 0.06));
  const v = r.speed * (r.power.turbo > 0 ? 1.6 : 1);
  r.dist += v * dt;
  if (!t.endless) {
    r.timeLeft = Math.max(0, r.timeLeft - dt);
    if (r.timeLeft <= 0) end(r, "time");
  }
  // Steering, jumping, ducking.
  const dx = r.lane - r.x;
  r.x += Math.sign(dx) * Math.min(Math.abs(dx), LANE_SPEED * dt * 0.5);
  if (r.y > 0 || r.vy > 0) {
    r.vy -= GRAVITY * dt;
    r.y = Math.max(0, r.y + r.vy * dt);
    if (r.y === 0) r.vy = 0;
  }
  r.slide = Math.max(0, r.slide - dt);
  r.hurt = Math.max(0, r.hurt - dt);
  for (const k of ["magnet", "cooler", "turbo"])
    r.power[k] = Math.max(0, r.power[k] - dt);
  // Food cools down on the way unless it is in the cooler box.
  if (!r.power.cooler)
    r.packs.forEach((p) => (p.heat = Math.max(0, p.heat - r.coolRate * dt)));

  const lanePos = Math.round(r.x);
  for (let i = r.items.length - 1; i >= 0; i--) {
    const it = r.items[i];
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
      r.items.splice(i, 1);
      continue;
    }
    if (it.done || Math.abs(it.lane - r.x) > 0.45) continue;
    if (it.type === "hazard") {
      const how = HAZARDS[it.kind].dodge;
      const dodged =
        (how === "jump" && r.y > 0.55) || (how === "slide" && r.slide > 0);
      if (!dodged) crash(r, it);
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
