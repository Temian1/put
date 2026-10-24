import { defineConfig, devices } from "@playwright/test";

// Gameplay journeys run on the dev server (it exposes the window.__mp debug
// hook used to fast-forward levels). PWA checks run on the production build.
// Set PW_CHANNEL=chrome to use an installed Chrome instead of downloading one.
const channel = process.env.PW_CHANNEL || undefined;
const phone = {
  ...devices["Pixel 7"],
  defaultBrowserType: "chromium",
  channel,
};

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Each worker renders WebGL in software, so keep parallelism modest.
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "journeys",
      testMatch: /journeys|layout|business/,
      use: { ...phone, baseURL: "http://127.0.0.1:5180/put/" },
    },
    {
      // Sign-in, wallet and leaderboard against a mocked Kikter backend.
      name: "account",
      testMatch: /account/,
      use: { ...phone, baseURL: "http://127.0.0.1:5181/put/" },
    },
    {
      name: "pwa",
      testMatch: /pwa/,
      use: { ...phone, baseURL: "http://127.0.0.1:4180/put/" },
    },
    {
      // Pixel snapshots depend on fonts and GPU, so they run only on request:
      // npm run test:visual (add -- --update-snapshots to refresh baselines).
      name: "visual",
      testMatch: /visual/,
      use: { ...phone, baseURL: "http://127.0.0.1:5180/put/" },
    },
  ],
  webServer: [
    {
      command: "npx vite --host 127.0.0.1 --port 5180 --strictPort",
      url: "http://127.0.0.1:5180/put/",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npx vite --host 127.0.0.1 --port 5181 --strictPort",
      url: "http://127.0.0.1:5181/put/",
      reuseExistingServer: !process.env.CI,
      env: { VITE_MAMAPUT_API: "https://api.mock/mamaput" },
    },
    {
      command:
        "npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --host 127.0.0.1 --port 4180 --strictPort",
      url: "http://127.0.0.1:4180/put/",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // Never create players on the live Kikter backend from tests.
      env: { VITE_MAMAPUT_API: "off" },
    },
  ],
});
