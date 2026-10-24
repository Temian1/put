import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/original.css";
import "./styles/react.css";
import "./styles/business.css";

createRoot(document.getElementById("root")).render(<App />);

// Offline play and install support. Skipped in dev so Vite's hot reload is never cached.
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .catch(() => {}),
  );
