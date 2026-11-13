import { expect, SCREENS, stubApi, test } from "./fixtures";
import { focusRing, OPEN } from "./helpers";

/** Tab from the top of the page, up to `stops` times, and say which stops show no ring. */
async function ringless(page: import("@playwright/test").Page, stops: number): Promise<string[]> {
  const missing: string[] = [];
  for (let stop = 0; stop < stops; stop += 1) {
    await page.keyboard.press("Tab");
    const { ok, what } = await focusRing(page);
    if (!ok) missing.push(what);
  }
  return missing;
}

test.describe("a visible focus ring on every Tab stop", () => {
  for (const screen of SCREENS) {
    test(screen.name, async ({ app: page }) => {
      await page.goto(screen.path);
      await page.getByRole("banner").waitFor();
      expect(await ringless(page, 45)).toEqual([]);
    });
  }

  test("the sign-in screen", async ({ page }, testInfo) => {
    await stubApi(page, { signedOut: true });
    await page.addInitScript(
      (theme) => window.localStorage.setItem("almanac.theme", theme),
      String(testInfo.project.metadata.theme),
    );
    await page.goto("login");
    await page.getByRole("heading", { name: "Almanac" }).waitFor();
    expect(await ringless(page, 6)).toEqual([]);
  });

  test("the event details", async ({ app: page }) => {
    await page.goto("week/2026/11/11");
    await OPEN.details(page);
    expect(await ringless(page, 4)).toEqual([]);
  });

  test("the event form", async ({ app: page }) => {
    await page.goto("week/2026/11/11");
    await OPEN.form(page);
    expect(await ringless(page, 14)).toEqual([]);
  });

  test("the account menu and the theme dialog", async ({ app: page }) => {
    await page.goto("week/2026/11/11");
    await OPEN.account(page);
    expect(await ringless(page, 3)).toEqual([]);
    await page.keyboard.press("Escape");
    await OPEN.theme(page);
    expect(await ringless(page, 4)).toEqual([]);
  });

  test("the phone's drawer", async ({ app: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("week/2026/11/11");
    await OPEN.drawer(page);
    expect(await ringless(page, 12)).toEqual([]);
  });
});
