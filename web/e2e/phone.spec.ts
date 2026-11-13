import { expect, SCREENS, stubApi, test } from "./fixtures";
import { OPEN } from "./helpers";

const PHONES = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

/** Whether the page is wider than the window: a horizontal scroll bar. */
async function overflow(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

for (const phone of PHONES) {
  test.describe(`${phone.width} px: no sideways scroll`, () => {
    test.use({ viewport: phone });

    for (const screen of SCREENS) {
      test(screen.name, async ({ app: page }) => {
        await page.goto(screen.path);
        await page.getByRole("banner").waitFor();
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    }

    test("the sign-in screen", async ({ page }) => {
      await stubApi(page, { signedOut: true });
      await page.goto("login");
      await page.getByRole("heading", { name: "Almanac" }).waitFor();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });

    test("the details sheet, the form, the account menu and the drawer", async ({ app: page }) => {
      await page.goto("week/2026/11/11");
      await OPEN.details(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await page.keyboard.press("Escape");
      await OPEN.form(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await page.keyboard.press("Escape");
      await OPEN.account(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await page.keyboard.press("Escape");
      await OPEN.drawer(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  });
}
