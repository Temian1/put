// All engine-owned asynchronous work belongs to one mount, including short FX timers.
export class Lifetime {
  disposed = false;
  frames = new Set();
  timers = new Set();
  listeners = [];
  requestAnimationFrame = (fn) => {
    if (this.disposed) return 0;
    const id = window.requestAnimationFrame((t) => {
      this.frames.delete(id);
      if (!this.disposed) fn(t);
    });
    this.frames.add(id);
    return id;
  };
  setTimeout = (fn, delay) => {
    if (this.disposed) return 0;
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.disposed) fn();
    }, delay);
    this.timers.add(id);
    return id;
  };
  clearTimeout = (id) => {
    window.clearTimeout(id);
    this.timers.delete(id);
  };
  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.listeners.push(() =>
      target.removeEventListener(type, handler, options),
    );
  }
  dispose() {
    this.disposed = true;
    this.frames.forEach((id) => window.cancelAnimationFrame(id));
    this.timers.forEach((id) => window.clearTimeout(id));
    this.listeners.forEach((remove) => remove());
    this.frames.clear();
    this.timers.clear();
    this.listeners.length = 0;
  }
}
