import { STAFF, NAMES, PLACES } from "./data.js";

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
// The safe holds this many shifts of takings; then it stops filling.
export const TILL_SHIFTS = 12;

export const crewAt = (d, place) => (d.crew && d.crew[place]) || [];

// The people working this shift at a restaurant, with their job details.
export function onShift(d, place) {
  return crewAt(d, place)
    .filter((m) => !m.off && jobOf(m.job))
    .map((m) => ({ ...jobOf(m.job), id: m.uid, job: m.job, name: m.name }));
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
      p.income + staff.reduce((t, m) => t + wageOf(m) * STAFF_RETURN, 0);
    const gross = Math.round(potential * repFactor * mgr.share);
    const cut = Math.round(gross * mgr.pay);
    let left = gross - cut + (d.till[p.id] || 0);
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

export const tillAt = (d, place) => (d.till && d.till[place]) || 0;
export const tillTotal = (d) =>
  Object.values(d.till || {}).reduce((s, v) => s + v, 0);

// Moves a restaurant's safe into your cash.
export function collect(d, place) {
  const v = tillAt(d, place);
  if (!v) return 0;
  d.till[place] = 0;
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
