// Scale the kitchen and delivery workload with the customers in this shift.
// Equipment remains an additional benefit on top of the growing restaurant.
export function serviceLoad(cfg) {
  const target = Number.isFinite(cfg.goal)
    ? Math.max(15, cfg.goal)
    : 15 + 5 * Math.max(0, (cfg.n || 1) - 1);
  const growth = Math.max(0, Math.floor((target - 15) / 5));
  return {
    extraSinkCapacity: growth,
    onlineLimit: Math.min(4, 2 + Math.floor(growth / 25)),
    onlinePortions: Math.min(4, 1 + Math.floor(growth / 25)),
    onlineIntervalScale: Math.max(0.5, 1 / (1 + growth * 0.0125)),
  };
}
