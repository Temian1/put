// Only structural UI changes cross this store. Animation values stay on DOM refs.
export function createGameStore() {
  let snapshot = { screen: null, overlays: {}, slots: {} };
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch) {
      snapshot = { ...snapshot, ...patch };
      listeners.forEach((fn) => fn());
    },
  };
}
