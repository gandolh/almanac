import type { Page } from "@playwright/test";

/** Opens an overlay or state on the page the fixtures built, for the specs and the captures that walk them. */
export const OPEN = {
  details: async (page: Page) => {
    // The block in the view (or the row in the phone's agenda), not the left column's day card.
    await page
      .locator("[data-view]")
      .getByRole("button", { name: /Design review/ })
      .first()
      .click();
    await page.getByRole("dialog").waitFor();
  },
  form: async (page: Page) => {
    await page.getByRole("button", { name: "Create" }).first().click();
    await page.getByRole("dialog", { name: "New event" }).waitFor();
  },
  account: async (page: Page) => {
    await page.getByRole("button", { name: /^Account/ }).click();
    await page.getByRole("menu").waitFor();
  },
  theme: async (page: Page) => {
    await OPEN.account(page);
    await page.getByRole("menuitem", { name: /^Theme/ }).click();
    await page.getByRole("dialog", { name: "Theme" }).waitFor();
  },
  drawer: async (page: Page) => {
    await page.getByRole("button", { name: "Main menu" }).click();
    await page.getByRole("dialog", { name: "Calendars" }).waitFor();
  },
} as const;

/**
 * Whether the element with focus shows a ring: its own outline, or the one its wrapper draws for it
 * (the search field's form, a calendar's checkbox box beside the hidden input, a row's button).
 */
export async function focusRing(page: Page): Promise<{ ok: boolean; what: string }> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { ok: true, what: "body" };
    const drawn = (node: Element | null | undefined) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
    };
    const candidates = [
      el,
      el.parentElement,
      el.nextElementSibling,
      el.firstElementChild,
      el.closest("form"),
      el.closest("label")?.querySelector("span"),
    ];
    const what = `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? ` "${el.getAttribute("aria-label")}"` : ""} ${String(el.className).slice(0, 40)}`;
    return { ok: candidates.some(drawn), what };
  });
}
