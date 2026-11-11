import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "index.css"), "utf8");
const tailwindDir = dirname(fileURLToPath(import.meta.resolve("tailwindcss/package.json")));

/** The page's stylesheet as Tailwind builds it for `candidates`, with `@import "tailwindcss"` read from the package. */
async function build(candidates: string[]): Promise<string> {
  const compiler = await compile(source, {
    base: here,
    async loadStylesheet(id, base) {
      const path = id === "tailwindcss" ? resolve(tailwindDir, "index.css") : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, "utf8") };
    },
  });
  return compiler.build(candidates);
}

/** Whether a class has a rule: `.name` not followed by more of a longer name. */
const hasRule = (css: string, name: string) =>
  new RegExp(`\\.${name.replace(/[^\w-]/g, "\\\\$&")}(?![\\w-])`).test(css);

describe("the one stylesheet", () => {
  it("fixes the layer order before anything else is read", () => {
    const order = source.indexOf("@layer theme, base, fullcalendar, components, utilities;");
    expect(order).toBeGreaterThanOrEqual(0);
    expect(order).toBeLessThan(source.indexOf("@import"));
  });

  it("defines exactly the 117 tokens", () => {
    const theme = /@theme static \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? "";
    const plain = /\n:root \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? "";
    const count = (css: string) => css.match(/^\s*--[a-z0-9-]+:/gm)?.length ?? 0;
    expect(count(theme) + count(plain)).toBe(117);
  });

  it("makes Almanac's tokens into utilities", async () => {
    const css = await build(["bg-surface", "text-ink-2", "text-body", "rounded-control", "shadow-float", "z-float"]);
    for (const name of ["bg-surface", "text-ink-2", "text-body", "rounded-control", "shadow-float", "z-float"]) {
      expect(hasRule(css, name), name).toBe(true);
    }
  });

  it("has no Tailwind palette, text scale, radii or shadows beside them", async () => {
    const css = await build(["bg-red-500", "text-sm", "rounded-lg", "shadow-md", "font-mono", "ease-in-out"]);
    for (const name of ["bg-red-500", "text-sm", "rounded-lg", "shadow-md", "font-mono"]) {
      expect(hasRule(css, name), name).toBe(false);
    }
  });

  it("matches the phone at the width the shell's script does", async () => {
    const css = await build(["max-md:flex"]);
    // 48rem is 768 px; media queries ignore the root font size, so this is 767.98 px and below.
    expect(css).toContain("48rem");
  });
});
