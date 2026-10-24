// Optional vibration feedback. Silent where unsupported, when disabled in
// settings, or when the player prefers reduced motion.
const PATTERNS = {
  tap: 8,
  serve: 18,
  wrong: [30, 40, 30],
  lost: 90,
  burnt: [50, 30, 50],
  win: [30, 60, 30, 60, 80],
};

export function createHaptics(
  Save,
  nav = globalThis.navigator,
  reduced = false,
) {
  const supported = !!(nav && typeof nav.vibrate === "function");
  return {
    supported,
    play(name) {
      if (!supported || reduced || !Save.d.haptics) return;
      try {
        nav.vibrate(PATTERNS[name] ?? 10);
      } catch (e) {}
    },
  };
}
