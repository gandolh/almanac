// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

/** A `matchMedia` whose "(prefers-color-scheme: dark)" answer the test can change. */
function mockSystem(initiallyDark: boolean) {
  let dark = initiallyDark;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("dark") && dark;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return (next: boolean) => {
    dark = next;
    for (const listener of listeners) listener();
  };
}

function page() {
  document.head.innerHTML = '<meta name="color-scheme" content="light" /><meta name="theme-color" content="#EDEDE8" />';
  delete document.documentElement.dataset.theme;
  return {
    theme: () => document.documentElement.dataset.theme,
    scheme: () => document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')?.content,
    bar: () => document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content,
  };
}

/** A fresh copy of the module, which reads the stored choice when it loads, as a page load does. */
async function load() {
  vi.resetModules();
  return import("./theme");
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the stored choice", () => {
  it("is light on a first visit, even when the system is dark", async () => {
    mockSystem(true);
    const { getTheme, readTheme } = await load();
    expect(readTheme()).toBe("light");
    expect(getTheme()).toBe("light");
  });

  it("ignores a stored value that isn't a choice", async () => {
    window.localStorage.setItem("almanac.theme", "sepia");
    mockSystem(false);
    expect((await load()).getTheme()).toBe("light");
  });

  it("is light when storage is blocked", async () => {
    mockSystem(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect((await load()).getTheme()).toBe("light");
    vi.restoreAllMocks();
  });

  it.each(["light", "dark", "system"] as const)("%s is read back after a reload", async (choice) => {
    mockSystem(false);
    const first = await load();
    first.setTheme(choice);
    expect(window.localStorage.getItem("almanac.theme")).toBe(choice);
    expect((await load()).getTheme()).toBe(choice);
  });
});

describe("setTheme", () => {
  it.each([
    ["light", "light", "light", "#edede8"],
    ["dark", "dark", "dark", "#11110d"],
    ["system", "system", "light dark", "#edede8"],
  ] as const)("%s sets data-theme, the color-scheme meta and the bar", async (choice, attribute, scheme, bar) => {
    mockSystem(false);
    const html = page();
    (await load()).setTheme(choice);
    expect(html.theme()).toBe(attribute);
    expect(html.scheme()).toBe(scheme);
    expect(html.bar()).toBe(bar);
  });

  it("makes System follow a changed system: the bar turns with it", async () => {
    const setSystemDark = mockSystem(false);
    const html = page();
    const { setTheme, getTheme } = await load();
    setTheme("system");
    expect(html.bar()).toBe("#edede8");
    setSystemDark(true);
    expect(html.bar()).toBe("#11110d");
    expect(html.theme()).toBe("system");
    expect(getTheme()).toBe("system");
    setSystemDark(false);
    expect(html.bar()).toBe("#edede8");
  });

  it("leaves a fixed choice alone when the system changes", async () => {
    const setSystemDark = mockSystem(false);
    const html = page();
    (await load()).setTheme("light");
    setSystemDark(true);
    expect(html.bar()).toBe("#edede8");
  });

  it("keeps the choice for the tab when storage is blocked", async () => {
    mockSystem(false);
    page();
    const { setTheme, getTheme } = await load();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "QuotaExceededError");
    });
    setTheme("dark");
    expect(getTheme()).toBe("dark");
    vi.restoreAllMocks();
  });
});

describe("the colours", () => {
  it("are the stylesheet's ground in both themes, in the store and in the boot script", async () => {
    const css = readFileSync(resolve(here, "../styles/index.css"), "utf8");
    const ground = /--color-ground:\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i.exec(css);
    const { THEME_COLORS } = await load();
    expect(ground?.[1]?.toLowerCase()).toBe(THEME_COLORS.light);
    expect(ground?.[2]?.toLowerCase()).toBe(THEME_COLORS.dark);

    const html = readFileSync(resolve(here, "../../index.html"), "utf8").toLowerCase();
    expect(html).toContain(`<meta name="theme-color" content="${THEME_COLORS.light}"`);
    expect(html).toContain(`dark ? "${THEME_COLORS.dark}" : "${THEME_COLORS.light}"`);
    // The same key as the store's.
    const { THEME_KEY } = await load();
    expect(html).toContain(`getitem("${THEME_KEY}")`);
  });
});
