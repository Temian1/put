import React from "react";

const paths = {
  play: "M8 4v16l13-8z",
  infinity: "M12 12C8 3 2 6 2 12s6 9 10 0c4-9 10-6 10 0s-6 9-10 0",
  restart: "M3 10a9 9 0 1 1 1 7M3 3v7h7",
  exit: "M10 3H3v18h7m5-15 6 6-6 6m-8-6h14",
  map: "m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3zm6-3v17m8-14v17",
  next: "m9 4 8 8-8 8",
  close: "m5 5 14 14M19 5 5 19",
  check: "m4 12 5 5L20 6",
  upgrade: "m5 12 7-8 7 8h-4v8H9v-8z",
  chef: "M6 10a4 4 0 1 1 2-7 5 5 0 0 1 8 0 4 4 0 1 1 2 7v10H6zm0 6h12",
  gift: "M3 8h18v5H3zm2 5v8h14v-8M12 8v13M12 8C2 8 5-2 10 4zm0 0c10 0 7-10 2-4z",
  coin: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M9 7v10m6-10v10m-8-6h10m-10 3h10",
  lock: "M6 10h12v11H6zm2 0V7a4 4 0 0 1 8 0v3",
  serve: "M3 16h18M5 16a7 7 0 0 1 14 0M12 5v2M4 20h16",
};

export function Icon({ name = "check", className = "" }) {
  return (
    <svg
      className={"buttonIcon " + className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={paths[name] || paths.check}
        fill={name === "play" ? "currentColor" : "none"}
      />
    </svg>
  );
}
