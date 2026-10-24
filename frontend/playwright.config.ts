import { defineConfig, devices } from "@playwright/test";

const WEB_URL = "http://localhost:3000";
const API_URL = "http://localhost:8000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "smoke", testMatch: /smoke\.spec\.ts/ },
    { name: "screenshots", testMatch: /screenshots\.spec\.ts/ },
    { name: "demo", testMatch: /demo\.spec\.ts/ },
  ],
  // Reuse servers started with `npm run dev`; otherwise start them for the run.
  webServer: [
    {
      command: "node ../scripts/py.mjs -m uvicorn app.main:app --port 8000",
      url: `${API_URL}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      url: WEB_URL,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
