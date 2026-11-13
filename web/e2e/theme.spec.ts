import { expect, freezeClock, stubApi, test } from "./fixtures";
import { OPEN } from "./helpers";

test("the first visit is light", async ({ page }) => {
  await freezeClock(page);
  await stubApi(page);
  await page.goto("week/2026/11/11");
  await page.getByRole("banner").waitFor();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(237, 237, 232)");
});

test("the project's theme is the one in use", async ({ app: page }, testInfo) => {
  await page.goto("week/2026/11/11");
  await page.getByRole("banner").waitFor();
  const theme = String(testInfo.project.metadata.theme);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  // The browser is dark in the dark and system projects, so the page is dark in those.
  const ground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(ground).toBe(theme === "light" ? "rgb(237, 237, 232)" : "rgb(17, 17, 13)");
});

test("the switch changes the theme and keeps it", async ({ app: page }) => {
  await page.goto("week/2026/11/11");
  await OPEN.theme(page);
  for (const [name, attribute] of [
    ["Dark", "dark"],
    ["Light", "light"],
    ["System", "system"],
  ] as const) {
    await page.getByRole("radio", { name }).click();
    await page
      .getByRole("button", { name: "Done" })
      .or(page.getByRole("button", { name: "Close" }))
      .first()
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", attribute);
    expect(await page.evaluate(() => window.localStorage.getItem("almanac.theme"))).toBe(attribute);
    await OPEN.theme(page);
  }
});

test("System follows the browser's colour scheme", async ({ app: page }) => {
  await page.goto("week/2026/11/11");
  await OPEN.theme(page);
  await page.getByRole("radio", { name: "System" }).click();
  await page.keyboard.press("Escape");
  await page.emulateMedia({ colorScheme: "light" });
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(237, 237, 232)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(17, 17, 13)");
});
