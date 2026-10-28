import React from "react";

const paths = {
  play: "M8 4v16l13-8z",
  infinity: "M12 12C8 3 2 6 2 12s6 9 10 0c4-9 10-6 10 0s-6 9-10 0",
  restart: "M3 10a9 9 0 1 1 1 7M3 3v7h7",
  exit: "M10 3H3v18h7m5-15 6 6-6 6m-8-6h14",
  map: "m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3zm6-3v17m8-14v17",
  next: "m9 4 8 8-8 8",
  close: "m5 5 14 14M19 5 5 19",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-10v6m0-9.5v.5",
  back: "m15 4-8 8 8 8",
  check: "m4 12 5 5L20 6",
  upgrade: "m5 12 7-8 7 8h-4v8H9v-8z",
  chef: "M6 10a4 4 0 1 1 2-7 5 5 0 0 1 8 0 4 4 0 1 1 2 7v10H6zm0 6h12",
  gift: "M3 8h18v5H3zm2 5v8h14v-8M12 8v13M12 8C2 8 5-2 10 4zm0 0c10 0 7-10 2-4z",
  note: "M2 6h20v12H2zm4 3v6m12-6v6M9 15V9l6 6V9m-7 2h8m-8 2h8",
  staff:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10v-1a6 6 0 0 1 12 0v1m3-10a3 3 0 1 0 0-6m2 16v-1a5 5 0 0 0-3-4.6",
  target:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  freeze:
    "M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2M4 10.5 6 9 5 6m14 4.5L18 9l1-3",
  bell: "M4 17h16M6 17a6 6 0 0 1 12 0M12 8V6m-2-2h4M3 21h18",
  heart:
    "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z",
  wash: "M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11zm-3 11a3 3 0 0 0 3 3",
  copy: "M8 8h12v12H8zM4 16V4h12",
  basket: "M3 9h18l-2 11H5zm4 0 3-6m7 6-3-6M9 13v4m6-4v4",
  shop: "M3 10h18M4 10l2-6h12l2 6M5 10v10h14V10M9 20v-5h6v5",
  trophy:
    "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4m10-4h3a3 3 0 0 1-3 4M12 14v4m-4 3h8m-6-3h4",
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z",
  zoomIn:
    "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM21 21l-5-5M10.5 7.5v6m-3-3h6",
  zoomOut:
    "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM21 21l-5-5M7.5 10.5h6",
  bike: "M5.5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm13 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5.5 15h5l3-5h3l2 5M9 6h3l1.5 4",
  pack: "M3 8l9-4 9 4v9l-9 4-9-4zm0 0 9 4 9-4M12 12v9",
  sack: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8-3 5 5m0-5-5 5",
  cloud: "M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.6 10 4 4 0 0 1 18 18z",
  boost: "M13 2 4 14h7l-1 8 9-12h-7z",
  style:
    "M12 3a9 9 0 1 0 0 18c1 0 2-1 1.5-2-.6-1.4.4-3 2-3H18a3 3 0 0 0 3-3 9 9 0 0 0-9-10zM7.5 12a1 1 0 1 0 0-2M10 8a1 1 0 1 0 0-2m5 2a1 1 0 1 0 0-2",
  lock: "M6 10h12v11H6zm2 0V7a4 4 0 0 1 8 0v3",
  serve: "M3 16h18M5 16a7 7 0 0 1 14 0M12 5v2M4 20h16",
  broom: "M14 3l-4 9m-3 0h8l2 9H5zM9 16l-1 5m4-5v5m3-5 1 5",
  user: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM3.5 21a8.5 8.5 0 0 1 17 0",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z",
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
        fill={name === "play" || name === "boost" ? "currentColor" : "none"}
      />
    </svg>
  );
}
