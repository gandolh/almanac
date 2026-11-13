import { expect, FEED_TOKENS, test } from "./fixtures";
import { OPEN } from "./helpers";

/** The account menu's Calendar feed…, against the stubbed API, whose feed keeps its state for the page. */

const [FIRST = "", SECOND = ""] = FEED_TOKENS;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("turning the feed on shows the link once, to copy", async ({ app: page }) => {
  await page.goto("week/2026/11/11");
  await OPEN.feed(page);
  const dialog = page.getByRole("dialog", { name: "Calendar feed" });
  const toggle = dialog.getByRole("switch", { name: "Feed for a calendar app" });
  await expect(toggle).not.toBeChecked();
  await expect(dialog).toContainText("Off. Turn it on for a private link");
  await expect(dialog.getByRole("textbox")).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toBeChecked();
  const link = dialog.getByRole("textbox", { name: "Your private link" });
  await expect(link).toHaveValue(new RegExp(`/almanac-api/api/feed/${FIRST}/almanac\\.ics$`));
  await expect(link).toHaveAttribute("readonly", "");
  await expect(dialog).toContainText("can't show it again");
  await expect(dialog).toContainText("ICSx⁵");

  await dialog.getByRole("button", { name: "Copy link" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(FIRST);

  // Closed and opened again, the feed is on and the link is gone for good.
  await dialog.getByRole("button", { name: "Done" }).click();
  await OPEN.feed(page);
  await expect(toggle).toBeChecked();
  await expect(dialog).toContainText("On since 11 Nov 2026.");
  await expect(dialog).toContainText("shown once");
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
});

test("a new link asks first, then replaces the old one", async ({ app: page }) => {
  await page.goto("week/2026/11/11");
  await OPEN.feed(page);
  const dialog = page.getByRole("dialog", { name: "Calendar feed" });
  await dialog.getByRole("switch", { name: "Feed for a calendar app" }).click();
  const link = dialog.getByRole("textbox", { name: "Your private link" });
  await expect(link).toHaveValue(new RegExp(FIRST));

  await dialog.getByRole("button", { name: "New link" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Make a new link?" });
  await expect(confirm).toContainText("The old link stops working at once.");
  // Cancel has focus, and keeps the link.
  await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(link).toHaveValue(new RegExp(FIRST));

  await dialog.getByRole("button", { name: "New link" }).click();
  await confirm.getByRole("button", { name: "Make a new link" }).click();
  await expect(confirm).toBeHidden();
  await expect(link).toHaveValue(new RegExp(SECOND));
});

test("turning the feed off asks first", async ({ app: page }) => {
  await page.goto("week/2026/11/11");
  await OPEN.feed(page);
  const dialog = page.getByRole("dialog", { name: "Calendar feed" });
  const toggle = dialog.getByRole("switch", { name: "Feed for a calendar app" });
  await toggle.click();
  await expect(toggle).toBeChecked();

  await toggle.click();
  const confirm = page.getByRole("alertdialog", { name: "Turn the calendar feed off?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(toggle).toBeChecked();

  await toggle.click();
  await confirm.getByRole("button", { name: "Turn off" }).click();
  await expect(toggle).not.toBeChecked();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(dialog).toContainText("Off.");
});

test.describe("on a 360 px phone", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("the dialog and its long link don't scroll sideways", async ({ app: page }) => {
    await page.goto("week/2026/11/11");
    await OPEN.feed(page);
    const dialog = page.getByRole("dialog", { name: "Calendar feed" });
    await dialog.getByRole("switch", { name: "Feed for a calendar app" }).click();
    await expect(dialog.getByRole("textbox", { name: "Your private link" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(dialog.getByRole("button", { name: "Copy link" })).toBeInViewport();
  });
});
