import { defineConfig } from "@playwright/test";

/**
 * The browser tests: headless Chromium against the Vite dev server, with the
 * API stubbed from the board's fixture week (`e2e/fixtures.ts`), so no server,
 * database or account is needed and every run sees the same week. Three
 * projects, one per theme choice: light (the first visit), dark, and system
 * (which follows the browser's colour scheme, dark here).
 *
 * `npx playwright test --workers=2` from `web/`. `SHOTS_DIR=<folder> npx
 * playwright test shots` also writes the screen captures (never in git).
 */
const PORT = 5177;
const BASE = "/almanac/";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    locale: "en-GB",
    timezoneId: "Europe/Bucharest",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "light", use: { colorScheme: "light", storageState: undefined }, metadata: { theme: "light" } },
    { name: "dark", use: { colorScheme: "dark" }, metadata: { theme: "dark" } },
    { name: "system", use: { colorScheme: "dark" }, metadata: { theme: "system" } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
