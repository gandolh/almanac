import { expect, SCREENS, stubApi, test } from "./fixtures";
import { OPEN } from "./helpers";

test.use({ reducedMotion: "reduce" });

/**
 * The CSS animations and transitions that still move after the screen has settled: any that runs
 * longer than the reduced-motion 1 ms or repeats. A 1 ms one caught mid-flight on a busy machine
 * doesn't count, since it is over before it shows.
 */
async function running(page: import("@playwright/test").Page): Promise<string[]> {
  // Long enough for the lazy calendar to load, draw its events and let its own settling transitions end.
  await page.waitForTimeout(1200);
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        if (animation.playState !== "running") return false;
        const timing = animation.effect?.getComputedTiming();
        return timing?.iterations === Infinity || Number(timing?.duration ?? 0) > 1;
      })
      .map(
        (animation) =>
          `${animation.constructor.name} ${(animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty}`,
      ),
  );
}

test.describe("with reduced motion nothing keeps moving", () => {
  for (const screen of SCREENS) {
    test(screen.name, async ({ app: page }) => {
      await page.goto(screen.path);
      await page.getByRole("banner").waitFor();
      expect(await running(page)).toEqual([]);
    });
  }

  test("the sign-in screen", async ({ page }) => {
    await stubApi(page, { signedOut: true });
    await page.goto("login");
    await page.getByRole("heading", { name: "Almanac" }).waitFor();
    expect(await running(page)).toEqual([]);
  });

  test("the details, the form, the menu and the drawer", async ({ app: page }) => {
    await page.goto("week/2026/11/11");
    await OPEN.details(page);
    expect(await running(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await OPEN.form(page);
    expect(await running(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await OPEN.account(page);
    expect(await running(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await OPEN.drawer(page);
    expect(await running(page)).toEqual([]);
  });
});
