import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/put/",
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
  test: { environment: "node" },
});
