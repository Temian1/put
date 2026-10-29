import { STAFF, NAMES, PLACES } from "./data.js";
import { equipTotal, upkeep } from "./equipment.js";

// Each restaurant has its own crew. Staff are hired for one restaurant and
// work only there; you can hire several people for the same job. A manager
// runs a restaurant while you play elsewhere: its takings go into the
// manager's safe (the till) and you collect them from the Grow screen.
// Without a manager an old restaurant stays shut while you are away.

// How many people each restaurant can use per job.
export const CREW_LIMIT = {
  server: 3,
  cook: 2,
  cleaner: 2,
  rider: 2,
  errand: 1,
  manager: 1,
};

// Managers differ in skill. `share` is how much of a restaurant's potential
// they earn while you are away. `pay` is their cut of those takings.
// `saving` trims waste (ingredients, packs) when you play there yourself.
export const MANAGERS = [
  {
    id: "mgr1",
    role: "manager",
    name: "Junior manager",
    title: "Junior manager",
    desc: "Keeps the doors open while you are away. Earns 55% of what you would",
    cost: 40000,
    share: 0.55,
    pay: 0.15,
    saving: 0.04,
    stars: 1,
    a: "#5B2350",
    b: "#FFC531",
    skin: 1,
    hat: "cap",
  },
  {
    id: "mgr2",
    role: "manager",
    name: "Experienced manager",
    title: "Experienced manager",
    desc: "Runs a tight shift. Earns 80% of what you would and wastes less food",
    cost: 150000,
    share: 0.8,
    pay: 0.12,
    saving: 0.08,
    stars: 2,
    a: "#1E5AA8",
    b: "#FFF4DE",
    skin: 3,
    hat: "cap",
  },
  {
    id: "mgr3",
    role: "manager",
    name: "Expert manager",
    title: "Expert manager",
    desc: "A seasoned boss. Earns 100% of what you would and cuts waste the most",
    cost: 450000,
    share: 1,
    pay: 0.1,
    saving: 0.12,
    stars: 3,
    a: "#2FA34F",
    b: "#FFC531",
    skin: 5,
    hat: "cap",
  },
];

export const JOBS = [...STAFF, ...MANAGERS];
export const jobOf = (id) => JOBS.find((j) => j.id === id) || null;
// Each worker at an away restaurant brings in this many times their wage,
// before the manager's skill share. A skilled manager profits from staff;
// a junior one barely covers their salaries.
export const STAFF_RETURN = 1.6;
// Each equipment level at an away restaurant adds this share of its income.
export const EQUIP_RETURN = 0.04;
// The safe holds this many shifts of takings; then it stops filling.
export const TILL_SHIFTS = 12;

export const crewAt = (d, place) => (d.crew && d.crew[place]) || [];

// The people working this shift at a restaurant, with their job details.
export function onShift(d, place) {
  return crewAt(d, place)
    .filter((m) => !m.off && jobOf(m.job))
    .map((m) => ({
      ...jobOf(m.job),
      id: m.uid,
      job: m.job,
      name: m.name,
      strikes: m.strikes || 0,
    }));
}

export const roleCount = (d, place, role) =>
  crewAt(d, place).filter((m) => jobOf(m.job)?.role === role).length;

export const managerAt = (d, place) => {
  const m = crewAt(d, place).find((x) => jobOf(x.job)?.role === "manager");
  return m ? { ...m, ...jobOf(m.job), uid: m.uid, name: m.name } : null;
};

export function canHire(d, place, jobId) {
  const job = jobOf(jobId);
  if (!job) return { ok: false, why: "Unknown job" };
  if (!d.branches.includes(place))
    return { ok: false, why: "Open this restaurant first" };
  if (roleCount(d, place, job.role) >= (CREW_LIMIT[job.role] || 1))
    return {
      ok: false,
      why:
        job.role === "manager"
          ? "This restaurant already has a manager"
          : `No more room for another ${job.role}`,
    };
  return { ok: true };
}

// Adds a person (the caller takes the hiring fee). The first hire of a job
// keeps its usual name; later ones get a new Nigerian name.
export function hire(d, place, jobId, rng = Math.random) {
  if (!canHire(d, place, jobId).ok) return null;
  const job = jobOf(jobId);
  d.crew = d.crew || {};
  const list = (d.crew[place] = d.crew[place] || []);
  const taken = new Set(list.map((m) => m.name));
  let name = job.role === "manager" ? "" : job.name;
  if (!name || taken.has(name)) {
    const free = NAMES.filter((n) => !taken.has(n));
    name = free.length ? free[Math.floor(rng() * free.length)] : job.name;
  }
  if (job.role === "manager") name = "Manager " + name;
  d.crewSeq = (d.crewSeq || 0) + 1;
  const m = { uid: "c" + d.crewSeq, job: jobId, name, off: false, unpaid: 0 };
  list.push(m);
  return m;
}

export function sack(d, place, uid) {
  if (!d.crew?.[place]) return false;
  const before = d.crew[place].length;
  d.crew[place] = d.crew[place].filter((m) => m.uid !== uid);
  return d.crew[place].length < before;
}

export function toggleDuty(d, place, uid) {
  const m = crewAt(d, place).find((x) => x.uid === uid);
  if (m && jobOf(m.job)?.role !== "manager") m.off = !m.off;
  return m || null;
}

// Pay for one shift at a restaurant. Managers are paid from their share
// of an away restaurant's takings, so only staff with a wage count here.
export const wageOf = (m) => jobOf(m.job)?.wage || 0;
export const wageBill = (d, place) =>
  crewAt(d, place)
    .filter((m) => !m.off)
    .reduce((s, m) => s + wageOf(m), 0);

// Staff wages are paid in hiring order from `cash`. Anyone not paid in
// full gets a strike; at `limit` strikes in a row they quit.
export function payCrew(d, place, cash, limit) {
  let left = Math.max(0, cash),
    paid = 0;
  const unpaid = [],
    quit = [];
  const working = crewAt(d, place).filter((m) => !m.off && wageOf(m) > 0);
  for (const m of working) {
    const w = wageOf(m);
    if (left >= w) {
      left -= w;
      paid += w;
      m.unpaid = 0;
    } else {
      m.unpaid = (m.unpaid || 0) + 1;
      unpaid.push(m.name);
      if (m.unpaid >= limit) quit.push(m);
    }
  }
  if (quit.length && d.crew?.[place])
    d.crew[place] = d.crew[place].filter((m) => !quit.includes(m));
  return {
    bill: working.reduce((s, m) => s + wageOf(m), 0),
    paid,
    unpaid,
    quit: quit.map((m) => m.name),
  };
}

/**
 * After every shift, each other open restaurant with a manager earns into
 * its safe: its income, scaled by reputation, the manager's skill and the
 * staff working there, minus the manager's cut and the staff wages. With
 * no manager it stays shut. Returns what each restaurant made.
 */
export function runBranches(d, current, repFactor, limit) {
  d.till = d.till || {};
  const made = [];
  for (const p of PLACES) {
    if (p.id === current || !d.branches.includes(p.id) || !p.income) continue;
    const mgr = managerAt(d, p.id);
    if (!mgr) continue;
    const staff = crewAt(d, p.id).filter(
      (m) => !m.off && jobOf(m.job)?.role !== "manager",
    );
    const potential =
      p.income * (1 + EQUIP_RETURN * equipTotal(d, p.id)) +
      staff.reduce((t, m) => t + wageOf(m) * STAFF_RETURN, 0);
    const gross = Math.round(potential * repFactor * mgr.share);
    const cut = Math.round(gross * mgr.pay);
    let left = gross - cut - upkeep(d, p.id) + (d.till[p.id] || 0);
    const pay = payCrew(d, p.id, left, limit);
    left -= pay.paid;
    const cap = p.income * TILL_SHIFTS;
    const before = d.till[p.id] || 0;
    d.till[p.id] = Math.max(0, Math.min(cap, Math.round(left)));
    made.push({
      place: p.id,
      name: p.name,
      net: d.till[p.id] - before,
      full: d.till[p.id] >= cap,
      quit: pay.quit,
    });
  }
  return made;
}

const pendingCredits = (d, place) =>
  Object.entries(d.growCredits || {}).filter(
    ([id, credit]) =>
      credit.place === place &&
      credit.amount > 0 &&
      !(d.growCollected || []).includes(id),
  );
export const tillAt = (d, place) =>
  ((d.till && d.till[place]) || 0) +
  pendingCredits(d, place).reduce((sum, [, credit]) => sum + credit.amount, 0);
export const tillTotal = (d) =>
  [
    ...new Set([
      ...Object.keys(d.till || {}),
      ...Object.values(d.growCredits || {}).map((credit) => credit.place),
    ]),
  ].reduce((sum, place) => sum + tillAt(d, place), 0);

// Moves a restaurant's safe into your cash.
export function collect(d, place) {
  const v = tillAt(d, place);
  if (!v) return 0;
  d.till = d.till || {};
  d.till[place] = 0;
  d.growCollected = [
    ...(d.growCollected || []),
    ...pendingCredits(d, place).map(([id]) => id),
  ];
  d.coins += v;
  return v;
}

// Staff hired before restaurants had their own crews worked wherever you
// played; they move to the restaurant you were running.
export function migrateCrew(out) {
  if (out.crew && typeof out.crew === "object") return out;
  out.crew = {};
  out.crewSeq = 0;
  const place = out.place || "ch0";
  for (const id of out.staff || []) {
    if (!jobOf(id)) continue;
    out.crewSeq++;
    (out.crew[place] = out.crew[place] || []).push({
      uid: "c" + out.crewSeq,
      job: id,
      name: jobOf(id).name,
      off: (out.staffOff || []).includes(id),
      unpaid: (out.unpaid || {})[id] || 0,
    });
  }
  out.staff = [];
  out.staffOff = [];
  return out;
}

/* ---- Payday: salaries build up and you pay them yourself ---- */
// Each shift you play is one working day; a game month is MONTH_DAYS days.
// Staff at the restaurant you run earn their daily wage into what they are
// owed. Pay them from the Staff screen. Anyone still owed money when the
// month ends gets a strike and works slower; at QUIT_STRIKES they quit.
// Managers pay the staff of the restaurants they run from the safe.
export const MONTH_DAYS = 10;
export const QUIT_STRIKES = 2;
// Unpaid workers take this much longer over every job.
export const UNPAID_SLOWDOWN = 1.35;

export const dayOfMonth = (d) => ((d.day || 0) % MONTH_DAYS) + 1;
export const daysToPayday = (d) => MONTH_DAYS - ((d.day || 0) % MONTH_DAYS);
export const monthOf = (d) => Math.floor((d.day || 0) / MONTH_DAYS) + 1;

export const owedAt = (d, place) =>
  crewAt(d, place).reduce((s, m) => s + (m.owed || 0), 0);
export const owedTotal = (d) =>
  Object.keys(d.crew || {}).reduce((s, p) => s + owedAt(d, p), 0);

/**
 * Ends a working day at `place`: everyone on duty there earns a day's wage.
 * When the month ends, anyone at any restaurant still owed money gets a
 * strike and those at the limit quit. Returns who was warned and who left.
 */
export function workDay(d, place) {
  for (const m of crewAt(d, place))
    if (!m.off && wageOf(m) > 0) m.owed = (m.owed || 0) + wageOf(m);
  d.day = (d.day || 0) + 1;
  const warned = [],
    quit = [];
  if (d.day % MONTH_DAYS === 0)
    for (const p of Object.keys(d.crew || {})) {
      for (const m of crewAt(d, p)) {
        if (!(m.owed > 0)) continue;
        m.strikes = (m.strikes || 0) + 1;
        (m.strikes >= QUIT_STRIKES ? quit : warned).push({ ...m, place: p });
      }
      if (quit.some((q) => q.place === p))
        d.crew[p] = d.crew[p].filter(
          (m) => !quit.some((q) => q.uid === m.uid && q.place === p),
        );
    }
  return { warned, quit, payday: d.day % MONTH_DAYS === 0 };
}

// Pays one worker everything they are owed, if you have the money.
export function payMember(d, place, uid) {
  const m = crewAt(d, place).find((x) => x.uid === uid);
  if (!m || !(m.owed > 0)) return { ok: false, why: "Nothing owed" };
  if (d.coins < m.owed) return { ok: false, why: "Not enough money" };
  const paid = m.owed;
  d.coins -= paid;
  m.owed = 0;
  m.strikes = 0;
  return { ok: true, paid };
}

// Pays everyone at a restaurant, in hiring order, while the money lasts.
export function payAll(d, place) {
  let paid = 0,
    left = 0;
  for (const m of crewAt(d, place)) {
    if (!(m.owed > 0)) continue;
    const r = payMember(d, place, m.uid);
    if (r.ok) paid += r.paid;
    else left += m.owed;
  }
  return { paid, left };
}

// Unpaid workers are slower until they get their money.
export const isUnpaid = (m) => (m.strikes || 0) > 0;

/* ---- Opening hours: managed restaurants earn while you are away ---- */
export const OPEN_HOUR = 7;
export const CLOSE_HOUR = 22;
// Most offline time counted at once, in hours.
export const AWAY_CAP_HOURS = 48;
const LAGOS_OFFSET = 1; // West Africa Time, UTC+1, no daylight saving.

export const lagosHour = (ms) =>
  (new Date(ms).getUTCHours() + LAGOS_OFFSET) % 24;
export const isOpenAt = (ms) => {
  const h = lagosHour(ms);
  return h >= OPEN_HOUR && h < CLOSE_HOUR;
};

// Include partial hours, including visits that start between clock hours.
function openMillisBetween(from, to) {
  if (!(from > 0) || !(to > from)) return 0;
  const H = 3600000,
    start = Math.max(from, to - AWAY_CAP_HOURS * H);
  let n = 0;
  for (let t = start; t < to; ) {
    const end = Math.min(to, (Math.floor(t / H) + 1) * H);
    if (isOpenAt(t)) n += end - t;
    t = end;
  }
  return n;
}
export function openHoursBetween(from, to) {
  return Math.floor(openMillisBetween(from, to) / 3600000);
}

/**
 * Catches up every restaurant with a manager for the opening hours since
 * `d.awayFrom`, one shift per hour (the safe still stops filling when full).
 * Returns what they made in total.
 */
export function earnWhileAway(d, now, repFactor, limit) {
  const eligible = PLACES.some(
    (p) => d.branches.includes(p.id) && p.income && managerAt(d, p.id),
  );
  const H = 3600000;
  const remainder = Number.isFinite(d.awayOpenMs)
    ? Math.max(0, Math.min(H - 1, d.awayOpenMs))
    : 0;
  const elapsed = eligible
    ? openMillisBetween(d.awayFrom || 0, now) + remainder
    : 0;
  const hours = Math.floor(elapsed / H);
  d.awayOpenMs = elapsed % H;
  d.awayFrom = Math.max(d.awayFrom || 0, now);
  let made = 0;
  const quit = [];
  for (let i = 0; i < hours; i++)
    for (const b of runBranches(d, null, repFactor, limit)) {
      made += Math.max(0, b.net);
      quit.push(...b.quit);
    }
  return { hours, made, quit };
}
