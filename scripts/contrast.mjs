// The redesign's contrast check: every text and icon pair of the built tokens, in both themes.
//
//   node scripts/contrast.mjs
//
// It reads the `--color-*` tokens of web/src/styles/index.css (the literal hex values inside
// `light-dark(light, dark)`, and aliases of them), measures each pair with the WCAG 2 ratio and exits 1
// if one falls under its minimum: 4.5:1 for text, 3:1 for icons, edges and marks the eye needs, and a
// card's own edge (1.3:1) beside the page behind it. The last lines are the minimums, for the outcome note.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../web/src/styles/index.css"), "utf8");
const theme = /@theme static \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

/** @type {Map<string, { light: string, dark: string }>} */
const tokens = new Map();
for (const [, name, value] of theme.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) {
  const pair = /^light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i.exec(value.trim());
  if (pair) tokens.set(name, { light: pair[1], dark: pair[2] });
}
for (const [, name, of] of theme.matchAll(/--color-([a-z0-9-]+):\s*var\(--color-([a-z0-9-]+)\);/g)) {
  const target = tokens.get(of);
  if (target) tokens.set(name, target);
}

const CALENDARS = ["blue", "teal", "green", "olive", "yellow", "orange", "red", "pink", "purple", "graphite"];

/** [foreground, background, minimum, what it is] */
const PAIRS = [
  ["ink", "ground", 4.5, "text on the page"],
  ["ink", "surface", 4.5, "text on a card"],
  ["ink", "field", 4.5, "text in a field"],
  ["ink", "accent-tint", 4.5, "text on the shown week"],
  ["ink", "control", 4.5, "text on a control"],
  ["ink-2", "surface", 4.5, "secondary text and icons on a card"],
  ["ink-2", "ground", 4.5, "icons on the page"],
  ["muted", "ground", 4.5, "labels on the page"],
  ["muted", "surface", 4.5, "hours, weekday names, list times"],
  ["muted", "field", 4.5, "placeholder, the all-day row's label"],
  ["muted", "accent-tint", 4.5, "other months' days in the shown week"],
  ["muted", "accent-tint-soft", 4.5, "muted text under a menu row"],
  ["accent", "surface", 4.5, "links, focus, Create's edge"],
  ["accent", "ground", 4.5, "links on the page"],
  ["accent-ink", "accent-tint", 4.5, "the chosen view, Today's tag, the disc"],
  ["accent-ink", "accent-tint-soft", 4.5, "a menu row under the pointer"],
  ["on-accent", "accent", 4.5, "Create, today's numeral, the chosen day"],
  ["on-accent", "accent-press", 4.5, "Create pressed"],
  ["on-now", "now-line", 4.5, "the 10:30 chip"],
  ["now-line", "surface", 4.5, "the now time in the list"],
  ["danger", "surface", 4.5, "Delete, errors on a card"],
  ["danger", "field", 4.5, "an error under a field"],
  ["toast-ink", "toast-surface", 4.5, "the toast's words"],
  ["toast-action", "toast-surface", 4.5, "the toast's action"],
  ...CALENDARS.map((key) => [`on-cal-${key}`, `cal-${key}`, 4.5, `an event's text, ${key}`]),
  ["outline", "surface", 3, "a button's, field's and checkbox's edge"],
  ["outline", "field", 3, "a field's edge on its fill"],
  ["outline", "ground", 3, "an edge on the page"],
  ["focus-ring", "ground", 3, "the focus ring on the page"],
  ["focus-ring", "surface", 3, "the focus ring on a card"],
  ["focus-ring", "field", 3, "the focus ring on a field"],
  ["focus-ring", "accent-tint", 3, "the focus ring on the tint"],
  ["accent", "accent-tint", 3, "today's tab on the shown week"],
  ["now-line", "accent-tint", 3, "the now line across today's column"],
  ["accent", "field", 3, "the search field's focus"],
  ...CALENDARS.map((key) => [`cal-${key}`, "surface", 3, `a calendar's mark, ${key}`]),
  ...CALENDARS.map((key) => [`cal-${key}`, "accent-tint", 3, `an event on today's column, ${key}`]),
  ["hairline", "surface", 1.3, "a card's own edge"],
  ["surface", "ground", 1.09, "a card against the page (with its edge)"],
];

/** @param {string} hex */
function luminance(hex) {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} a @param {string} b */
function ratio(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

let failed = 0;
/** @type {Record<string, { text: number, mark: number }>} */
const lowest = { light: { text: Infinity, mark: Infinity }, dark: { text: Infinity, mark: Infinity } };
for (const [foreground, background, minimum, what] of PAIRS) {
  const fg = tokens.get(String(foreground));
  const bg = tokens.get(String(background));
  if (!fg || !bg) {
    console.log(`MISSING  ${foreground} on ${background}`);
    failed += 1;
    continue;
  }
  const row = [];
  for (const mode of /** @type {const} */ (["light", "dark"])) {
    const value = ratio(fg[mode], bg[mode]);
    const ok = value >= Number(minimum);
    if (!ok) failed += 1;
    if (Number(minimum) === 4.5) lowest[mode].text = Math.min(lowest[mode].text, value);
    if (Number(minimum) === 3) lowest[mode].mark = Math.min(lowest[mode].mark, value);
    row.push(`${mode} ${value.toFixed(2)}${ok ? "" : " FAIL"}`);
  }
  console.log(
    `${String(minimum).padEnd(4)} ${String(foreground)} on ${String(background)} (${what}): ${row.join(", ")}`,
  );
}
console.log(`\n${PAIRS.length} pairs, ${failed} failing.`);
for (const mode of ["light", "dark"]) {
  console.log(
    `${mode}: text minimum ${lowest[mode]?.text.toFixed(2)}:1, icons and marks minimum ${lowest[mode]?.mark.toFixed(2)}:1`,
  );
}
process.exit(failed === 0 ? 0 : 1);
