import { afterEach, describe, expect, it, vi } from "vitest";
import { Lifetime } from "../src/engine/Lifetime.js";

afterEach(() => vi.unstubAllGlobals());

function environment() {
  const callbacks = {};
  const browser = {
    requestAnimationFrame: vi.fn((fn) => {
      callbacks.frame = fn;
      return 12;
    }),
    cancelAnimationFrame: vi.fn(),
    setTimeout: vi.fn((fn) => {
      callbacks.timer = fn;
      return 34;
    }),
    clearTimeout: vi.fn(),
  };
  vi.stubGlobal("window", browser);
  return { browser, callbacks };
}

describe("engine lifetime cleanup", () => {
  it("cancels pending frames/timers and removes listeners with matching capture options", () => {
    const { browser } = environment(),
      life = new Lifetime();
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      handler = vi.fn(),
      options = { capture: true };
    life.requestAnimationFrame(handler);
    life.setTimeout(handler, 200);
    life.listen(target, "pointerdown", handler, options);
    life.dispose();
    expect(browser.cancelAnimationFrame).toHaveBeenCalledWith(12);
    expect(browser.clearTimeout).toHaveBeenCalledWith(34);
    expect(target.removeEventListener).toHaveBeenCalledWith(
      "pointerdown",
      handler,
      options,
    );
    expect(life.frames.size).toBe(0);
    expect(life.timers.size).toBe(0);
  });
  it("prevents stale callbacks and new work after unmount", () => {
    const { browser, callbacks } = environment(),
      life = new Lifetime(),
      handler = vi.fn();
    life.requestAnimationFrame(handler);
    life.setTimeout(handler, 200);
    life.dispose();
    callbacks.frame(1000);
    callbacks.timer();
    expect(handler).not.toHaveBeenCalled();
    expect(life.requestAnimationFrame(handler)).toBe(0);
    expect(life.setTimeout(handler, 1)).toBe(0);
    expect(browser.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(browser.setTimeout).toHaveBeenCalledTimes(1);
  });
  it("releases completed work instead of cancelling it again", () => {
    const { browser, callbacks } = environment(),
      life = new Lifetime(),
      handler = vi.fn();
    life.requestAnimationFrame(handler);
    life.setTimeout(handler, 200);
    callbacks.frame(1000);
    callbacks.timer();
    life.dispose();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(browser.cancelAnimationFrame).not.toHaveBeenCalled();
    expect(browser.clearTimeout).not.toHaveBeenCalled();
  });
});
