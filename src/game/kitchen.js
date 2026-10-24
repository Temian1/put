// Cooking station state machine: raw → cooking → ready → burnt → raw.
// A ready batch holds several portions; if it is not served within `hold`
// seconds the remaining portions burn and must be thrown away.
// Pots open the day already cooked (`ready`); pans start empty.
export function createCooker(spec, ready = false) {
  return {
    spec,
    stage: ready ? "ready" : "raw",
    t: 0,
    stock: ready ? spec.batch : 0,
    burnt: 0,
    batches: 0,
  };
}

// Advances time. speed > 1 cooks faster (upgrade). Returns the new stage on change.
export function tickCooker(s, dt, speed = 1) {
  if (s.stage === "cooking") {
    s.t += dt * speed;
    if (s.t >= s.spec.time) {
      s.stage = "ready";
      s.stock = s.spec.batch;
      s.t = 0;
      s.batches++;
      return "ready";
    }
  } else if (s.stage === "ready") {
    s.t += dt;
    if (s.t >= s.spec.hold) {
      s.burnt += s.stock;
      s.stage = "burnt";
      s.stock = 0;
      s.t = 0;
      return "burnt";
    }
  }
  return null;
}

// Player or cook taps the station. Returns what happened.
export function tapCooker(s) {
  if (s.stage === "raw") {
    s.stage = "cooking";
    s.t = 0;
    return "start";
  }
  if (s.stage === "burnt") {
    s.stage = "raw";
    s.t = 0;
    return "clear";
  }
  return s.stage === "cooking" ? "busy" : "ready";
}

export const hasPortion = (s) => s.stage === "ready" && s.stock > 0;

export function takePortion(s) {
  if (!hasPortion(s)) return false;
  s.stock--;
  if (!s.stock) {
    s.stage = "raw";
    s.t = 0;
  }
  return true;
}

// 0..1 progress for the button ring: cooking fills up, ready drains toward burning.
export function cookerProgress(s) {
  if (s.stage === "cooking") return Math.min(1, s.t / s.spec.time);
  // Food that cannot burn shows how much of the pot is left instead.
  if (s.stage === "ready" && s.spec.hold === Infinity)
    return s.stock / s.spec.batch;
  if (s.stage === "ready") return Math.max(0, 1 - s.t / s.spec.hold);
  return 0;
}

// Dirty plates: each served lane leaves a plate; the sink holds a limited stack.
export function createSink(capacity = 4) {
  return { capacity, plates: 0, washing: 0, washed: 0 };
}
export const sinkFull = (sink) => sink.plates >= sink.capacity;
export function addPlate(sink) {
  if (sinkFull(sink)) return false;
  sink.plates++;
  return true;
}
// Washing takes `per` seconds a plate. Returns plates finished this tick.
export function tickSink(sink, dt, per = 0.55) {
  if (!sink.washing || !sink.plates) {
    sink.washing = 0;
    return 0;
  }
  sink.washing += dt;
  let done = 0;
  while (sink.washing >= per && sink.plates) {
    sink.washing -= per;
    sink.plates--;
    sink.washed++;
    done++;
  }
  if (!sink.plates) sink.washing = 0;
  return done;
}
export function startWash(sink) {
  if (!sink.plates || sink.washing) return false;
  sink.washing = 0.0001;
  return true;
}
