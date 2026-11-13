import type { Page } from "@playwright/test";
import { freezeClock, chooseTheme, stubApi, test, type StubOptions } from "./fixtures";
import { OPEN } from "./helpers";

/**
 * The screen captures the comparison with the board's comps is made from (never in git):
 *
 *   SHOTS_DIR=<folder> npx playwright test shots --workers=2
 *
 * writes `<screen>-<theme>-<width>.png` at 1280 x 800 and 390 x 844, in light and dark. Every drawn screen
 * and every screen the board did not draw. Without SHOTS_DIR the file does nothing.
 */
const DIR = process.env.SHOTS_DIR;

const WIDTHS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

interface Shot {
  name: string;
  path: string;
  options?: StubOptions;
  /** Without the sign-in. */
  signedOut?: boolean;
  /** Reach the state to capture; the page has loaded. */
  steps?: (page: Page, phone: boolean) => Promise<void>;
}

const SHOTS: Shot[] = [
  { name: "week", path: "week/2026/11/11" },
  {
    name: "week-scrolled",
    path: "week/2026/11/11",
    steps: async (page, phone) => {
      if (!phone) return;
      await page.locator("main").evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    },
  },
  { name: "event-details", path: "week/2026/11/11", steps: async (page) => OPEN.details(page) },
  { name: "event-form", path: "week/2026/11/11", steps: async (page) => editForm(page) },
  { name: "week-empty", path: "week/2026/11/11", options: { empty: true } },
  { name: "week-loading", path: "week/2026/11/11", options: { slow: true } },
  { name: "week-error", path: "week/2026/11/11", options: { calendarsFail: true } },
  { name: "sign-in", path: "login", signedOut: true },
  { name: "day", path: "day/2026/11/11" },
  { name: "month", path: "month/2026/11/11" },
  { name: "year", path: "year/2026/11/11" },
  {
    name: "year-day",
    path: "year/2026/11/11",
    steps: async (page) => {
      await page.getByRole("button", { name: "Wednesday, 11 November 2026, has events" }).first().click();
      await page.getByRole("dialog").waitFor();
    },
  },
  { name: "search-results", path: "search?q=team" },
  { name: "search-empty", path: "search?q=zzz" },
  {
    name: "quick-create",
    path: "day/2026/11/11",
    steps: async (page) => {
      const column = await page.locator("[data-view] [role=columnheader]").first().boundingBox();
      await page.mouse.click((column?.x ?? 100) + 120, 560);
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    name: "repeat-picker",
    path: "week/2026/11/11",
    steps: async (page) => {
      await OPEN.form(page);
      await page.getByRole("combobox", { name: "Repeat" }).selectOption({ index: 2 });
    },
  },
  {
    name: "time-field",
    path: "week/2026/11/11",
    steps: async (page) => {
      await OPEN.form(page);
      await page.getByRole("combobox", { name: "Start time" }).click();
    },
  },
  {
    name: "scope-dialog",
    path: "week/2026/11/11",
    steps: async (page) => {
      await page
        .getByRole("button", { name: /Team standup/ })
        .first()
        .click();
      await page.getByRole("button", { name: "Delete event" }).click();
      await page.getByRole("dialog", { name: "Delete recurring event" }).waitFor();
    },
  },
  {
    name: "calendar-menu",
    path: "week/2026/11/11",
    steps: async (page, phone) => {
      if (phone) await OPEN.drawer(page);
      await optionsOfWork(page);
      await page.getByRole("menu").waitFor();
    },
  },
  {
    name: "calendar-palette",
    path: "week/2026/11/11",
    steps: async (page, phone) => {
      if (phone) await OPEN.drawer(page);
      await optionsOfWork(page);
      await page.getByRole("menuitem", { name: /^Colour/ }).click();
      await page.getByRole("dialog", { name: "Colour of Work" }).waitFor();
    },
  },
  {
    name: "calendar-delete",
    path: "week/2026/11/11",
    steps: async (page, phone) => {
      if (phone) await OPEN.drawer(page);
      await optionsOfWork(page);
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page.getByRole("alertdialog").waitFor();
    },
  },
  { name: "account-menu", path: "week/2026/11/11", steps: async (page) => OPEN.account(page) },
  {
    name: "time-zone",
    path: "week/2026/11/11",
    steps: async (page) => {
      await OPEN.account(page);
      await page.getByRole("menuitem", { name: /^Time zone/ }).click();
      await page.getByRole("dialog", { name: "Time zone" }).waitFor();
    },
  },
  {
    name: "change-password",
    path: "week/2026/11/11",
    steps: async (page) => {
      await OPEN.account(page);
      await page.getByRole("menuitem", { name: "Change password" }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    name: "notifications",
    path: "week/2026/11/11",
    steps: async (page) => {
      await OPEN.account(page);
      await page.getByRole("menuitem", { name: "Notifications" }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
  { name: "theme", path: "week/2026/11/11", steps: async (page) => OPEN.theme(page) },
  {
    name: "drawer",
    path: "week/2026/11/11",
    steps: async (page, phone) => {
      // From 1100 px the column is beside the view: the drawer is shown at the width where it is one.
      if (!phone) await page.setViewportSize({ width: 1024, height: 768 });
      await OPEN.drawer(page);
    },
  },
  {
    name: "toast",
    path: "week/2026/11/11",
    steps: async (page) => {
      await page.getByRole("button", { name: /Read/ }).first().click();
      await page.getByRole("button", { name: "Delete event" }).click();
      await page.getByText("Event deleted").waitFor();
    },
  },
];

/** The ⋮ of the Work row, which shows under the pointer or the keyboard: focus the row's checkbox first. */
async function optionsOfWork(page: Page): Promise<void> {
  await page.getByRole("checkbox", { name: "Work" }).focus();
  await page.getByRole("button", { name: "Options for Work" }).click();
}

/** The details' Edit: the form for Design review, which has every field. */
async function editForm(page: Page): Promise<void> {
  await OPEN.details(page);
  await page.getByRole("button", { name: "Edit event" }).click();
  await page.getByRole("dialog", { name: "Edit event" }).waitFor();
}

test.skip(!DIR, "set SHOTS_DIR to write the captures");

for (const { width, height } of WIDTHS) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height } });
    for (const shot of SHOTS) {
      test(shot.name, async ({ page }, testInfo) => {
        const theme = String(testInfo.project.metadata.theme);
        test.skip(theme === "system", "light and dark only");
        await freezeClock(page);
        await chooseTheme(page, theme);
        await stubApi(page, { ...shot.options, signedOut: shot.signedOut });
        await page.goto(shot.path);
        if (shot.signedOut) await page.getByRole("heading", { name: "Almanac" }).waitFor();
        else if (!shot.options?.slow) await page.getByRole("banner").waitFor();
        await page.waitForTimeout(900);
        await shot.steps?.(page, width < 768);
        await page.waitForTimeout(500);
        const shown = page.viewportSize()?.width ?? width;
        await page.screenshot({ path: `${DIR}/${shot.name}-${theme}-${shown}.png` });
      });
    }
  });
}
