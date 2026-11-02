import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    launchOptions: {
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: {
      DEMO_MODE: "true",
      SESSION_SECRET: randomBytes(32).toString("hex"),
      DATABASE_URL: "",
      DATABASE_PATH: `data/e2e-${Date.now()}.sqlite`,
      APP_URL: "http://localhost:3100",
    },
  },
  reporter: "list",
});
