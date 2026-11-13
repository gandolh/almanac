import { expect, test } from "./fixtures";
import { OPEN } from "./helpers";

test.describe("the first screen at 1280 x 800", () => {
  test("the week runs to 21:00 with every block whole, and the calendars are in view", async ({ app: page }) => {
    await page.goto("week/2026/11/11");
    const card = page.locator("[data-view]");
    await card.waitFor();
    await page.waitForTimeout(500);
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    const scroller = await card.evaluate((el) => {
      const scrolling = [...el.querySelectorAll<HTMLElement>("*")].find(
        (node) => node.scrollHeight > node.clientHeight + 5 && getComputedStyle(node).overflowY !== "visible",
      );
      const rect = scrolling?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom } : null;
    });
    expect(scroller).not.toBeNull();
    // The 21:00 line is inside the grid's scroller: its label is centred on it.
    const label = await page.getByText("21:00", { exact: true }).first().boundingBox();
    expect(label && label.y + label.height / 2).toBeLessThanOrEqual((scroller?.bottom ?? 0) + 1);
    // Every timed block that starts at 08:00 or later sits wholly inside it: 15 of them.
    const blocks = await card
      .locator("[data-no-swipe]")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => ({ rect: node.getBoundingClientRect(), text: node.textContent ?? "" }))
          .filter((block) => !/^Anniversary|^Run/.test(block.text)),
      );
    expect(blocks).toHaveLength(15);
    for (const block of blocks) {
      expect(block.rect.top, block.text).toBeGreaterThanOrEqual((scroller?.top ?? 0) - 1);
      expect(block.rect.bottom, block.text).toBeLessThanOrEqual((scroller?.bottom ?? 0) + 1);
    }
    for (const name of ["Personal", "Work", "Home", "Fitness"]) {
      const row = await page.getByRole("checkbox", { name }).boundingBox();
      expect(row, name).not.toBeNull();
    }
    const calendars = await page.getByRole("region", { name: "My calendars" }).boundingBox();
    expect((calendars?.y ?? 0) + (calendars?.height ?? 0)).toBeLessThanOrEqual(800);
  });

  test("Save is in view in the event form", async ({ app: page }) => {
    await page.goto("week/2026/11/11");
    await OPEN.form(page);
    const save = await page.getByRole("button", { name: "Save" }).boundingBox();
    expect((save?.y ?? 999) + (save?.height ?? 0)).toBeLessThanOrEqual(800);
  });
});

for (const phone of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const) {
  test.describe(`the first screen at ${phone.width} x ${phone.height}`, () => {
    test.use({ viewport: phone });

    test("Wednesday and Thursday are whole", async ({ app: page }) => {
      await page.goto("week/2026/11/11");
      await page.getByRole("region", { name: "Wednesday, 11 November" }).waitFor();
      await page.waitForTimeout(400);
      for (const day of ["Wednesday, 11 November", "Thursday, 12 November"]) {
        const box = await page.getByRole("region", { name: day }).boundingBox();
        expect(box, day).not.toBeNull();
        expect((box?.y ?? 0) + (box?.height ?? 0), day).toBeLessThanOrEqual(phone.height);
        expect(box?.y ?? 0, day).toBeGreaterThanOrEqual(0);
      }
    });

    test("the last row sits 32 px clear of Create when scrolled to the end", async ({ app: page }) => {
      await page.goto("week/2026/11/11");
      await page.getByRole("region", { name: "Sunday, 15 November" }).waitFor();
      await page.locator("main").evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
      await page.waitForTimeout(200);
      const create = await page.getByRole("button", { name: "Create" }).boundingBox();
      const row = await page
        .getByRole("region", { name: "Sunday, 15 November" })
        .getByRole("button")
        .last()
        .boundingBox();
      expect(create).not.toBeNull();
      expect((create?.y ?? 0) - ((row?.y ?? 0) + (row?.height ?? 0))).toBeGreaterThanOrEqual(32);
    });
  });
}
