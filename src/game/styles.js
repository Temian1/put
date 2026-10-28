// How each restaurant looks, from a roadside buka to a first-class
// restaurant. `colors` override the chapter theme; `furniture` picks the
// dining tables and chairs; `extras` adds decorations. Endless Rush has its
// own night venue with a live scoreboard.
export const PLACE_STYLES = {
  ch0: {
    label: "Humble beginnings",
    furniture: "plastic",
    extras: [],
  },
  ch1: {
    label: "Street food spot",
    furniture: "plastic",
    extras: ["awning"],
  },
  ch2: {
    label: "Market canteen",
    colors: { floor: ["#E9D7B9", "#C9A97E"], bench: "#6D4C32" },
    furniture: "wood",
    extras: ["lanterns"],
  },
  ch3: {
    label: "Owambe tent",
    furniture: "banquet",
    extras: ["bunting"],
  },
  ch4: {
    label: "Family restaurant",
    colors: { counter: "#6D4C41", top: "#F3E5D0", trim: "#C9A227" },
    furniture: "wood",
    extras: ["planters"],
  },
  ch5: {
    label: "City café",
    colors: {
      floor: ["#ECEFF1", "#B0BEC5"],
      counter: "#37474F",
      top: "#FAFAFA",
      trim: "#00BFA5",
      bench: "#455A64",
      signBg: "#263238",
    },
    furniture: "cafe",
    extras: ["neon", "planters"],
  },
  ch6: {
    label: "Seafood garden",
    colors: {
      floor: ["#E0F2F1", "#80CBC4"],
      counter: "#1565C0",
      trim: "#FFFFFF",
      signBg: "#1565C0",
    },
    furniture: "wood",
    extras: ["awning", "palms"],
  },
  ch7: {
    label: "Food court",
    colors: {
      floor: ["#FFFFFF", "#FFE0B2"],
      counter: "#FB8C00",
      top: "#FFFFFF",
      trim: "#43A047",
      signBg: "#43A047",
    },
    furniture: "cafe",
    extras: ["pillars", "planters"],
  },
  ch8: {
    label: "Banquet hall",
    colors: {
      floor: ["#F3E5F5", "#CE93D8"],
      counter: "#4A148C",
      top: "#FFF8E1",
      trim: "#D4A537",
      signBg: "#4A148C",
    },
    furniture: "banquet",
    extras: ["chandelier", "bunting"],
  },
  ch9: {
    label: "First-class restaurant",
    colors: {
      floor: ["#1B1B1B", "#3A3022"],
      counter: "#111111",
      top: "#F5F0E6",
      trim: "#D4A537",
      bench: "#2B2B2B",
      signBg: "#111111",
      ground: "#5D4037",
    },
    furniture: "luxury",
    extras: ["carpet", "chandelier", "pillars", "planters"],
  },
  endless: {
    label: "Endless Rush night market",
    colors: {
      sky: ["#1A1240", "#5B2A86"],
      ground: "#2A2238",
      floor: ["#2E2A40", "#4A3F6B"],
      counter: "#1E1E2E",
      top: "#2D2D44",
      trim: "#FF2E88",
      bench: "#26263A",
      tray: "#00E5FF",
      signBg: "#FF2E88",
      light: [0.6, 0.7],
      sign: ["ENDLESS RUSH", "How long can you last?"],
    },
    furniture: "neon",
    extras: ["neon", "scoreboard", "lanterns"],
  },
};

export const styleFor = (key) => PLACE_STYLES[key] || PLACE_STYLES.ch0;
